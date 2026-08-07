/**
 * Local sensing for the current perception snapshot.
 *
 * Home is innate knowledge and is never stored in perception.
 * Long-term resource locations live in creature memory, not here.
 */

import type { Habitat, HabitatFeature, Vec2 } from '$lib/habitat';
import { distanceSquared } from '../creature-movement';
import type { Creature, CreaturePerception, ResourceObservation, SimulationConfig } from '../types';
import { queryFeaturesNear } from './habitat-feature-query';

export type PerceptionConfig = Pick<
	SimulationConfig,
	'sensingRadius' | 'perceptionIntervalSeconds'
>;

/** Sentinel: perception has never been updated (JSON-safe; not -Infinity). */
export const PERCEPTION_NEVER_UPDATED = -1;

export function emptyPerception(lastUpdatedAt = PERCEPTION_NEVER_UPDATED): CreaturePerception {
	return {
		lastUpdatedAt,
		perceivedFoodIds: [],
		perceivedWaterIds: [],
		observations: []
	};
}

function observationFromFeature(
	feature: HabitatFeature,
	timeSeconds: number
): ResourceObservation | null {
	if (feature.kind !== 'food' && feature.kind !== 'water') {
		return null;
	}
	return {
		featureId: feature.id,
		featureKind: feature.kind,
		position: { x: feature.position.x, y: feature.position.y },
		observedAt: timeSeconds
	};
}

export type PerceptionStepResult = {
	perception: CreaturePerception;
	/** True when a sensing pass ran this call. */
	sensed: boolean;
};

/**
 * Refresh perception when the interval has elapsed (or never updated).
 */
export function updatePerception(
	perception: CreaturePerception,
	position: Vec2,
	habitat: Habitat,
	timeSeconds: number,
	config: PerceptionConfig
): PerceptionStepResult {
	const neverUpdated = perception.lastUpdatedAt < 0 || !Number.isFinite(perception.lastUpdatedAt);
	const due =
		neverUpdated || timeSeconds - perception.lastUpdatedAt >= config.perceptionIntervalSeconds;
	if (!due) {
		return { perception, sensed: false };
	}
	return { ...senseAt(position, habitat, timeSeconds, config), sensed: true };
}

/**
 * Force a sensing pass at the creature position (used by tests and updatePerception).
 */
export function senseAt(
	position: Vec2,
	habitat: Habitat,
	timeSeconds: number,
	config: Pick<PerceptionConfig, 'sensingRadius'>
): PerceptionStepResult {
	const nearby = queryFeaturesNear(habitat, position, config.sensingRadius, ['food', 'water']);
	const observations: ResourceObservation[] = [];
	const perceivedFoodIds: string[] = [];
	const perceivedWaterIds: string[] = [];

	for (const feature of nearby) {
		const obs = observationFromFeature(feature, timeSeconds);
		if (!obs) {
			continue;
		}
		observations.push(obs);
		if (obs.featureKind === 'food') {
			perceivedFoodIds.push(obs.featureId);
		} else {
			perceivedWaterIds.push(obs.featureId);
		}
	}

	return {
		perception: {
			lastUpdatedAt: timeSeconds,
			perceivedFoodIds,
			perceivedWaterIds,
			observations
		},
		sensed: true
	};
}

/**
 * Nearest currently perceived observation of the given kind (distance², then id).
 * Does not scan the full habitat — only the perception snapshot.
 */
export function selectNearestPerceived(
	position: Vec2,
	perception: CreaturePerception,
	kind: 'food' | 'water'
): ResourceObservation | null {
	const candidates = perception.observations.filter((o) => o.featureKind === kind);
	if (candidates.length === 0) {
		return null;
	}
	let best = candidates[0]!;
	let bestDist = distanceSquared(position, best.position);
	for (let i = 1; i < candidates.length; i += 1) {
		const candidate = candidates[i]!;
		const dist = distanceSquared(position, candidate.position);
		if (dist < bestDist || (dist === bestDist && candidate.featureId < best.featureId)) {
			best = candidate;
			bestDist = dist;
		}
	}
	return best;
}

/** Whether the feature id is in the current perceived snapshot. */
export function isCurrentlyPerceived(
	perception: CreaturePerception,
	featureId: string,
	kind: 'food' | 'water'
): boolean {
	const ids = kind === 'food' ? perception.perceivedFoodIds : perception.perceivedWaterIds;
	return ids.includes(featureId);
}

export function perceptionFromCreature(creature: Pick<Creature, 'perception'>): CreaturePerception {
	return creature.perception;
}
