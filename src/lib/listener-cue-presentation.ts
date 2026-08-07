/**
 * Presentation-only "heard something" cues for listeners.
 *
 * A brief neutral question-mark appears when a creature has a recent HeardSignal.
 * Multiple hears in a short window coalesce to one cue per creature. This does
 * not imply understanding or investigation commitment.
 *
 * Timing derives from authoritative HeardSignal.heardAt and simulation time.
 * Cue duration is presentation configuration only — not SimulationConfig.
 */

import * as THREE from 'three';
import type { Creature } from '$lib/simulation';

/** How long a heard cue remains visible after heardAt (presentation only). */
export const DEFAULT_HEARD_CUE_DURATION_SECONDS = 0.75;

const CUE_HEIGHT = 0.95;
const CUE_SIDE_OFFSET = 0.32;
const CUE_COLOR = 0xe2e8f0;

export type ListenerCuePresentationResources = {
	root: THREE.Group;
	/** Shared "?" canvas texture; disposed with the bag. */
	questionTexture: THREE.CanvasTexture;
	planeGeometry: THREE.BufferGeometry;
	byCreatureId: Map<string, THREE.Group>;
	materialsById: Map<string, THREE.MeshBasicMaterial>;
	/** Last heardAt that refreshed the cue (coalesce). */
	heardAtById: Map<string, number>;
	structureVersion: number;
};

function createQuestionTexture(): THREE.CanvasTexture {
	const size = 64;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		ctx.clearRect(0, 0, size, size);
		ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#e2e8f0';
		ctx.font = 'bold 40px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', size / 2, size / 2 + 2);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

/**
 * Create listener-cue resources. In unit tests without a DOM canvas, a blank
 * texture is used so reconcile logic remains testable.
 */
export function createListenerCuePresentationResources(): ListenerCuePresentationResources {
	const root = new THREE.Group();
	root.name = 'listener-cues-root';

	let questionTexture: THREE.CanvasTexture;
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		questionTexture = createQuestionTexture();
	} else {
		// Headless fallback: 1×1 data texture.
		const data = new Uint8Array([226, 232, 240, 255]);
		questionTexture = new THREE.DataTexture(data, 1, 1) as unknown as THREE.CanvasTexture;
		questionTexture.needsUpdate = true;
	}

	return {
		root,
		questionTexture,
		planeGeometry: new THREE.PlaneGeometry(0.28, 0.28),
		byCreatureId: new Map(),
		materialsById: new Map(),
		heardAtById: new Map(),
		structureVersion: 0
	};
}

function latestHeardAt(creature: Creature): number | null {
	if (creature.recentHeard.length === 0) {
		return null;
	}
	let max = -Infinity;
	for (const heard of creature.recentHeard) {
		if (heard.heardAt > max) {
			max = heard.heardAt;
		}
	}
	return Number.isFinite(max) ? max : null;
}

function createCueGroup(
	resources: ListenerCuePresentationResources,
	creatureId: string
): THREE.Group {
	const group = new THREE.Group();
	group.name = `heard-cue-${creatureId}`;
	group.userData.creatureId = creatureId;
	group.userData.presentationOnly = true;
	group.userData.cueKind = 'heard';

	const material = new THREE.MeshBasicMaterial({
		map: resources.questionTexture,
		color: CUE_COLOR,
		transparent: true,
		opacity: 1,
		depthWrite: false,
		side: THREE.DoubleSide
	});
	resources.materialsById.set(creatureId, material);

	const mesh = new THREE.Mesh(resources.planeGeometry, material);
	mesh.name = `heard-cue-${creatureId}-mark`;
	mesh.position.set(CUE_SIDE_OFFSET, 0, CUE_HEIGHT);
	group.add(mesh);
	return group;
}

/**
 * Reconcile one coalesced heard cue per creature from recentHeard + time.
 * Does not read activeInvestigation (hearing ≠ investigation).
 */
export function reconcileHeardCues(
	resources: ListenerCuePresentationResources,
	creatures: readonly Creature[],
	timeSeconds: number,
	options?: { durationSeconds?: number; camera?: THREE.Camera | null }
): void {
	const duration =
		options?.durationSeconds !== undefined && options.durationSeconds > 0
			? options.durationSeconds
			: DEFAULT_HEARD_CUE_DURATION_SECONDS;
	const camera = options?.camera ?? null;
	const seen = new Set<string>();

	for (const creature of creatures) {
		const heardAt = latestHeardAt(creature);
		if (heardAt === null) {
			continue;
		}
		const age = timeSeconds - heardAt;
		if (age < 0 || age > duration) {
			continue;
		}

		seen.add(creature.id);
		let group = resources.byCreatureId.get(creature.id);
		if (!group) {
			group = createCueGroup(resources, creature.id);
			resources.byCreatureId.set(creature.id, group);
			resources.root.add(group);
			resources.structureVersion += 1;
		}

		// Coalesce: refresh heardAt tracking without creating extra groups.
		resources.heardAtById.set(creature.id, heardAt);

		group.position.set(creature.position.x, creature.position.y, 0);

		// Brief scale / fade: peak early, fade out by duration end.
		const t = age / duration;
		const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
		const opacity = Math.max(0, Math.min(1, fade));
		const scale = 0.85 + 0.25 * opacity;
		const mark = group.children[0];
		if (mark) {
			mark.scale.setScalar(scale);
		}
		const mat = resources.materialsById.get(creature.id);
		if (mat) {
			mat.opacity = opacity;
		}

		if (camera && mark) {
			mark.quaternion.copy(camera.quaternion);
		}
	}

	for (const [id, group] of resources.byCreatureId) {
		if (seen.has(id)) {
			continue;
		}
		resources.root.remove(group);
		resources.byCreatureId.delete(id);
		resources.heardAtById.delete(id);
		const mat = resources.materialsById.get(id);
		if (mat) {
			mat.dispose();
			resources.materialsById.delete(id);
		}
		resources.structureVersion += 1;
	}
}

export function clearListenerCuePresentation(resources: ListenerCuePresentationResources): void {
	for (const [id, group] of resources.byCreatureId) {
		resources.root.remove(group);
		const mat = resources.materialsById.get(id);
		if (mat) {
			mat.dispose();
		}
		void id;
	}
	resources.byCreatureId.clear();
	resources.materialsById.clear();
	resources.heardAtById.clear();
	resources.planeGeometry.dispose();
	resources.questionTexture.dispose();
	resources.structureVersion += 1;
}
