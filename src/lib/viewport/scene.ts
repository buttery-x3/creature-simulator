import * as THREE from 'three';
import type { Habitat } from '$lib/habitat';
import type { Creature, SignalEmission, WeatherPhase, Wildlife } from '$lib/simulation';
import { reconcileCreatures } from '../creature-presentation';
import { reconcileHabitatPresentation } from '../habitat-presentation';
import { reconcileRainPresentation } from '../rain-presentation';
import { reconcileHeardCues } from '../listener-cue-presentation';
import {
	reconcileSignals,
	updateInvestigationOverlay,
	updateSignalBillboards
} from '../signal-presentation';
import { frameViewportCamera } from './camera';
import { daylightAppearance } from '$lib/ecology-presentation';
import { createViewportResources } from './resources';

export type ViewportSnapshot = {
	habitat: Habitat;
	creatures: Creature[];
	wildlife: Wildlife[];
	activeEmissions: SignalEmission[];
	timeSeconds: number;
	weather: WeatherPhase;
	daylight: number;
	selectedCreatureId: string | null;
	followSelected: boolean;
	sensingRadius: number;
	hearingRadius: number;
	investigationDistanceScale: number;
};

/** Scene lifecycle and reconciliation. It consumes snapshots and never advances simulation. */
export function createViewportScene(host: HTMLDivElement, onSelect: (id: string | null) => void) {
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
	camera.up.set(0, 1, 0);
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.domElement.dataset.testid = 'three-canvas';
	renderer.domElement.style.cursor = 'pointer';
	host.appendChild(renderer.domElement);
	const resources = createViewportResources(scene);
	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let current: ViewportSnapshot | null = null;
	let habitatBuildCount = 0;

	function render() {
		if (!current || !host.clientWidth || !host.clientHeight) return;
		renderer.setSize(host.clientWidth, host.clientHeight, false);
		const selectedId = current.selectedCreatureId;
		const followed = current.followSelected
			? current.creatures.find((c) => c.id === selectedId)
			: undefined;
		const report = frameViewportCamera(
			camera,
			current.habitat.bounds,
			host.clientWidth / host.clientHeight,
			followed?.position ?? null
		);
		Object.assign(renderer.domElement.dataset, {
			habitatFullyVisible: String(report.fullyVisible),
			habitatCameraMode: followed ? 'follow-creature' : 'perspective-near-top-down',
			habitatCornersVisible: String(report.corners.filter((c) => c.visible).length),
			habitatCornerCount: String(report.corners.length)
		});
		updateSignalBillboards(resources.signals, camera);
		renderer.render(scene, camera);
	}

	function update(snapshot: ViewportSnapshot) {
		current = snapshot;
		const {
			habitat,
			creatures,
			wildlife,
			selectedCreatureId,
			timeSeconds,
			sensingRadius,
			hearingRadius
		} = snapshot;
		const previousVersion = resources.habitat.structureVersion;
		reconcileHabitatPresentation(resources.habitat, habitat);
		if (previousVersion !== resources.habitat.structureVersion) habitatBuildCount++;
		reconcileRainPresentation(resources.rain, snapshot.weather, habitat.bounds);
		reconcileCreatures(resources.creatures, creatures, selectedCreatureId, timeSeconds);
		resources.wildlife.update(wildlife);
		resources.expressions.update(creatures, timeSeconds);
		const selected = creatures.find((c) => c.id === selectedCreatureId);
		resources.sensingRing.visible = !!selected;
		if (selected) {
			resources.sensingRing.position.set(selected.position.x, selected.position.y, 0.02);
			resources.sensingRing.scale.set(sensingRadius, sensingRadius, 1);
		}
		updateInvestigationOverlay(resources.signals, {
			creaturePosition: selected?.position ?? null,
			investigation: selected?.activeInvestigation ?? null
		});
		reconcileSignals(resources.signals, snapshot.activeEmissions, timeSeconds, {
			hearingRadius,
			investigationDistanceScale: snapshot.investigationDistanceScale,
			creaturePositions: Object.fromEntries(creatures.map((c) => [c.id, c.position]))
		});
		reconcileHeardCues(resources.listeners, creatures, timeSeconds, { camera });
		const appearance = daylightAppearance(snapshot.daylight);
		renderer.toneMappingExposure = appearance.exposure;
		scene.background = appearance.background;
		Object.assign(renderer.domElement.dataset, {
			creatureCount: String(creatures.length),
			expressionCount: String(resources.expressions.byId.size),
			habitatBuildCount: String(habitatBuildCount),
			creatureStructureVersion: String(resources.creatures.structureVersion),
			signalStructureVersion: String(resources.signals.structureVersion),
			activeEmissionCount: String(resources.signals.byId.size),
			heardCueCount: String(resources.listeners.byCreatureId.size),
			selectedCreatureId: selectedCreatureId ?? '',
			sensingOverlayVisible: String(resources.sensingRing.visible),
			sensingRadius: String(sensingRadius),
			hearingRadius: String(hearingRadius),
			habitatStructureVersion: String(resources.habitat.structureVersion),
			rainVisible: String(resources.rain.visible),
			wildlifeCount: String(wildlife.filter((w) => w.health > 0).length),
			carcassCount: String(wildlife.filter((w) => w.health <= 0 && w.foodAmount > 0).length),
			daylight: snapshot.daylight.toFixed(3)
		});
		render();
	}

	function pick(event: MouseEvent) {
		const rect = renderer.domElement.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		raycaster.setFromCamera(pointer, camera);
		const meshes = [...resources.creatures.byId.values()].flatMap((group) => group.children);
		const hit = raycaster.intersectObjects(meshes, false)[0];
		let object: THREE.Object3D | null = hit?.object ?? null;
		while (object) {
			if (typeof object.userData.creatureId === 'string') {
				onSelect(object.userData.creatureId);
				return;
			}
			object = object.parent;
		}
		onSelect(null);
	}
	const observer = new ResizeObserver(render);
	observer.observe(host);
	renderer.domElement.addEventListener('click', pick);
	function dispose() {
		observer.disconnect();
		renderer.domElement.removeEventListener('click', pick);
		resources.dispose();
		renderer.dispose();
		renderer.domElement.remove();
	}
	return { update, dispose };
}
