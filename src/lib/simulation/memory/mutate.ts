/**
 * Pure memory mutation: remember, forget, capacity eviction.
 *
 * Eviction policy (baseline): oldest-entry-first by ascending `sequence`.
 * No salience, decay, or probabilistic forgetting.
 *
 * Replacement: at most one `resource_announcement` per featureId — a second
 * remember for the same feature is a no-op (returns the existing memory).
 */

import type {
	CreatureMemory,
	CreatureMemoryEntry,
	ResourceAnnouncementMemory,
	ResourceAnnouncementMemoryDraft
} from './types';

/**
 * Insert a resource-announcement memory after a successful emission.
 * No-op if this feature is already remembered.
 * Evicts oldest entries until capacity allows the insert.
 */
export function rememberResourceAnnouncement(
	memory: CreatureMemory,
	draft: ResourceAnnouncementMemoryDraft
): CreatureMemory {
	const already = memory.entries.some(
		(e) => e.kind === 'resource_announcement' && e.featureId === draft.featureId
	);
	if (already) {
		return memory;
	}

	const entry: ResourceAnnouncementMemory = {
		kind: 'resource_announcement',
		sequence: memory.nextSequence,
		rememberedAt: draft.rememberedAt,
		featureId: draft.featureId,
		resourceKind: draft.resourceKind,
		opportunityId: draft.opportunityId,
		emissionId: draft.emissionId
	};

	return insertEntry(memory, entry);
}

/**
 * Remove entries matching a predicate. Returns a new memory object.
 * Does not reset nextSequence (sequences remain monotonic for remaining history).
 */
export function forgetEntries(
	memory: CreatureMemory,
	predicate: (entry: CreatureMemoryEntry) => boolean
): CreatureMemory {
	const entries = memory.entries.filter((e) => !predicate(e));
	if (entries.length === memory.entries.length) {
		return memory;
	}
	return {
		capacity: memory.capacity,
		nextSequence: memory.nextSequence,
		entries
	};
}

/**
 * Drop oldest entries until length ≤ capacity.
 * Deterministic: lowest `sequence` first.
 */
export function evictToCapacity(memory: CreatureMemory): CreatureMemory {
	if (memory.entries.length <= memory.capacity) {
		return memory;
	}
	const sorted = [...memory.entries].sort((a, b) => a.sequence - b.sequence);
	const overflow = sorted.length - memory.capacity;
	const kept = sorted.slice(overflow);
	// Preserve chronological (oldest-first) order after eviction.
	return {
		capacity: memory.capacity,
		nextSequence: memory.nextSequence,
		entries: kept
	};
}

function insertEntry(memory: CreatureMemory, entry: CreatureMemoryEntry): CreatureMemory {
	const next: CreatureMemory = {
		capacity: memory.capacity,
		nextSequence: memory.nextSequence + 1,
		entries: [...memory.entries, entry]
	};
	return evictToCapacity(next);
}
