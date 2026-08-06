/**
 * Resource target resolution, arrival checks, and perception-scoped food/water selection.
 *
 * Food and water targets come only from currently perceived features or a brief
 * non-expired tracked observation. Home is innate knowledge (always available).
 * Full habitat scans for discovery belong in habitat-feature-query / perception.
 */

import { featureRect, type Habitat, type HabitatFeature, type Vec2 } from '$lib/habitat';
import type {
	CreaturePerception,
	CreatureTarget,
	ResourceObservation,
	SimulationConfig
} from '../types';
import { distanceSquared } from '../creature-movement';
import { isCurrentlyPerceived, isTrackedUsable, selectNearestPerceived } from './perception';

export type TrackingConfig = Pick<SimulationConfig, 'trackedObservationDurationSeconds'>;

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
 * Food/water feature targets require current perception or a non-expired track.
 */
export function isTargetValid(
	habitat: Habitat,
	target: CreatureTarget | null,
	perception?: CreaturePerception,
	timeSeconds?: number,
	trackDurationSeconds?: number
): boolean {
	if (target === null) {
		return false;
	}
	if (target.kind === 'point') {
		return Number.isFinite(target.position.x) && Number.isFinite(target.position.y);
	}
	if (target.featureKind === 'home') {
		return resolveFeature(habitat, target) !== null;
	}
	// Food / water
	if (resolveFeature(habitat, target) === null) {
		return false;
	}
	if (perception === undefined || timeSeconds === undefined || trackDurationSeconds === undefined) {
		// Callers that only check habitat existence (tests of resolve) pass no perception.
		return true;
	}
	if (isCurrentlyPerceived(perception, target.featureId, target.featureKind)) {
		return true;
	}
	const tracked = perception.tracked;
	if (
		tracked &&
		tracked.featureId === target.featureId &&
		tracked.featureKind === target.featureKind &&
		isTrackedUsable(tracked, timeSeconds, trackDurationSeconds)
	) {
		return true;
	}
	return false;
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

/** Movement destination for the current target (feature centre or wander/search point). */
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
 * Deterministic nearest feature among a pre-filtered list: min distance², then id.
 * Callers must supply the candidate set (e.g. perceived features), not full habitat arrays.
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

function observationToTarget(obs: ResourceObservation): CreatureTarget {
	return {
		kind: 'feature',
		featureId: obs.featureId,
		featureKind: obs.featureKind
	};
}

/**
 * Select a food target from perception/track only (never global habitat scan).
 */
export function foodTarget(
	position: Vec2,
	habitat: Habitat,
	perception: CreaturePerception,
	timeSeconds: number,
	trackDurationSeconds: number
): CreatureTarget | null {
	const tracked = perception.tracked;
	if (
		tracked &&
		tracked.featureKind === 'food' &&
		isTrackedUsable(tracked, timeSeconds, trackDurationSeconds) &&
		habitat.food.some((f) => f.id === tracked.featureId)
	) {
		return observationToTarget(tracked);
	}
	const nearest = selectNearestPerceived(position, perception, 'food');
	if (!nearest) {
		return null;
	}
	if (!habitat.food.some((f) => f.id === nearest.featureId)) {
		return null;
	}
	return observationToTarget(nearest);
}

/**
 * Select a water target from perception/track only (never global habitat scan).
 */
export function waterTarget(
	position: Vec2,
	habitat: Habitat,
	perception: CreaturePerception,
	timeSeconds: number,
	trackDurationSeconds: number
): CreatureTarget | null {
	const tracked = perception.tracked;
	if (
		tracked &&
		tracked.featureKind === 'water' &&
		isTrackedUsable(tracked, timeSeconds, trackDurationSeconds) &&
		habitat.water.some((f) => f.id === tracked.featureId)
	) {
		return observationToTarget(tracked);
	}
	const nearest = selectNearestPerceived(position, perception, 'water');
	if (!nearest) {
		return null;
	}
	if (!habitat.water.some((f) => f.id === nearest.featureId)) {
		return null;
	}
	return observationToTarget(nearest);
}

export function homeTarget(habitat: Habitat): CreatureTarget {
	return { kind: 'feature', featureId: habitat.home.id, featureKind: 'home' };
}

export function pointTarget(position: Vec2): CreatureTarget {
	return { kind: 'point', position: { x: position.x, y: position.y } };
}

/** Whether a decision/action has a usable food or water feature target. */
export function hasUsableResourceTarget(
	target: CreatureTarget | null,
	habitat: Habitat,
	perception: CreaturePerception,
	timeSeconds: number,
	trackDurationSeconds: number
): boolean {
	if (!target || target.kind !== 'feature') {
		return false;
	}
	if (target.featureKind === 'home') {
		return resolveFeature(habitat, target) !== null;
	}
	return isTargetValid(habitat, target, perception, timeSeconds, trackDurationSeconds);
}
