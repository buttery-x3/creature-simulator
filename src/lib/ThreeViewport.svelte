<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { Habitat, Vec2 } from '$lib/habitat';
	import type { Creature, SignalEmission, WeatherPhase } from '$lib/simulation';
	import {
		clearCreaturePresentation,
		createCreaturePresentationResources,
		reconcileCreatures,
		type CreaturePresentationResources
	} from './creature-presentation';
	import {
		clearHabitatPresentation,
		createHabitatPresentationResources,
		reconcileHabitatPresentation,
		type HabitatPresentationResources
	} from './habitat-presentation';
	import {
		clearRainPresentation,
		createRainPresentationResources,
		reconcileRainPresentation,
		type RainPresentationResources
	} from './rain-presentation';
	import {
		assessHabitatVisibility,
		frameHabitatPerspectiveCamera,
		type HabitatVisibilityReport
	} from './habitat-camera';
	import {
		clearListenerCuePresentation,
		createListenerCuePresentationResources,
		reconcileHeardCues,
		type ListenerCuePresentationResources
	} from './listener-cue-presentation';
	import {
		clearSignalPresentation,
		createSignalPresentationResources,
		reconcileSignals,
		updateInvestigationOverlay,
		updateSignalBillboards,
		type SignalPresentationResources
	} from './signal-presentation';

	/**
	 * Coordinate convention:
	 * - Simulation ground plane uses (x, y).
	 * - Three.js maps those onto the XY plane (z is presentation height only).
	 * - Perspective camera is nearly top-down (~80° elevation) with a slight
	 *   single-axis tilt so upright presentation reads as 3D while the layout
	 *   stays map-like and fully framed.
	 *
	 * Habitat ground/home rebuilds only when layout identity changes; food/water
	 * reconcile by feature id. Rain cue is presentation-only.
	 * Creature meshes are reconciled by id and updated in place.
	 * Signal visuals mirror authoritative activeEmissions only (bubbles + thin rings).
	 * Heard cues and investigation hops are presentation-only.
	 * Selection is presentation state owned by the page, not simulation state.
	 */

	type Props = {
		habitat: Habitat;
		creatures: Creature[];
		activeEmissions?: SignalEmission[];
		timeSeconds?: number;
		/** Authoritative weather phase (presentation rain cue only). */
		weather?: WeatherPhase;
		selectedCreatureId?: string | null;
		/** Authoritative sensing radius from SimulationConfig (presentation overlay only). */
		sensingRadius?: number;
		/** Authoritative hearing radius — ring max radius (presentation only). */
		hearingRadius?: number;
		/** Shared smooth falloff scale for ring opacity (presentation only). */
		investigationDistanceScale?: number;
		onSelectCreature?: (creatureId: string | null) => void;
	};

	let {
		habitat,
		creatures,
		activeEmissions = [],
		timeSeconds = 0,
		weather = 'clear',
		selectedCreatureId = null,
		sensingRadius = 3,
		hearingRadius = 12,
		investigationDistanceScale = 8,
		onSelectCreature
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	/** Set by onMount; used by $effect to sync presentation with props. */
	let applyHabitat: ((data: Habitat, weatherPhase: WeatherPhase) => void) | undefined = $state();
	let applyCreatures:
		| ((list: Creature[], selectedId: string | null, radius: number, simTime: number) => void)
		| undefined = $state();
	let applySignals:
		| ((
				emissions: SignalEmission[],
				simTime: number,
				list: Creature[],
				hearR: number,
				distScale: number
		  ) => void)
		| undefined = $state();
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

		const rainResources: RainPresentationResources = createRainPresentationResources();
		scene.add(rainResources.root);

		const creatureResources: CreaturePresentationResources = createCreaturePresentationResources();
		scene.add(creatureResources.root);

		const signalResources: SignalPresentationResources = createSignalPresentationResources();
		scene.add(signalResources.root);

		const listenerCueResources: ListenerCuePresentationResources =
			createListenerCuePresentationResources();
		scene.add(listenerCueResources.root);

		// Presentation-only sensing radius ring for the selected creature.
		const sensingRingGeom = new THREE.RingGeometry(0.98, 1.02, 48);
		const sensingRingMat = new THREE.MeshBasicMaterial({
			color: 0x94a3b8,
			transparent: true,
			opacity: 0.55,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const sensingRing = new THREE.Mesh(sensingRingGeom, sensingRingMat);
		sensingRing.name = 'sensing-radius-overlay';
		sensingRing.userData.presentationOnly = true;
		sensingRing.visible = false;
		// Flat on XY ground plane (ring is in XY by default in Three; OK for our ground).
		scene.add(sensingRing);

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();

		let currentHabitat: Habitat | undefined;
		let habitatBuildCount = 0;
		let currentSelectedId: string | null = null;
		let currentSensingRadius = sensingRadius;
		let currentHearingRadius = hearingRadius;

		function creaturePositions(list: readonly Creature[]): Record<string, Vec2> {
			const positions: Record<string, Vec2> = {};
			for (const c of list) {
				positions[c.id] = c.position;
			}
			return positions;
		}

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
			canvas.dataset.signalStructureVersion = String(signalResources.structureVersion);
			canvas.dataset.activeEmissionCount = String(signalResources.byId.size);
			canvas.dataset.heardCueCount = String(listenerCueResources.byCreatureId.size);
			canvas.dataset.selectedCreatureId = currentSelectedId ?? '';
			canvas.dataset.sensingOverlayVisible = sensingRing.visible ? 'true' : 'false';
			canvas.dataset.sensingRadius = String(currentSensingRadius);
			canvas.dataset.hearingRadius = String(currentHearingRadius);
			canvas.dataset.habitatStructureVersion = String(habitatResources.structureVersion);
			canvas.dataset.rainVisible = rainResources.visible ? 'true' : 'false';
		}

		function updateSensingOverlay(
			list: Creature[],
			selectedId: string | null,
			radius: number
		): void {
			currentSensingRadius = radius;
			const selected = selectedId ? list.find((c) => c.id === selectedId) : undefined;
			if (!selected) {
				sensingRing.visible = false;
				return;
			}
			sensingRing.visible = true;
			sensingRing.position.set(selected.position.x, selected.position.y, 0.02);
			sensingRing.scale.set(radius, radius, 1);
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

			updateSignalBillboards(signalResources, camera);
			renderer.render(scene, camera);
		}

		applyHabitat = (data: Habitat, weatherPhase: WeatherPhase) => {
			const previousVersion = habitatResources.structureVersion;
			// Reconcile food/water by id; full static rebuild only when layout identity changes.
			reconcileHabitatPresentation(habitatResources, data);
			if (habitatResources.structureVersion !== previousVersion) {
				habitatBuildCount += 1;
			}
			currentHabitat = data;
			reconcileRainPresentation(rainResources, weatherPhase, data.bounds);
			publishCreatureMeta(creatureResources.byId.size);
			renderFrame();
		};

		applyCreatures = (
			list: Creature[],
			selectedId: string | null,
			radius: number,
			simTime: number
		) => {
			currentSelectedId = selectedId;
			reconcileCreatures(creatureResources, list, selectedId, simTime);
			updateSensingOverlay(list, selectedId, radius);
			const selected = selectedId ? (list.find((c) => c.id === selectedId) ?? null) : null;
			updateInvestigationOverlay(signalResources, {
				creaturePosition: selected ? selected.position : null,
				investigation: selected?.activeInvestigation ?? null
			});
			reconcileHeardCues(listenerCueResources, list, simTime, { camera });
			publishCreatureMeta(list.length);
			renderFrame();
		};

		applySignals = (
			emissions: SignalEmission[],
			simTime: number,
			list: Creature[],
			hearR: number,
			distScale: number
		) => {
			currentHearingRadius = hearR;
			reconcileSignals(signalResources, emissions, simTime, {
				hearingRadius: hearR,
				investigationDistanceScale: distScale,
				creaturePositions: creaturePositions(list)
			});
			// Keep heard cues in sync when only emissions/time update.
			reconcileHeardCues(listenerCueResources, list, simTime, { camera });
			publishCreatureMeta(creatureResources.byId.size);
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

		applyHabitat(habitat, weather);
		applyCreatures(creatures, selectedCreatureId, sensingRadius, timeSeconds);
		applySignals(
			activeEmissions,
			timeSeconds,
			creatures,
			hearingRadius,
			investigationDistanceScale
		);

		const observer = new ResizeObserver(renderFrame);
		observer.observe(host);

		return () => {
			observer.disconnect();
			renderer.domElement.removeEventListener('click', onCanvasClick);
			applyHabitat = undefined;
			applyCreatures = undefined;
			applySignals = undefined;
			publishSelection = undefined;
			clearHabitatPresentation(habitatResources);
			clearRainPresentation(rainResources);
			clearCreaturePresentation(creatureResources);
			clearSignalPresentation(signalResources);
			clearListenerCuePresentation(listenerCueResources);
			scene.remove(habitatResources.root);
			scene.remove(rainResources.root);
			scene.remove(creatureResources.root);
			scene.remove(signalResources.root);
			scene.remove(listenerCueResources.root);
			scene.remove(sensingRing);
			sensingRingGeom.dispose();
			sensingRingMat.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		};
	});

	$effect(() => {
		const data = habitat;
		const weatherPhase = weather;
		applyHabitat?.(data, weatherPhase);
	});

	$effect(() => {
		const list = creatures;
		const selected = selectedCreatureId;
		const radius = sensingRadius;
		const t = timeSeconds;
		applyCreatures?.(list, selected ?? null, radius, t);
	});

	$effect(() => {
		const emissions = activeEmissions;
		const t = timeSeconds;
		const list = creatures;
		const hearR = hearingRadius;
		const distScale = investigationDistanceScale;
		applySignals?.(emissions, t, list, hearR, distScale);
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
