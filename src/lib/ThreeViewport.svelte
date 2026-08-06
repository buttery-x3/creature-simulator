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
	 * Selection is presentation state owned by the page, not simulation state.
	 */

	type Props = {
		habitat: Habitat;
		creatures: Creature[];
		selectedCreatureId?: string | null;
		onSelectCreature?: (creatureId: string | null) => void;
	};

	let { habitat, creatures, selectedCreatureId = null, onSelectCreature }: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	/** Set by onMount; used by $effect to sync presentation with props. */
	let applyHabitat: ((data: Habitat) => void) | undefined = $state();
	let applyCreatures: ((list: Creature[], selectedId: string | null) => void) | undefined =
		$state();
	let publishSelection: ((id: string | null) => void) | undefined = $state();

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
		renderer.domElement.style.cursor = 'pointer';
		host.appendChild(renderer.domElement);

		const habitatResources: HabitatPresentationResources = createHabitatPresentationResources();
		scene.add(habitatResources.root);

		const creatureResources: CreaturePresentationResources = createCreaturePresentationResources();
		scene.add(creatureResources.root);

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();

		let currentHabitat: Habitat | undefined;
		let habitatBuildCount = 0;
		let currentSelectedId: string | null = null;

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
			canvas.dataset.selectedCreatureId = currentSelectedId ?? '';
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

		applyCreatures = (list: Creature[], selectedId: string | null) => {
			currentSelectedId = selectedId;
			reconcileCreatures(creatureResources, list, selectedId);
			publishCreatureMeta(list.length);
			renderFrame();
		};

		publishSelection = (id: string | null) => {
			currentSelectedId = id;
			publishCreatureMeta(creatureResources.byId.size);
		};

		function pickCreature(clientX: number, clientY: number): string | null {
			const rect = renderer.domElement.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) {
				return null;
			}
			pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);

			const meshes: THREE.Object3D[] = [];
			for (const group of creatureResources.byId.values()) {
				meshes.push(...group.children);
			}
			const hits = raycaster.intersectObjects(meshes, false);
			if (hits.length === 0) {
				return null;
			}
			let object: THREE.Object3D | null = hits[0]!.object;
			while (object) {
				const id = object.userData?.creatureId;
				if (typeof id === 'string') {
					return id;
				}
				object = object.parent;
			}
			return null;
		}

		function onCanvasClick(event: MouseEvent): void {
			const id = pickCreature(event.clientX, event.clientY);
			onSelectCreature?.(id);
		}

		renderer.domElement.addEventListener('click', onCanvasClick);

		applyHabitat(habitat);
		applyCreatures(creatures, selectedCreatureId);

		const observer = new ResizeObserver(renderFrame);
		observer.observe(host);

		return () => {
			observer.disconnect();
			renderer.domElement.removeEventListener('click', onCanvasClick);
			applyHabitat = undefined;
			applyCreatures = undefined;
			publishSelection = undefined;
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
		const selected = selectedCreatureId;
		applyCreatures?.(list, selected ?? null);
	});

	$effect(() => {
		publishSelection?.(selectedCreatureId ?? null);
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
