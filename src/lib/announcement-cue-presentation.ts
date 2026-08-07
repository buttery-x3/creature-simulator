/**
 * Presentation-only dashed lines from creatures to announcement trigger features.
 *
 * Reads authoritative activeAnnouncementCue on each creature. Does not affect
 * behaviour, clarity, signal origin or learning. Subordinate to speech bubbles
 * and propagation rings (lower opacity / z).
 */

import * as THREE from 'three';
import type { Habitat, Vec2 } from '$lib/habitat';
import type { Creature } from '$lib/simulation';

const CUE_Z = 0.04;
const CUE_COLOR = 0x64748b;
const CUE_OPACITY = 0.35;
const FADE_OPACITY = 0.18;

export type AnnouncementCuePresentationResources = {
	root: THREE.Group;
	byCreatureId: Map<string, THREE.Line>;
	material: THREE.LineDashedMaterial;
};

export function createAnnouncementCuePresentationResources(): AnnouncementCuePresentationResources {
	const root = new THREE.Group();
	root.name = 'announcement-cues';
	const material = new THREE.LineDashedMaterial({
		color: CUE_COLOR,
		dashSize: 0.18,
		gapSize: 0.12,
		transparent: true,
		opacity: CUE_OPACITY,
		depthWrite: false
	});
	return {
		root,
		byCreatureId: new Map(),
		material
	};
}

function featurePosition(habitat: Habitat, featureId: string, fallback: Vec2): Vec2 {
	const food = habitat.food.find((f) => f.id === featureId);
	if (food) {
		return food.position;
	}
	const water = habitat.water.find((f) => f.id === featureId);
	if (water) {
		return water.position;
	}
	return fallback;
}

/**
 * Reconcile one dashed line per creature that has an active announcement cue.
 * Queued opportunities without a cue are not drawn.
 */
export function reconcileAnnouncementCues(
	resources: AnnouncementCuePresentationResources,
	creatures: readonly Creature[],
	habitat: Habitat,
	timeSeconds: number,
	cueFadeSeconds: number
): void {
	const keep = new Set<string>();

	for (const creature of creatures) {
		const cue = creature.activeAnnouncementCue;
		if (!cue) {
			continue;
		}
		// Drop fully faded cues (authoritative state may still hold briefly).
		if (cue.fadeStartedAt !== null && timeSeconds - cue.fadeStartedAt >= cueFadeSeconds) {
			continue;
		}

		keep.add(creature.id);
		const end = featurePosition(habitat, cue.triggerFeatureId, cue.triggerFeaturePosition);
		const fading = cue.fadeStartedAt !== null;
		const opacity = fading ? FADE_OPACITY : CUE_OPACITY;

		let line = resources.byCreatureId.get(creature.id);
		if (!line) {
			const geometry = new THREE.BufferGeometry().setFromPoints([
				new THREE.Vector3(creature.position.x, creature.position.y, CUE_Z),
				new THREE.Vector3(end.x, end.y, CUE_Z)
			]);
			const mat = resources.material.clone();
			mat.opacity = opacity;
			line = new THREE.Line(geometry, mat);
			line.computeLineDistances();
			line.name = `announcement-cue-${creature.id}`;
			resources.root.add(line);
			resources.byCreatureId.set(creature.id, line);
		} else {
			const positions = line.geometry.attributes.position as THREE.BufferAttribute;
			positions.setXYZ(0, creature.position.x, creature.position.y, CUE_Z);
			positions.setXYZ(1, end.x, end.y, CUE_Z);
			positions.needsUpdate = true;
			line.geometry.computeBoundingSphere();
			line.computeLineDistances();
			const mat = line.material as THREE.LineDashedMaterial;
			mat.opacity = opacity;
		}
	}

	for (const [id, line] of resources.byCreatureId) {
		if (keep.has(id)) {
			continue;
		}
		resources.root.remove(line);
		line.geometry.dispose();
		(line.material as THREE.Material).dispose();
		resources.byCreatureId.delete(id);
	}
}

export function clearAnnouncementCuePresentation(
	resources: AnnouncementCuePresentationResources
): void {
	for (const [, line] of resources.byCreatureId) {
		resources.root.remove(line);
		line.geometry.dispose();
		(line.material as THREE.Material).dispose();
	}
	resources.byCreatureId.clear();
	resources.material.dispose();
}
