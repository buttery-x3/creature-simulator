/**
 * Temporary global resource awareness.
 *
 * Creatures currently use authoritative habitat food/water/home lists when
 * selecting targets. This is an intentional simplification until perception
 * and memory exist; keep all habitat resource lookup here so a later issue can
 * replace global knowledge without rewriting the decision model.
 */

import { featureRect, type Habitat, type HabitatFeature, type Vec2 } from '$lib/habitat';
import type { CreatureTarget } from '../types';
import { distanceSquared } from '../creature-movement';

export function resolveFeature(
	habitat: Habitat,
	target: CreatureTarget | null
): HabitatFeature | null {
	if (!target || target.kind !== 'feature') {
		return null;
	}
	if (target.featureKind === 'home' && habitat.home.id === target.featureId) {
		return habitat.home;
	}
	if (target.featureKind === 'food') {
		return habitat.food.find((f) => f.id === target.featureId) ?? null;
	}
	if (target.featureKind === 'water') {
		return habitat.water.find((f) => f.id === target.featureId) ?? null;
	}
	return null;
}

export function isTargetValid(habitat: Habitat, target: CreatureTarget | null): boolean {
	if (target === null) {
		return false;
	}
	if (target.kind === 'point') {
		return Number.isFinite(target.position.x) && Number.isFinite(target.position.y);
	}
	return resolveFeature(habitat, target) !== null;
}

/**
 * True when the creature centre is inside the feature footprint expanded by
 * arrivalDistance (authoritative footprint, not presentation bush geometry).
 */
export function isAtFeature(
	position: Vec2,
	feature: HabitatFeature,
	arrivalDistance: number
): boolean {
	const rect = featureRect(feature);
	return (
		position.x >= rect.minX - arrivalDistance &&
		position.x <= rect.maxX + arrivalDistance &&
		position.y >= rect.minY - arrivalDistance &&
		position.y <= rect.maxY + arrivalDistance
	);
}

export function isAtTarget(
	position: Vec2,
	habitat: Habitat,
	target: CreatureTarget | null,
	arrivalDistance: number
): boolean {
	if (!target) {
		return false;
	}
	if (target.kind === 'point') {
		return distanceSquared(position, target.position) <= arrivalDistance * arrivalDistance;
	}
	const feature = resolveFeature(habitat, target);
	if (!feature) {
		return false;
	}
	return isAtFeature(position, feature, arrivalDistance);
}

/** Movement destination for the current target (feature centre or wander point). */
export function movementPoint(
	habitat: Habitat,
	target: CreatureTarget | null,
	fallback: Vec2
): Vec2 {
	if (!target) {
		return fallback;
	}
	if (target.kind === 'point') {
		return target.position;
	}
	const feature = resolveFeature(habitat, target);
	return feature ? feature.position : fallback;
}

/**
 * Deterministic nearest feature: min distance², then lexicographic id.
 */
export function selectNearestFeature(
	position: Vec2,
	features: readonly HabitatFeature[]
): HabitatFeature | null {
	if (features.length === 0) {
		return null;
	}
	let best = features[0]!;
	let bestDist = distanceSquared(position, best.position);
	for (let i = 1; i < features.length; i += 1) {
		const feature = features[i]!;
		const dist = distanceSquared(position, feature.position);
		if (dist < bestDist || (dist === bestDist && feature.id < best.id)) {
			best = feature;
			bestDist = dist;
		}
	}
	return best;
}

export function foodTarget(position: Vec2, habitat: Habitat): CreatureTarget | null {
	const feature = selectNearestFeature(position, habitat.food);
	if (!feature) {
		return null;
	}
	return { kind: 'feature', featureId: feature.id, featureKind: 'food' };
}

export function waterTarget(position: Vec2, habitat: Habitat): CreatureTarget | null {
	const feature = selectNearestFeature(position, habitat.water);
	if (!feature) {
		return null;
	}
	return { kind: 'feature', featureId: feature.id, featureKind: 'water' };
}

export function homeTarget(habitat: Habitat): CreatureTarget {
	return { kind: 'feature', featureId: habitat.home.id, featureKind: 'home' };
}

export function pointTarget(position: Vec2): CreatureTarget {
	return { kind: 'point', position: { x: position.x, y: position.y } };
}
