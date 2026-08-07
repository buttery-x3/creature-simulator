/**
 * Local sensing and brief tracked-observation lifecycle.
 *
 * Home is innate knowledge and is never stored in perception.
 * There is no permanent resource memory map — only a current snapshot and
 * at most one tracked pursuit observation.
 *
 * Per-feature perception episodes: a continuous interval while a specific
 * food/water feature stays in the perceived snapshot. Episode begin/end drives
 * announcement opportunity eligibility (one opportunity per episode).
 */

import type { Habitat, HabitatFeature, Vec2 } from '$lib/habitat';
import type {
	NewlyPerceivedResource,
	ResourceFeaturePerceptionEpisode
} from '../announcement/types';
import { distanceSquared } from '../creature-movement';
import type { Creature, CreaturePerception, ResourceObservation, SimulationConfig } from '../types';
import { queryFeaturesNear } from './habitat-feature-query';

export type PerceptionConfig = Pick<
	SimulationConfig,
	'sensingRadius' | 'perceptionIntervalSeconds' | 'trackedObservationDurationSeconds'
>;

/** Sentinel: perception has never been updated (JSON-safe; not -Infinity). */
export const PERCEPTION_NEVER_UPDATED = -1;

export function emptyPerception(lastUpdatedAt = PERCEPTION_NEVER_UPDATED): CreaturePerception {
	return {
		lastUpdatedAt,
		perceivedFoodIds: [],
		perceivedWaterIds: [],
		observations: [],
		tracked: null,
		activeEpisodes: [],
		episodeCounter: 0
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

export function isTrackedUsable(
	tracked: ResourceObservation | null,
	timeSeconds: number,
	durationSeconds: number
): boolean {
	if (!tracked) {
		return false;
	}
	return timeSeconds - tracked.observedAt <= durationSeconds;
}

function nextEpisodeId(creatureId: string, featureId: string, counter: number): string {
	return `ep-${creatureId}-${featureId}-${counter}`;
}

/**
 * Reconcile continuous per-feature perception episodes against a new observation snapshot.
 * Newly perceived features (not in previous episode set) receive new episode ids.
 */
export function reconcileResourceEpisodes(input: {
	previousEpisodes: readonly ResourceFeaturePerceptionEpisode[];
	episodeCounter: number;
	observations: readonly ResourceObservation[];
	creatureId: string;
	timeSeconds: number;
}): {
	activeEpisodes: ResourceFeaturePerceptionEpisode[];
	episodeCounter: number;
	newlyPerceived: NewlyPerceivedResource[];
} {
	const previousByFeature = new Map(input.previousEpisodes.map((e) => [e.featureId, e]));
	const activeEpisodes: ResourceFeaturePerceptionEpisode[] = [];
	const newlyPerceived: NewlyPerceivedResource[] = [];
	let episodeCounter = input.episodeCounter;

	// Deterministic observation order by feature id for stable multi-enter processing.
	const ordered = [...input.observations].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);

	for (const obs of ordered) {
		const prev = previousByFeature.get(obs.featureId);
		if (prev && prev.resourceKind === obs.featureKind) {
			// Continuous episode — keep same identity.
			activeEpisodes.push(prev);
			continue;
		}
		const episodeId = nextEpisodeId(input.creatureId, obs.featureId, episodeCounter);
		episodeCounter += 1;
		const episode: ResourceFeaturePerceptionEpisode = {
			episodeId,
			featureId: obs.featureId,
			resourceKind: obs.featureKind,
			startedAt: input.timeSeconds
		};
		activeEpisodes.push(episode);
		newlyPerceived.push({
			featureId: obs.featureId,
			resourceKind: obs.featureKind,
			position: { x: obs.position.x, y: obs.position.y },
			perceptionEpisodeId: episodeId,
			discoveredAt: input.timeSeconds
		});
	}

	return { activeEpisodes, episodeCounter, newlyPerceived };
}

export type PerceptionStepResult = {
	perception: CreaturePerception;
	/** Features that entered perception this sensing pass (sorted by feature id). */
	newlyPerceived: NewlyPerceivedResource[];
};

/**
 * Refresh perception when the interval has elapsed (or never updated).
 * Reacquiring a tracked feature on a sensing pass refreshes its observation time.
 * Updates per-feature perception episodes and reports newly perceived resources.
 */
export function updatePerception(
	perception: CreaturePerception,
	position: Vec2,
	habitat: Habitat,
	timeSeconds: number,
	config: PerceptionConfig,
	creatureId: string
): PerceptionStepResult {
	const neverUpdated = perception.lastUpdatedAt < 0 || !Number.isFinite(perception.lastUpdatedAt);
	const due =
		neverUpdated || timeSeconds - perception.lastUpdatedAt >= config.perceptionIntervalSeconds;
	if (!due) {
		return { perception, newlyPerceived: [] };
	}
	return senseAt(position, habitat, timeSeconds, config, perception, creatureId);
}

/**
 * Force a sensing pass at the creature position (used by tests and updatePerception).
 * When previous perception is provided, episodes are reconciled continuously.
 */
export function senseAt(
	position: Vec2,
	habitat: Habitat,
	timeSeconds: number,
	config: Pick<PerceptionConfig, 'sensingRadius'>,
	previousPerception: CreaturePerception | null = null,
	creatureId = 'unknown'
): PerceptionStepResult {
	const previousTracked = previousPerception?.tracked ?? null;
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

	let tracked = previousTracked;
	if (tracked) {
		const reacquired = observations.find((o) => o.featureId === tracked!.featureId);
		if (reacquired) {
			tracked = { ...reacquired };
		}
	}

	const episodeState = reconcileResourceEpisodes({
		previousEpisodes: previousPerception?.activeEpisodes ?? [],
		episodeCounter: previousPerception?.episodeCounter ?? 0,
		observations,
		creatureId,
		timeSeconds
	});

	return {
		perception: {
			lastUpdatedAt: timeSeconds,
			perceivedFoodIds,
			perceivedWaterIds,
			observations,
			tracked,
			activeEpisodes: episodeState.activeEpisodes,
			episodeCounter: episodeState.episodeCounter
		},
		newlyPerceived: episodeState.newlyPerceived
	};
}

export function startTracking(
	perception: CreaturePerception,
	observation: ResourceObservation
): CreaturePerception {
	return {
		...perception,
		tracked: {
			featureId: observation.featureId,
			featureKind: observation.featureKind,
			position: { x: observation.position.x, y: observation.position.y },
			observedAt: observation.observedAt
		}
	};
}

export function clearTracked(perception: CreaturePerception): CreaturePerception {
	if (!perception.tracked) {
		return perception;
	}
	return { ...perception, tracked: null };
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
