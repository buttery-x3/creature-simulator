<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { Habitat } from '$lib/habitat';
	import type { Creature } from '$lib/simulation';
	import {
		clearCreaturePresentation,
		createCreaturePresentationResources,
		reconcileCreatures,
		type CreaturePresentationResources
	} from './creature-presentation';
	import {
		buildHabitatPresentation,
		clearHabitatPresentation,
		createHabitatPresentationResources,
		type HabitatPresentationResources
	} from './habitat-presentation';
	import {
		assessHabitatVisibility,
		frameHabitatPerspectiveCamera,
		type HabitatVisibilityReport
	} from './habitat-camera';

	/**
	 * Coordinate convention:
	 * - Simulation ground plane uses (x, y).
	 * - Three.js maps those onto the XY plane (z is presentation height only).
	 * - Perspective camera is nearly top-down (~80° elevation) with a slight
	 *   single-axis tilt so upright presentation reads as 3D while the layout
	 *   stays map-like and fully framed.
	 *
	 * Static habitat presentation rebuilds only when habitat identity changes.
	 * Creature meshes are reconciled by id and updated in place.
	 */

	type Props = {
		habitat: Habitat;
		creatures: Creature[];
	};

	let { habitat, creatures }: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	/** Set by onMount; used by $effect to sync presentation with props. */
	let applyHabitat: ((data: Habitat) => void) | undefined = $state();
	let applyCreatures: ((list: Creature[]) => void) | undefined = $state();

	onMount(() => {
		const host = container;
		if (!host) {
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0f172a);

		const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
		camera.up.set(0, 1, 0);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.domElement.dataset.testid = 'three-canvas';
		host.appendChild(renderer.domElement);

		const habitatResources: HabitatPresentationResources = createHabitatPresentationResources();
		scene.add(habitatResources.root);

		const creatureResources: CreaturePresentationResources = createCreaturePresentationResources();
		scene.add(creatureResources.root);

		let currentHabitat: Habitat | undefined;
		let habitatBuildCount = 0;

		function publishVisibility(report: HabitatVisibilityReport): void {
			const canvas = renderer.domElement;
			canvas.dataset.habitatFullyVisible = report.fullyVisible ? 'true' : 'false';
			canvas.dataset.habitatCameraMode = 'perspective-near-top-down';
			canvas.dataset.habitatCornersVisible = String(
				report.corners.filter((corner) => corner.visible).length
			);
			canvas.dataset.habitatCornerCount = String(report.corners.length);
		}

		function publishCreatureMeta(count: number): void {
			const canvas = renderer.domElement;
			canvas.dataset.creatureCount = String(count);
			canvas.dataset.habitatBuildCount = String(habitatBuildCount);
			canvas.dataset.creatureStructureVersion = String(creatureResources.structureVersion);
		}

		function renderFrame() {
			if (!host || !currentHabitat) {
				return;
			}

			const width = host.clientWidth;
			const height = host.clientHeight;
			if (width === 0 || height === 0) {
				return;
			}

			renderer.setSize(width, height, false);

			const report = frameHabitatPerspectiveCamera(camera, currentHabitat.bounds, width / height);
			const confirmed = assessHabitatVisibility(camera, currentHabitat.bounds);
			publishVisibility(report.fullyVisible ? report : confirmed);

			renderer.render(scene, camera);
		}

		applyHabitat = (data: Habitat) => {
			const habitatChanged =
				!currentHabitat || currentHabitat.seed !== data.seed || currentHabitat !== data;

			// Rebuild static habitat only when the habitat reference or seed changes.
			// Ordinary creature movement must not call this path with a new habitat object
			// that is deeply equal — page keeps habitat stable across steps.
			if (habitatChanged) {
				currentHabitat = data;
				buildHabitatPresentation(habitatResources, data);
				habitatBuildCount += 1;
			}
			renderFrame();
		};

		applyCreatures = (list: Creature[]) => {
			reconcileCreatures(creatureResources, list);
			publishCreatureMeta(list.length);
			renderFrame();
		};

		applyHabitat(habitat);
		applyCreatures(creatures);

		const observer = new ResizeObserver(renderFrame);
		observer.observe(host);

		return () => {
			observer.disconnect();
			applyHabitat = undefined;
			applyCreatures = undefined;
			clearHabitatPresentation(habitatResources);
			clearCreaturePresentation(creatureResources);
			scene.remove(habitatResources.root);
			scene.remove(creatureResources.root);
			renderer.dispose();
			renderer.domElement.remove();
		};
	});

	$effect(() => {
		const data = habitat;
		applyHabitat?.(data);
	});

	$effect(() => {
		const list = creatures;
		applyCreatures?.(list);
	});
</script>

<div
	class="viewport"
	bind:this={container}
	data-testid="three-viewport"
	aria-label="Habitat viewport"
></div>

<style>
	.viewport {
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
