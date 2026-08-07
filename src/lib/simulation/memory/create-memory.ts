/**
 * Memory creation and deterministic capacity sampling.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { CreatureMemory } from './types';

/** Seed channel for independent per-creature memory capacity. */
export const MEMORY_CAPACITY_CHANNEL = 'memory-capacity';

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
