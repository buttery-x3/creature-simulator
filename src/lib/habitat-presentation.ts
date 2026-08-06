/**
 * Static habitat presentation builders for Three.js.
 *
 * Rebuild only when authoritative habitat data changes. Does not own creature
 * presentation or simulation state.
 */

import * as THREE from 'three';
import type { Habitat, HabitatFeature } from '$lib/habitat';

export type HabitatPresentationResources = {
	root: THREE.Group;
	geometries: THREE.BufferGeometry[];
	materials: THREE.Material[];
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
	resources.root.add(ground);

	const edgeGeom = trackGeometry(resources, new THREE.EdgesGeometry(groundGeom));
	const edgeMat = trackMaterial(resources, new THREE.LineBasicMaterial({ color: 0xd8f3dc }));
	const edges = new THREE.LineSegments(edgeGeom, edgeMat);
	edges.name = 'world-edges';
	edges.position.z = 0.01;
	resources.root.add(edges);
}

function addRegionMarker(
	resources: HabitatPresentationResources,
	feature: HabitatFeature,
	color: number
): void {
	const geom = trackGeometry(
		resources,
		new THREE.PlaneGeometry(feature.size.width, feature.size.height)
	);
	const mat = trackMaterial(
		resources,
		new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: 0.85,
			side: THREE.DoubleSide
		})
	);
	const mesh = new THREE.Mesh(geom, mat);
	mesh.name = feature.id;
	mesh.position.set(feature.position.x, feature.position.y, 0);
	resources.root.add(mesh);

	const outlineGeom = trackGeometry(resources, new THREE.EdgesGeometry(geom));
	const outlineMat = trackMaterial(
		resources,
		new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
	);
	const outline = new THREE.LineSegments(outlineGeom, outlineMat);
	outline.position.copy(mesh.position);
	outline.position.z = 0.02;
	resources.root.add(outline);
}

/**
 * Presentation-only bush: stacked geometry above the ground plane.
 * Creatures interact with the feature footprint, not these meshes.
 */
function addFoodBush(resources: HabitatPresentationResources, feature: HabitatFeature): void {
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

	resources.root.add(group);
}

export function createHabitatPresentationResources(): HabitatPresentationResources {
	const root = new THREE.Group();
	root.name = 'habitat-root';
	return { root, geometries: [], materials: [] };
}

export function clearHabitatPresentation(resources: HabitatPresentationResources): void {
	while (resources.root.children.length > 0) {
		resources.root.remove(resources.root.children[0]!);
	}
	for (const geometry of resources.geometries.splice(0)) {
		geometry.dispose();
	}
	for (const material of resources.materials.splice(0)) {
		material.dispose();
	}
}

/**
 * Rebuild static habitat meshes from authoritative data.
 * Returns a build generation counter callers can use to detect rebuilds.
 */
export function buildHabitatPresentation(
	resources: HabitatPresentationResources,
	data: Habitat
): void {
	clearHabitatPresentation(resources);
	addGround(resources, data.bounds.width, data.bounds.height);
	addRegionMarker(resources, data.home, 0xc9a227);
	for (const water of data.water) {
		addRegionMarker(resources, water, 0x1d4e89);
	}
	for (const food of data.food) {
		addFoodBush(resources, food);
	}
}
