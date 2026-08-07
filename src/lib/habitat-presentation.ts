/**
 * Habitat presentation for Three.js.
 *
 * Ground/home rebuild only on full layout regeneration. Food bushes reconcile
 * by stable feature id (spawn/deplete). Water basins stay keyed by id and
 * distinguish available vs empty without continuous level animation.
 * Does not own creature presentation or authoritative simulation state.
 */

import * as THREE from 'three';
import type { Habitat, HabitatFeature, ResourceFeature } from '$lib/habitat';
import { isResourceFeature } from '$lib/habitat';

const WATER_AVAILABLE_COLOR = 0x1d4e89;
const WATER_EMPTY_COLOR = 0x6b7280;

export type HabitatPresentationResources = {
	root: THREE.Group;
	/** Static layer: ground, edges, home. */
	staticRoot: THREE.Group;
	/** Dynamic food bushes keyed by feature id. */
	foodRoot: THREE.Group;
	/** Water basins keyed by feature id. */
	waterRoot: THREE.Group;
	geometries: THREE.BufferGeometry[];
	materials: THREE.Material[];
	foodById: Map<string, THREE.Object3D>;
	waterById: Map<string, { group: THREE.Object3D; mesh: THREE.Mesh; available: boolean }>;
	/** Increments on full static rebuild only. */
	structureVersion: number;
	/** Layout identity: seed + bounds; resources may change without changing this. */
	layoutKey: string | null;
};

function trackGeometry(
	resources: HabitatPresentationResources,
	geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
	resources.geometries.push(geometry);
	return geometry;
}

function trackMaterial(
	resources: HabitatPresentationResources,
	material: THREE.Material
): THREE.Material {
	resources.materials.push(material);
	return material;
}

function disposeObject3D(obj: THREE.Object3D): void {
	obj.traverse((child) => {
		if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
			const geom = child.geometry;
			if (geom) {
				geom.dispose();
			}
			const mat = child.material;
			if (Array.isArray(mat)) {
				for (const m of mat) {
					m.dispose();
				}
			} else if (mat) {
				mat.dispose();
			}
		}
	});
}

function layoutKeyOf(data: Habitat): string {
	return `${data.seed}|${data.bounds.width}x${data.bounds.height}|${data.home.id}|${data.home.position.x},${data.home.position.y}|${data.home.size.width}x${data.home.size.height}|w:${data.water.map((w) => w.id).join(',')}`;
}

function addGround(
	resources: HabitatPresentationResources,
	boundsWidth: number,
	boundsHeight: number
): void {
	const groundGeom = trackGeometry(resources, new THREE.PlaneGeometry(boundsWidth, boundsHeight));
	const groundMat = trackMaterial(
		resources,
		new THREE.MeshBasicMaterial({
			color: 0x1b4332,
			side: THREE.DoubleSide
		})
	);
	const ground = new THREE.Mesh(groundGeom, groundMat);
	ground.name = 'ground';
	ground.position.z = -0.02;
	resources.staticRoot.add(ground);

	const edgeGeom = trackGeometry(resources, new THREE.EdgesGeometry(groundGeom));
	const edgeMat = trackMaterial(resources, new THREE.LineBasicMaterial({ color: 0xd8f3dc }));
	const edges = new THREE.LineSegments(edgeGeom, edgeMat);
	edges.name = 'world-edges';
	edges.position.z = 0.01;
	resources.staticRoot.add(edges);
}

function addHomeMarker(resources: HabitatPresentationResources, feature: HabitatFeature): void {
	const geom = trackGeometry(
		resources,
		new THREE.PlaneGeometry(feature.size.width, feature.size.height)
	);
	const mat = trackMaterial(
		resources,
		new THREE.MeshBasicMaterial({
			color: 0xc9a227,
			transparent: true,
			opacity: 0.85,
			side: THREE.DoubleSide
		})
	);
	const mesh = new THREE.Mesh(geom, mat);
	mesh.name = feature.id;
	mesh.position.set(feature.position.x, feature.position.y, 0);
	resources.staticRoot.add(mesh);

	const outlineGeom = trackGeometry(resources, new THREE.EdgesGeometry(geom));
	const outlineMat = trackMaterial(
		resources,
		new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
	);
	const outline = new THREE.LineSegments(outlineGeom, outlineMat);
	outline.position.copy(mesh.position);
	outline.position.z = 0.02;
	resources.staticRoot.add(outline);
}

function createWaterBasin(
	resources: HabitatPresentationResources,
	feature: ResourceFeature
): { group: THREE.Group; mesh: THREE.Mesh; available: boolean } {
	const available = feature.amount > 0;
	const group = new THREE.Group();
	group.name = feature.id;
	group.position.set(feature.position.x, feature.position.y, 0);

	const geom = trackGeometry(
		resources,
		new THREE.PlaneGeometry(feature.size.width, feature.size.height)
	);
	const mat = trackMaterial(
		resources,
		new THREE.MeshBasicMaterial({
			color: available ? WATER_AVAILABLE_COLOR : WATER_EMPTY_COLOR,
			transparent: true,
			opacity: available ? 0.85 : 0.45,
			side: THREE.DoubleSide
		})
	);
	const mesh = new THREE.Mesh(geom, mat);
	mesh.name = `${feature.id}-fill`;
	group.add(mesh);

	const outlineGeom = trackGeometry(resources, new THREE.EdgesGeometry(geom));
	const outlineMat = trackMaterial(
		resources,
		new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
	);
	const outline = new THREE.LineSegments(outlineGeom, outlineMat);
	outline.position.z = 0.02;
	group.add(outline);

	resources.waterRoot.add(group);
	return { group, mesh, available };
}

/**
 * Presentation-only bush: stacked geometry above the ground plane.
 * Creatures interact with the feature footprint, not these meshes.
 */
function createFoodBush(
	resources: HabitatPresentationResources,
	feature: HabitatFeature
): THREE.Group {
	const group = new THREE.Group();
	group.name = feature.id;
	group.position.set(feature.position.x, feature.position.y, 0);

	const footprint = Math.min(feature.size.width, feature.size.height);
	const trunkHeight = footprint * 0.35;
	const canopyRadius = footprint * 0.42;

	const trunkGeom = trackGeometry(
		resources,
		new THREE.CylinderGeometry(footprint * 0.08, footprint * 0.1, trunkHeight, 6)
	);
	const trunkMat = trackMaterial(resources, new THREE.MeshBasicMaterial({ color: 0x5c4033 }));
	const trunk = new THREE.Mesh(trunkGeom, trunkMat);
	trunk.rotation.x = Math.PI / 2;
	trunk.position.z = trunkHeight / 2;
	group.add(trunk);

	const canopyGeom = trackGeometry(resources, new THREE.IcosahedronGeometry(canopyRadius, 0));
	const canopyMat = trackMaterial(resources, new THREE.MeshBasicMaterial({ color: 0x2d6a4f }));
	const canopy = new THREE.Mesh(canopyGeom, canopyMat);
	canopy.position.z = trunkHeight + canopyRadius * 0.65;
	group.add(canopy);

	const canopyTopGeom = trackGeometry(
		resources,
		new THREE.IcosahedronGeometry(canopyRadius * 0.7, 0)
	);
	const canopyTopMat = trackMaterial(resources, new THREE.MeshBasicMaterial({ color: 0x40916c }));
	const canopyTop = new THREE.Mesh(canopyTopGeom, canopyTopMat);
	canopyTop.position.set(footprint * 0.08, -footprint * 0.05, trunkHeight + canopyRadius * 1.15);
	group.add(canopyTop);

	resources.foodRoot.add(group);
	return group;
}

function clearGroupChildren(group: THREE.Group): void {
	while (group.children.length > 0) {
		const child = group.children[0]!;
		group.remove(child);
		disposeObject3D(child);
	}
}

export function createHabitatPresentationResources(): HabitatPresentationResources {
	const root = new THREE.Group();
	root.name = 'habitat-root';
	const staticRoot = new THREE.Group();
	staticRoot.name = 'habitat-static';
	const foodRoot = new THREE.Group();
	foodRoot.name = 'habitat-food';
	const waterRoot = new THREE.Group();
	waterRoot.name = 'habitat-water';
	root.add(staticRoot);
	root.add(waterRoot);
	root.add(foodRoot);
	return {
		root,
		staticRoot,
		foodRoot,
		waterRoot,
		geometries: [],
		materials: [],
		foodById: new Map(),
		waterById: new Map(),
		structureVersion: 0,
		layoutKey: null
	};
}

export function clearHabitatPresentation(resources: HabitatPresentationResources): void {
	clearGroupChildren(resources.staticRoot);
	clearGroupChildren(resources.foodRoot);
	clearGroupChildren(resources.waterRoot);
	resources.foodById.clear();
	resources.waterById.clear();
	for (const geometry of resources.geometries.splice(0)) {
		geometry.dispose();
	}
	for (const material of resources.materials.splice(0)) {
		material.dispose();
	}
	resources.layoutKey = null;
}

/**
 * Full rebuild of static layout + food/water (used on seed/layout change).
 */
export function buildHabitatPresentation(
	resources: HabitatPresentationResources,
	data: Habitat
): void {
	clearHabitatPresentation(resources);
	addGround(resources, data.bounds.width, data.bounds.height);
	addHomeMarker(resources, data.home);
	for (const water of data.water) {
		if (isResourceFeature(water)) {
			const entry = createWaterBasin(resources, water);
			resources.waterById.set(water.id, entry);
		}
	}
	for (const food of data.food) {
		const bush = createFoodBush(resources, food);
		resources.foodById.set(food.id, bush);
	}
	resources.layoutKey = layoutKeyOf(data);
	resources.structureVersion += 1;
}

/**
 * Reconcile dynamic food/water against authoritative habitat without rebuilding
 * ground/home. Full rebuild only when layout identity changes.
 */
export function reconcileHabitatPresentation(
	resources: HabitatPresentationResources,
	data: Habitat
): void {
	const key = layoutKeyOf(data);
	if (resources.layoutKey !== key) {
		buildHabitatPresentation(resources, data);
		return;
	}

	// Food: add missing, remove depleted, leave mid-amount unchanged.
	const foodIds = new Set(data.food.map((f) => f.id));
	for (const [id, obj] of [...resources.foodById.entries()]) {
		if (!foodIds.has(id)) {
			resources.foodRoot.remove(obj);
			disposeObject3D(obj);
			resources.foodById.delete(id);
		}
	}
	for (const food of data.food) {
		if (!resources.foodById.has(food.id)) {
			const bush = createFoodBush(resources, food);
			resources.foodById.set(food.id, bush);
		}
	}

	// Water: create any missing (should not happen mid-run), update available colour.
	const waterIds = new Set(data.water.map((w) => w.id));
	for (const [id, entry] of [...resources.waterById.entries()]) {
		if (!waterIds.has(id)) {
			resources.waterRoot.remove(entry.group);
			disposeObject3D(entry.group);
			resources.waterById.delete(id);
		}
	}
	for (const water of data.water) {
		if (!isResourceFeature(water)) {
			continue;
		}
		const available = water.amount > 0;
		let entry = resources.waterById.get(water.id);
		if (!entry) {
			entry = createWaterBasin(resources, water);
			resources.waterById.set(water.id, entry);
			continue;
		}
		if (entry.available !== available) {
			const mat = entry.mesh.material as THREE.MeshBasicMaterial;
			mat.color.setHex(available ? WATER_AVAILABLE_COLOR : WATER_EMPTY_COLOR);
			mat.opacity = available ? 0.85 : 0.45;
			entry.available = available;
		}
	}
}
