/**
 * Pure memory query helpers.
 * Callers must not scan or mutate `memory.entries` ad hoc elsewhere.
 */

import type {
	CreatureMemory,
	CreatureMemoryEntry,
	HeardSignalMemory,
	ResourceAnnouncementMemory,
	ResourceObservationMemory
} from './types';

/** True when a resource_announcement entry exists for the exact feature id. */
export function hasResourceAnnouncementMemory(memory: CreatureMemory, featureId: string): boolean {
	return memory.entries.some(
		(e) => e.kind === 'resource_announcement' && e.featureId === featureId
	);
}

/** Find the retained resource_announcement for a feature, if any. */
export function findResourceAnnouncementMemory(
	memory: CreatureMemory,
	featureId: string
): ResourceAnnouncementMemory | null {
	const found = memory.entries.find(
		(e) => e.kind === 'resource_announcement' && e.featureId === featureId
	);
	return found?.kind === 'resource_announcement' ? found : null;
}

/** True when a resource_observation entry exists for the exact feature id. */
export function hasResourceObservationMemory(memory: CreatureMemory, featureId: string): boolean {
	return memory.entries.some((e) => e.kind === 'resource_observation' && e.featureId === featureId);
}

/** Find the retained resource_observation for a feature, if any. */
export function findResourceObservationMemory(
	memory: CreatureMemory,
	featureId: string
): ResourceObservationMemory | null {
	const found = memory.entries.find(
		(e) => e.kind === 'resource_observation' && e.featureId === featureId
	);
	return found?.kind === 'resource_observation' ? found : null;
}

/** True when a heard_signal entry exists for the exact emission id. */
export function hasHeardSignalMemory(memory: CreatureMemory, emissionId: string): boolean {
	return memory.entries.some((e) => e.kind === 'heard_signal' && e.emissionId === emissionId);
}

/** Find the retained heard_signal for an emission, if any. */
export function findHeardSignalMemory(
	memory: CreatureMemory,
	emissionId: string
): HeardSignalMemory | null {
	const found = memory.entries.find(
		(e) => e.kind === 'heard_signal' && e.emissionId === emissionId
	);
	return found?.kind === 'heard_signal' ? found : null;
}

/** Count entries of a given kind (or all entries when kind omitted). */
export function countMemoryEntries(
	memory: CreatureMemory,
	kind?: CreatureMemoryEntry['kind']
): number {
	if (!kind) {
		return memory.entries.length;
	}
	return memory.entries.filter((e) => e.kind === kind).length;
}

/**
 * Resource observations, newest sequence first.
 * Optional resourceKind filter. Does not apply empty/usability policy.
 */
export function listResourceObservations(
	memory: CreatureMemory,
	resourceKind?: 'food' | 'water'
): ResourceObservationMemory[] {
	const matched = memory.entries.filter(
		(e): e is ResourceObservationMemory =>
			e.kind === 'resource_observation' &&
			(resourceKind === undefined || e.resourceKind === resourceKind)
	);
	return matched.sort((a, b) => b.sequence - a.sequence);
}

/**
 * Heard-signal memories, newest sequence first.
 * Policy-free recall — callers decide which signal to act on.
 */
export function listHeardSignalMemories(memory: CreatureMemory): HeardSignalMemory[] {
	const matched = memory.entries.filter((e): e is HeardSignalMemory => e.kind === 'heard_signal');
	return matched.sort((a, b) => b.sequence - a.sequence);
}

/**
 * Newest resource observation usable as a navigation target for the given kind.
 * Food: any observation. Water: only when last observed non-empty (`empty === false`).
 */
export function findNewestUsableResourceObservation(
	memory: CreatureMemory,
	resourceKind: 'food' | 'water'
): ResourceObservationMemory | null {
	const observations = listResourceObservations(memory, resourceKind);
	for (const obs of observations) {
		if (resourceKind === 'water' && obs.empty) {
			continue;
		}
		return obs;
	}
	return null;
}

/** Used slots and capacity for diagnostics/UI. */
export function memoryUsage(memory: CreatureMemory): { used: number; capacity: number } {
	return { used: memory.entries.length, capacity: memory.capacity };
}
