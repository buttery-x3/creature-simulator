/**
 * Dynamic creature presentation: reconcile Three.js objects by creature id.
 *
 * Updates transforms in place during simulation steps. Does not own authoritative
 * creature state and must not rebuild static habitat geometry.
 * Visual action states derive only from authoritative `creature.action`.
 */

import * as THREE from 'three';
import type { Creature, CreatureAction } from '$lib/simulation';

/** Presentation-only upright height for creature capsules (Three.js Z). */
const CREATURE_HEIGHT = 0.55;
const CREATURE_RADIUS = 0.18;
const NOSE_LENGTH = 0.16;

const ACTION_BODY_COLOR: Record<CreatureAction, number> = {
	wander: 0xe9c46a,
	move: 0xe9c46a,
	investigate: 0xfbbf24,
	search: 0xe76f51,
	eat: 0x2a9d8f,
	drink: 0x4ea8de,
	sleep: 0x7b6b9c
};

const ACTION_NOSE_COLOR: Record<CreatureAction, number> = {
	wander: 0xf4a261,
	move: 0xf4a261,
	investigate: 0xfde68a,
	search: 0xf4a261,
	eat: 0x52b788,
	drink: 0x90e0ef,
	sleep: 0xa78bfa
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

function applyCreatureTransform(group: THREE.Group, creature: Creature): void {
	group.position.set(creature.position.x, creature.position.y, 0);
	// Facing is radians on the XY ground plane (0 = +x). Three.js rotation about Z.
	group.rotation.z = creature.facing;

	// Sleep: lower / flatter pose; other actions upright.
	if (creature.action === 'sleep') {
		group.scale.set(1.05, 1.05, 0.55);
		group.position.z = 0;
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

/**
 * Reconcile creature meshes with authoritative creature list.
 * Creates missing meshes, updates transforms, removes disposals for missing ids.
 * Does not recreate geometry on ordinary transform updates.
 */
export function reconcileCreatures(
	resources: CreaturePresentationResources,
	creatures: readonly Creature[],
	selectedCreatureId: string | null = null
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
		applyCreatureTransform(group, creature);
		if (selectedCreatureId === creature.id) {
			applySelectionHighlight(group, true);
		}
	}

	for (const [id, group] of resources.byId) {
		if (!seen.has(id)) {
			resources.root.remove(group);
			resources.byId.delete(id);
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
	for (const materials of resources.materialsById.values()) {
		materials.body.dispose();
		materials.nose.dispose();
	}
	resources.materialsById.clear();
	resources.bodyGeometry.dispose();
	resources.noseGeometry.dispose();
	resources.structureVersion += 1;
}
