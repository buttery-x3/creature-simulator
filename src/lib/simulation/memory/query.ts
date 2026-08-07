/**
 * Pure memory query helpers.
 * Callers must not scan or mutate `memory.entries` ad hoc elsewhere.
 */

import type { CreatureMemory, CreatureMemoryEntry, ResourceAnnouncementMemory } from './types';

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

/** Used slots and capacity for diagnostics/UI. */
export function memoryUsage(memory: CreatureMemory): { used: number; capacity: number } {
	return { used: memory.entries.length, capacity: memory.capacity };
}
