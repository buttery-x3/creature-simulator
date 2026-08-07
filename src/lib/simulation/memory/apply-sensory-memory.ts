/**
 * Sensory memory writes: resource observations (post-behaviour) and heard signals
 * (post-communication).
 *
 * These are pure fixed-step apply functions invoked from step orchestration.
 * They do not interpret meaning or select intentions. Heard_signal memory is the
 * retained hearing model used by cognition for investigate_signal candidates.
 */

import type { Habitat, ResourceFeature } from '$lib/habitat';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import { distanceSquared } from '../creature-movement';
import type { Creature, SimulationConfig } from '../types';
import { isResourceAvailable } from '../resources/availability';
import { ensureCreatureMemory } from './create-memory';
import { forgetEntries, rememberHeardSignal, rememberResourceObservation } from './mutate';

export type ResourceObservationMemoryConfig = Pick<
	SimulationConfig,
	'sensingRadius' | 'perceptionIntervalSeconds'
>;

/**
 * True when behaviour ran a sensing pass this fixed step.
 * Perception sets lastUpdatedAt === timeSeconds only when senseAt executed.
 * Creatures that did not sense this step skip observation writes.
 */
export function isSensingPassThisStep(lastUpdatedAt: number, timeSeconds: number): boolean {
	return Number.isFinite(lastUpdatedAt) && lastUpdatedAt === timeSeconds;
}

/** @deprecated Use {@link isSensingPassThisStep}. */
export function isSensingPassDue(
	lastUpdatedAt: number,
	timeSeconds: number,
	_perceptionIntervalSeconds?: number
): boolean {
	void _perceptionIntervalSeconds;
	return isSensingPassThisStep(lastUpdatedAt, timeSeconds);
}

/**
 * Write/refresh resource observations for creatures that sensed this step.
 *
 * - Available food from the perception snapshot → observation (empty=false).
 * - Water geography (availableOnly: false) → observation with empty flag.
 * - Remembered food whose location is re-sensed and feature is gone → forget.
 *
 * Does not alter perception, targets, announcements, or availability semantics.
 */
export function applyResourceObservationMemories(
	creatures: readonly Creature[],
	habitat: Habitat,
	timeSeconds: number,
	config: ResourceObservationMemoryConfig
): Creature[] {
	return creatures.map((raw) => {
		const creature = ensureCreatureMemory(raw);
		if (!isSensingPassThisStep(creature.perception.lastUpdatedAt, timeSeconds)) {
			return raw;
		}

		let memory = creature.memory;

		// Food invalidation: directly re-observe remembered food locations that are gone.
		const foodIds = new Set(habitat.food.map((f) => f.id));
		const radiusSq = config.sensingRadius * config.sensingRadius;
		memory = forgetEntries(memory, (entry) => {
			if (entry.kind !== 'resource_observation' || entry.resourceKind !== 'food') {
				return false;
			}
			if (foodIds.has(entry.featureId)) {
				return false;
			}
			// Only forget when the creature is close enough to have re-inspected the place.
			return distanceSquared(creature.position, entry.position) <= radiusSq;
		});

		// Available food from current perception snapshot (already availability-filtered).
		const foodObs = creature.perception.observations
			.filter((o) => o.featureKind === 'food')
			.slice()
			.sort((a, b) => (a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0));

		for (const obs of foodObs) {
			memory = rememberResourceObservation(memory, {
				rememberedAt: timeSeconds,
				featureId: obs.featureId,
				resourceKind: 'food',
				position: { x: obs.position.x, y: obs.position.y },
				empty: false
			});
		}

		// Water geography: include empty basins without making them "available" elsewhere.
		const nearbyWater = queryFeaturesNear(
			habitat,
			creature.position,
			config.sensingRadius,
			['water'],
			{ availableOnly: false }
		) as ResourceFeature[];

		const orderedWater = [...nearbyWater].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

		for (const basin of orderedWater) {
			memory = rememberResourceObservation(memory, {
				rememberedAt: timeSeconds,
				featureId: basin.id,
				resourceKind: 'water',
				position: { x: basin.position.x, y: basin.position.y },
				empty: !isResourceAvailable(basin)
			});
		}

		if (memory === creature.memory && creature === raw) {
			return raw;
		}
		return { ...creature, memory };
	});
}

/**
 * Write heard-signal memories for signals received this fixed step.
 * Source: recentHeard with heardAt === timeSeconds (mirrors learning ingest filter).
 * Strips sender identity; dedupes by emissionId inside pure remember.
 */
export function applyHeardSignalMemories(
	creatures: readonly Creature[],
	timeSeconds: number
): Creature[] {
	return creatures.map((raw) => {
		const newlyHeard = raw.recentHeard.filter((h) => h.heardAt === timeSeconds);
		if (newlyHeard.length === 0) {
			return raw;
		}

		const creature = ensureCreatureMemory(raw);
		let memory = creature.memory;

		// Deterministic order by emissionId for multi-hear steps.
		const ordered = [...newlyHeard].sort((a, b) =>
			a.emissionId < b.emissionId ? -1 : a.emissionId > b.emissionId ? 1 : 0
		);

		for (const heard of ordered) {
			memory = rememberHeardSignal(memory, {
				rememberedAt: timeSeconds,
				emissionId: heard.emissionId,
				symbolId: heard.symbolId,
				origin: { x: heard.origin.x, y: heard.origin.y }
			});
		}

		if (memory === creature.memory && creature === raw) {
			return raw;
		}
		return { ...creature, memory };
	});
}
