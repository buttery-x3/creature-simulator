/**
 * Dynamic creature presentation: reconcile Three.js objects by creature id.
 *
 * Updates transforms in place during simulation steps. Does not own authoritative
 * creature state and must not rebuild static habitat geometry.
 * Visual action states derive only from authoritative `creature.action`.
 *
 * Investigation hop is presentation-only vertical motion triggered once when a
 * creature commits to a new activeInvestigation (emissionId + startedAt key).
 * Hearing a signal alone never hops. Authoritative position is never modified.
 */

import * as THREE from 'three';
import type { Creature, CreatureAction } from '$lib/simulation';

/** Presentation-only upright height for creature capsules (Three.js Z). */
const CREATURE_HEIGHT = 0.55;
const CREATURE_RADIUS = 0.18;
const NOSE_LENGTH = 0.16;

/** One-shot hop height (presentation Z) and duration (simulation seconds). */
export const INVESTIGATION_HOP_HEIGHT = 0.28;
export const INVESTIGATION_HOP_DURATION_SECONDS = 0.35;

const ACTION_BODY_COLOR: Record<CreatureAction, number> = {
	explore: 0xe9c46a,
	move: 0xe9c46a,
	investigate: 0xfbbf24,
	search: 0xe76f51,
	eat: 0x2a9d8f,
	drink: 0x4ea8de,
	sleep: 0x7b6b9c
};

const ACTION_NOSE_COLOR: Record<CreatureAction, number> = {
	explore: 0xf4a261,
	move: 0xf4a261,
	investigate: 0xfde68a,
	search: 0xf4a261,
	eat: 0x52b788,
	drink: 0x90e0ef,
	sleep: 0xa78bfa
};

type HopState = {
	/** Stable key for the commitment that started this hop. */
	key: string;
	/** Simulation time when the hop presentation began. */
	startedAt: number;
};

export type CreaturePresentationResources = {
	root: THREE.Group;
	/** Shared geometry used by all creatures; disposed with the resource set. */
	bodyGeometry: THREE.BufferGeometry;
	noseGeometry: THREE.BufferGeometry;
	/** Live meshes keyed by creature id. */
	byId: Map<string, THREE.Group>;
	/** Per-creature materials (action colors); disposed with the resource set. */
	materialsById: Map<string, { body: THREE.MeshBasicMaterial; nose: THREE.MeshBasicMaterial }>;
	/** Presentation-only hop state; never written to simulation. */
	hopById: Map<string, HopState>;
	/** Increments when a creature mesh is created or removed (not on transform updates). */
	structureVersion: number;
};

export function createCreaturePresentationResources(): CreaturePresentationResources {
	const root = new THREE.Group();
	root.name = 'creatures-root';

	// Capsule is Y-up in Three; we rotate so upright rises along presentation Z.
	const bodyGeometry = new THREE.CapsuleGeometry(CREATURE_RADIUS, CREATURE_HEIGHT * 0.55, 3, 8);
	const noseGeometry = new THREE.ConeGeometry(CREATURE_RADIUS * 0.45, NOSE_LENGTH, 6);

	return {
		root,
		bodyGeometry,
		noseGeometry,
		byId: new Map(),
		materialsById: new Map(),
		hopById: new Map(),
		structureVersion: 0
	};
}

function createCreatureGroup(
	resources: CreaturePresentationResources,
	id: string,
	action: CreatureAction
): THREE.Group {
	const group = new THREE.Group();
	group.name = id;
	group.userData.creatureId = id;

	const bodyMaterial = new THREE.MeshBasicMaterial({ color: ACTION_BODY_COLOR[action] });
	const noseMaterial = new THREE.MeshBasicMaterial({ color: ACTION_NOSE_COLOR[action] });
	resources.materialsById.set(id, { body: bodyMaterial, nose: noseMaterial });

	const body = new THREE.Mesh(resources.bodyGeometry, bodyMaterial);
	body.name = `${id}-body`;
	// Capsule Y-up → rotate so height rises along Z.
	body.rotation.x = Math.PI / 2;
	body.position.z = CREATURE_HEIGHT * 0.45;
	group.add(body);

	const nose = new THREE.Mesh(resources.noseGeometry, noseMaterial);
	nose.name = `${id}-nose`;
	// Cone points +Y by default; lay it along +X (facing 0) on the ground plane.
	nose.rotation.z = -Math.PI / 2;
	nose.position.set(CREATURE_RADIUS + NOSE_LENGTH * 0.35, 0, CREATURE_HEIGHT * 0.45);
	group.add(nose);

	return group;
}

/** Build a stable hop key from active investigation fields. */
export function investigationHopKey(investigation: Creature['activeInvestigation']): string | null {
	if (!investigation) {
		return null;
	}
	return `${investigation.emissionId}@${investigation.startedAt}`;
}

/**
 * Ease for rise-and-settle hop: 0 → peak → 0 over [0, 1].
 * Exported for unit tests.
 */
export function hopHeightFactor(progress: number): number {
	const t = Math.max(0, Math.min(1, progress));
	// Smooth sine hump (no continuous bounce).
	return Math.sin(t * Math.PI);
}

function applyCreatureTransform(group: THREE.Group, creature: Creature, hopOffsetZ: number): void {
	group.position.set(creature.position.x, creature.position.y, hopOffsetZ);
	// Facing is radians on the XY ground plane (0 = +x). Three.js rotation about Z.
	group.rotation.z = creature.facing;

	// Sleep: lower / flatter pose; other actions upright.
	if (creature.action === 'sleep') {
		group.scale.set(1.05, 1.05, 0.55);
	} else {
		group.scale.set(1, 1, 1);
	}
}

function applyActionMaterials(
	resources: CreaturePresentationResources,
	id: string,
	action: CreatureAction
): void {
	const materials = resources.materialsById.get(id);
	if (!materials) {
		return;
	}
	materials.body.color.setHex(ACTION_BODY_COLOR[action]);
	materials.nose.color.setHex(ACTION_NOSE_COLOR[action]);
}

function applySelectionHighlight(group: THREE.Group, selected: boolean): void {
	// Mild non-authoritative ring scale cue; does not affect simulation.
	if (selected) {
		group.scale.x *= 1.12;
		group.scale.y *= 1.12;
	}
}

function resolveHopOffset(
	resources: CreaturePresentationResources,
	creature: Creature,
	timeSeconds: number
): number {
	const key = investigationHopKey(creature.activeInvestigation);
	if (!key) {
		// No active investigation: leave any finished hop state until creature gone.
		const existing = resources.hopById.get(creature.id);
		if (existing) {
			const age = timeSeconds - existing.startedAt;
			if (age >= INVESTIGATION_HOP_DURATION_SECONDS) {
				resources.hopById.delete(creature.id);
				return 0;
			}
			return hopHeightFactor(age / INVESTIGATION_HOP_DURATION_SECONDS) * INVESTIGATION_HOP_HEIGHT;
		}
		return 0;
	}

	let hop = resources.hopById.get(creature.id);
	if (!hop || hop.key !== key) {
		// New commitment — start exactly one hop.
		hop = { key, startedAt: timeSeconds };
		resources.hopById.set(creature.id, hop);
	}

	const age = timeSeconds - hop.startedAt;
	if (age >= INVESTIGATION_HOP_DURATION_SECONDS) {
		return 0;
	}
	return hopHeightFactor(age / INVESTIGATION_HOP_DURATION_SECONDS) * INVESTIGATION_HOP_HEIGHT;
}

/**
 * Reconcile creature meshes with authoritative creature list.
 * Creates missing meshes, updates transforms, removes disposals for missing ids.
 * Does not recreate geometry on ordinary transform updates.
 *
 * @param timeSeconds simulation time for hop animation (presentation only)
 */
export function reconcileCreatures(
	resources: CreaturePresentationResources,
	creatures: readonly Creature[],
	selectedCreatureId: string | null = null,
	timeSeconds = 0
): void {
	const seen = new Set<string>();

	for (const creature of creatures) {
		seen.add(creature.id);
		let group = resources.byId.get(creature.id);
		if (!group) {
			group = createCreatureGroup(resources, creature.id, creature.action);
			resources.root.add(group);
			resources.byId.set(creature.id, group);
			resources.structureVersion += 1;
		}
		applyActionMaterials(resources, creature.id, creature.action);
		const hopZ = resolveHopOffset(resources, creature, timeSeconds);
		applyCreatureTransform(group, creature, hopZ);
		if (selectedCreatureId === creature.id) {
			applySelectionHighlight(group, true);
		}
	}

	for (const [id, group] of resources.byId) {
		if (!seen.has(id)) {
			resources.root.remove(group);
			resources.byId.delete(id);
			resources.hopById.delete(id);
			const materials = resources.materialsById.get(id);
			if (materials) {
				materials.body.dispose();
				materials.nose.dispose();
				resources.materialsById.delete(id);
			}
			resources.structureVersion += 1;
		}
	}
}

export function clearCreaturePresentation(resources: CreaturePresentationResources): void {
	for (const [, group] of resources.byId) {
		resources.root.remove(group);
	}
	resources.byId.clear();
	resources.hopById.clear();
	for (const materials of resources.materialsById.values()) {
		materials.body.dispose();
		materials.nose.dispose();
	}
	resources.materialsById.clear();
	resources.bodyGeometry.dispose();
	resources.noseGeometry.dispose();
	resources.structureVersion += 1;
}
