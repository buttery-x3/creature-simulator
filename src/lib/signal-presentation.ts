/**
 * Dynamic signal presentation: reconcile Three.js objects by emission id.
 *
 * Visuals derive only from authoritative active emissions. Presentation does not
 * determine reception or lifetime — when an emission leaves activeEmissions, its
 * mesh is removed.
 */

import * as THREE from 'three';
import type { SignalEmission, SymbolId } from '$lib/simulation';

const MARKER_HEIGHT = 0.85;
const MARKER_RADIUS = 0.12;

const SYMBOL_COLORS: Record<SymbolId, number> = {
	'glyph-0': 0xfbbf24,
	'glyph-1': 0x34d399,
	'glyph-2': 0x60a5fa,
	'glyph-3': 0xf472b6
};

export type SignalPresentationResources = {
	root: THREE.Group;
	markerGeometry: THREE.BufferGeometry;
	ringGeometry: THREE.BufferGeometry;
	byId: Map<string, THREE.Group>;
	materialsById: Map<string, { marker: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial }>;
	structureVersion: number;
};

export function createSignalPresentationResources(): SignalPresentationResources {
	const root = new THREE.Group();
	root.name = 'signals-root';

	const markerGeometry = new THREE.SphereGeometry(MARKER_RADIUS, 8, 6);
	const ringGeometry = new THREE.RingGeometry(0.9, 1.05, 32);

	return {
		root,
		markerGeometry,
		ringGeometry,
		byId: new Map(),
		materialsById: new Map(),
		structureVersion: 0
	};
}

function createSignalGroup(
	resources: SignalPresentationResources,
	emission: SignalEmission
): THREE.Group {
	const group = new THREE.Group();
	group.name = emission.id;
	group.userData.emissionId = emission.id;
	group.userData.presentationOnly = true;

	const color = SYMBOL_COLORS[emission.symbolId] ?? 0xffffff;
	const markerMaterial = new THREE.MeshBasicMaterial({ color });
	const ringMaterial = new THREE.MeshBasicMaterial({
		color,
		transparent: true,
		opacity: 0.45,
		side: THREE.DoubleSide,
		depthWrite: false
	});
	resources.materialsById.set(emission.id, { marker: markerMaterial, ring: ringMaterial });

	const marker = new THREE.Mesh(resources.markerGeometry, markerMaterial);
	marker.name = `${emission.id}-marker`;
	marker.position.set(0, 0, MARKER_HEIGHT);

	const ring = new THREE.Mesh(resources.ringGeometry, ringMaterial);
	ring.name = `${emission.id}-ring`;
	ring.position.set(0, 0, 0.03);

	group.add(marker);
	group.add(ring);
	return group;
}

function applySignalTransform(
	group: THREE.Group,
	emission: SignalEmission,
	timeSeconds: number
): void {
	group.position.set(emission.origin.x, emission.origin.y, 0);

	const lifetime = Math.max(1e-6, emission.expiresAt - emission.emittedAt);
	const age = Math.max(0, timeSeconds - emission.emittedAt);
	const t = Math.min(1, age / lifetime);
	// Expanding ring: start small, grow with age.
	const scale = 0.4 + t * 2.2;
	const ring = group.children.find((c) => c.name.endsWith('-ring'));
	if (ring) {
		ring.scale.set(scale, scale, 1);
	}
	const materials = group.userData as { opacitySync?: boolean };
	void materials;
	const ringMesh = ring as THREE.Mesh | undefined;
	if (ringMesh && ringMesh.material instanceof THREE.MeshBasicMaterial) {
		ringMesh.material.opacity = 0.5 * (1 - t);
	}
}

/**
 * Reconcile signal meshes to match authoritative active emissions.
 * Updates transforms in place; creates/disposes only when the id set changes.
 */
export function reconcileSignals(
	resources: SignalPresentationResources,
	emissions: readonly SignalEmission[],
	timeSeconds: number
): void {
	const seen = new Set<string>();

	for (const emission of emissions) {
		seen.add(emission.id);
		let group = resources.byId.get(emission.id);
		if (!group) {
			group = createSignalGroup(resources, emission);
			resources.byId.set(emission.id, group);
			resources.root.add(group);
			resources.structureVersion += 1;
		}
		applySignalTransform(group, emission, timeSeconds);
	}

	for (const [id, group] of resources.byId) {
		if (seen.has(id)) {
			continue;
		}
		resources.root.remove(group);
		resources.byId.delete(id);
		const mats = resources.materialsById.get(id);
		if (mats) {
			mats.marker.dispose();
			mats.ring.dispose();
			resources.materialsById.delete(id);
		}
		resources.structureVersion += 1;
	}
}

export function clearSignalPresentation(resources: SignalPresentationResources): void {
	for (const [id, group] of resources.byId) {
		resources.root.remove(group);
		const mats = resources.materialsById.get(id);
		if (mats) {
			mats.marker.dispose();
			mats.ring.dispose();
		}
		void id;
	}
	resources.byId.clear();
	resources.materialsById.clear();
	resources.markerGeometry.dispose();
	resources.ringGeometry.dispose();
	resources.structureVersion += 1;
}
