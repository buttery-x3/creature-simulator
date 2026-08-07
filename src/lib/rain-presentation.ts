/**
 * Presentation-only rain cue. Never drives authoritative weather or refill.
 */

import * as THREE from 'three';
import type { WorldBounds } from '$lib/habitat';

export type RainPresentationResources = {
	root: THREE.Group;
	geometries: THREE.BufferGeometry[];
	materials: THREE.Material[];
	drops: THREE.LineSegments | null;
	visible: boolean;
};

const DROP_COUNT = 48;

export function createRainPresentationResources(): RainPresentationResources {
	const root = new THREE.Group();
	root.name = 'rain-presentation';
	root.visible = false;
	return {
		root,
		geometries: [],
		materials: [],
		drops: null,
		visible: false
	};
}

export function clearRainPresentation(resources: RainPresentationResources): void {
	while (resources.root.children.length > 0) {
		resources.root.remove(resources.root.children[0]!);
	}
	for (const geometry of resources.geometries.splice(0)) {
		geometry.dispose();
	}
	for (const material of resources.materials.splice(0)) {
		material.dispose();
	}
	resources.drops = null;
	resources.visible = false;
	resources.root.visible = false;
}

/**
 * Ensure rain drop geometry matches world bounds (rebuild if missing).
 */
function ensureDrops(resources: RainPresentationResources, bounds: WorldBounds): void {
	if (resources.drops) {
		return;
	}
	const halfW = bounds.width / 2;
	const halfH = bounds.height / 2;
	const positions = new Float32Array(DROP_COUNT * 2 * 3);
	// Deterministic pseudo-random placement (presentation-only; not sim RNG).
	let seed = 0x2f6e2b1;
	const next = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 0x100000000;
	};
	for (let i = 0; i < DROP_COUNT; i += 1) {
		const x = (next() * 2 - 1) * halfW * 0.95;
		const y = (next() * 2 - 1) * halfH * 0.95;
		const zTop = 1.2 + next() * 1.5;
		const zBot = zTop - 0.35;
		const base = i * 6;
		positions[base] = x;
		positions[base + 1] = y;
		positions[base + 2] = zTop;
		positions[base + 3] = x + 0.02;
		positions[base + 4] = y - 0.04;
		positions[base + 5] = zBot;
	}
	const geom = new THREE.BufferGeometry();
	geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	resources.geometries.push(geom);
	const mat = new THREE.LineBasicMaterial({
		color: 0x93c5fd,
		transparent: true,
		opacity: 0.55,
		depthWrite: false
	});
	resources.materials.push(mat);
	const lines = new THREE.LineSegments(geom, mat);
	lines.name = 'rain-drops';
	resources.root.add(lines);
	resources.drops = lines;
}

/**
 * Show or hide rain cue from authoritative weather phase.
 */
export function reconcileRainPresentation(
	resources: RainPresentationResources,
	weather: 'clear' | 'rain',
	bounds: WorldBounds
): void {
	const shouldShow = weather === 'rain';
	if (shouldShow) {
		ensureDrops(resources, bounds);
	}
	if (resources.visible === shouldShow) {
		resources.root.visible = shouldShow;
		return;
	}
	resources.visible = shouldShow;
	resources.root.visible = shouldShow;
}
