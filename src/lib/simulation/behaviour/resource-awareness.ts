/**
 * Resource target resolution, arrival checks, and habitat feature helpers.
 *
 * Need targets come from cognition (perception + memory). This module only
 * validates habitat existence/availability and supports executor movement.
 */

import { featureRect, type Habitat, type HabitatFeature, type Vec2 } from '$lib/habitat';
import { distanceSquared, sampleSearchTarget } from '../creature-movement';
import { isResourceAvailable } from '../resources/availability';
import type { Creature, CreatureTarget, SimulationConfig } from '../types';

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

/**
 * True when the target is a usable pursuit destination.
 * Food/water feature targets must exist and be currently available (amount > 0).
 * Remembered resources are valid while the habitat feature still has supply —
 * perception is not required (memory-driven pursuit).
 */
export function isTargetValid(habitat: Habitat, target: CreatureTarget | null): boolean {
	if (target === null) {
		return false;
	}
	if (target.kind === 'point') {
		return Number.isFinite(target.position.x) && Number.isFinite(target.position.y);
	}
	if (target.featureKind === 'home') {
		return resolveFeature(habitat, target) !== null;
	}
	const feature = resolveFeature(habitat, target);
	return feature !== null && isResourceAvailable(feature);
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
	const minX = rect.minX - arrivalDistance;
	const maxX = rect.maxX + arrivalDistance;
	const minY = rect.minY - arrivalDistance;
	const maxY = rect.maxY + arrivalDistance;
	return position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY;
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

export function pointTarget(position: Vec2): CreatureTarget {
	return { kind: 'point', position: { x: position.x, y: position.y } };
}

export function foodTarget(featureId: string): CreatureTarget {
	return { kind: 'feature', featureId, featureKind: 'food' };
}

export function waterTarget(featureId: string): CreatureTarget {
	return { kind: 'feature', featureId, featureKind: 'water' };
}

export function homeTarget(habitat: Habitat): CreatureTarget {
	return {
		kind: 'feature',
		featureId: habitat.home.id,
		featureKind: 'home'
	};
}

/** Movement destination for the current target (feature centre or point). */
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
 * Ensure search action has a sampled search destination.
 */
export function ensureSearchTarget(
	creature: Pick<Creature, 'id' | 'searchTarget' | 'searchDecisionIndex' | 'target' | 'action'>,
	simulationSeed: string,
	habitat: Habitat,
	config: Pick<SimulationConfig, 'creatureRadius'>
): Pick<Creature, 'searchTarget' | 'searchDecisionIndex' | 'target'> {
	if (creature.target?.kind === 'point' && creature.action === 'search') {
		return {
			searchTarget: creature.target.position,
			searchDecisionIndex: creature.searchDecisionIndex,
			target: creature.target
		};
	}
	const searchDecisionIndex = creature.searchDecisionIndex + 1;
	const searchTarget = sampleSearchTarget(
		simulationSeed,
		creature.id,
		searchDecisionIndex,
		habitat.bounds,
		config.creatureRadius
	);
	return {
		searchTarget,
		searchDecisionIndex,
		target: pointTarget(searchTarget)
	};
}

/**
 * Nearest habitat feature of kind by distance² then id (full habitat scan).
 * Prefer perception-scoped helpers for discovery; this remains for tests/utilities.
 */
export function selectNearestFeature(
	position: Vec2,
	habitat: Habitat,
	kind: 'food' | 'water' | 'home'
): HabitatFeature | null {
	const list: HabitatFeature[] =
		kind === 'home' ? [habitat.home] : kind === 'food' ? habitat.food : habitat.water;
	if (list.length === 0) {
		return null;
	}
	let best = list[0]!;
	let bestDist = distanceSquared(position, best.position);
	for (let i = 1; i < list.length; i += 1) {
		const feature = list[i]!;
		const dist = distanceSquared(position, feature.position);
		if (dist < bestDist || (dist === bestDist && feature.id < best.id)) {
			best = feature;
			bestDist = dist;
		}
	}
	return best;
}

/** Whether the creature currently has a usable feature target for its need intention. */
export function hasUsableResourceTarget(habitat: Habitat, target: CreatureTarget | null): boolean {
	return isTargetValid(habitat, target);
}
