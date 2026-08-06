/**
 * Dynamic creature presentation: reconcile Three.js objects by creature id.
 *
 * Updates transforms in place during simulation steps. Does not own authoritative
 * creature state and must not rebuild static habitat geometry.
 */

import * as THREE from 'three';
import type { Creature } from '$lib/simulation';

/** Presentation-only upright height for creature capsules (Three.js Z). */
const CREATURE_HEIGHT = 0.55;
const CREATURE_RADIUS = 0.18;
const NOSE_LENGTH = 0.16;

export type CreaturePresentationResources = {
	root: THREE.Group;
	/** Shared geometry used by all creatures; disposed with the resource set. */
	bodyGeometry: THREE.BufferGeometry;
	noseGeometry: THREE.BufferGeometry;
	/** Shared material; disposed with the resource set. */
	bodyMaterial: THREE.Material;
	noseMaterial: THREE.Material;
	/** Live meshes keyed by creature id. */
	byId: Map<string, THREE.Group>;
	/** Increments when a creature mesh is created or removed (not on transform updates). */
	structureVersion: number;
};

export function createCreaturePresentationResources(): CreaturePresentationResources {
	const root = new THREE.Group();
	root.name = 'creatures-root';

	// Capsule is Y-up in Three; we rotate so upright rises along presentation Z.
	const bodyGeometry = new THREE.CapsuleGeometry(CREATURE_RADIUS, CREATURE_HEIGHT * 0.55, 3, 8);
	const noseGeometry = new THREE.ConeGeometry(CREATURE_RADIUS * 0.45, NOSE_LENGTH, 6);
	const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xe9c46a });
	const noseMaterial = new THREE.MeshBasicMaterial({ color: 0xf4a261 });

	return {
		root,
		bodyGeometry,
		noseGeometry,
		bodyMaterial,
		noseMaterial,
		byId: new Map(),
		structureVersion: 0
	};
}

function createCreatureGroup(resources: CreaturePresentationResources, id: string): THREE.Group {
	const group = new THREE.Group();
	group.name = id;
	group.userData.creatureId = id;

	const body = new THREE.Mesh(resources.bodyGeometry, resources.bodyMaterial);
	body.name = `${id}-body`;
	// Capsule Y-up → rotate so height rises along Z.
	body.rotation.x = Math.PI / 2;
	body.position.z = CREATURE_HEIGHT * 0.45;
	group.add(body);

	const nose = new THREE.Mesh(resources.noseGeometry, resources.noseMaterial);
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
}

/**
 * Reconcile creature meshes with authoritative creature list.
 * Creates missing meshes, updates transforms, removes disposals for missing ids.
 * Does not recreate geometry/materials on ordinary transform updates.
 */
export function reconcileCreatures(
	resources: CreaturePresentationResources,
	creatures: readonly Creature[]
): void {
	const seen = new Set<string>();

	for (const creature of creatures) {
		seen.add(creature.id);
		let group = resources.byId.get(creature.id);
		if (!group) {
			group = createCreatureGroup(resources, creature.id);
			resources.root.add(group);
			resources.byId.set(creature.id, group);
			resources.structureVersion += 1;
		}
		applyCreatureTransform(group, creature);
	}

	for (const [id, group] of resources.byId) {
		if (!seen.has(id)) {
			resources.root.remove(group);
			resources.byId.delete(id);
			resources.structureVersion += 1;
		}
	}
}

export function clearCreaturePresentation(resources: CreaturePresentationResources): void {
	for (const [, group] of resources.byId) {
		resources.root.remove(group);
	}
	resources.byId.clear();
	resources.bodyGeometry.dispose();
	resources.noseGeometry.dispose();
	resources.bodyMaterial.dispose();
	resources.noseMaterial.dispose();
	resources.structureVersion += 1;
}
