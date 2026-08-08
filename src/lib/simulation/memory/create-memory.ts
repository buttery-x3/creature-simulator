/**
 * Memory creation and deterministic capacity sampling.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Creature } from '../types';
import type { CreatureMemory } from './types';

/** Seed channel for independent per-creature memory capacity. */
export const MEMORY_CAPACITY_CHANNEL = 'memory-capacity';

/** Used when repairing creatures that lack a valid memory container. */
export const DEFAULT_FALLBACK_MEMORY_CAPACITY = 1;

/**
 * Empty memory with the given capacity.
 * Capacity must be a positive integer; callers validate at creation config time.
 */
export function createEmptyMemory(capacity: number): CreatureMemory {
	return {
		capacity,
		nextSequence: 0,
		entries: []
	};
}

/**
 * True when memory is a usable authoritative container.
 * Invalid/missing containers must be repaired before query/mutation.
 */
export function isValidCreatureMemory(
	memory: CreatureMemory | null | undefined
): memory is CreatureMemory {
	if (memory === null || memory === undefined) {
		return false;
	}
	return (
		Number.isInteger(memory.capacity) &&
		memory.capacity >= 1 &&
		Number.isFinite(memory.nextSequence) &&
		memory.nextSequence >= 0 &&
		Array.isArray(memory.entries)
	);
}

/**
 * Ensure the creature has a valid `memory` container.
 * Returns the same reference when already valid so hot paths stay allocation-free.
 *
 * Repairs HMR-stale or partially constructed creatures that would otherwise throw
 * on `memory.entries` during announcement recall.
 */
export function ensureCreatureMemory(
	creature: Creature,
	fallbackCapacity: number = DEFAULT_FALLBACK_MEMORY_CAPACITY
): Creature {
	if (isValidCreatureMemory(creature.memory)) {
		return creature;
	}

	const capacity =
		Number.isInteger(fallbackCapacity) && fallbackCapacity >= 1
			? fallbackCapacity
			: DEFAULT_FALLBACK_MEMORY_CAPACITY;

	return {
		...creature,
		memory: createEmptyMemory(capacity)
	};
}

/**
 * Sample integer memory capacity from an independent seeded stream.
 * Identical (seed, creatureId, range) always yields the same capacity.
 */
export function sampleMemoryCapacity(
	simulationSeed: string,
	creatureId: string,
	range: { min: number; max: number }
): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, MEMORY_CAPACITY_CHANNEL, creatureId));
	return rng.nextInt(range.min, range.max);
}
