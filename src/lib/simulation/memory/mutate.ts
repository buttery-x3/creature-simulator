/**
 * Pure memory mutation: remember, forget, capacity eviction.
 *
 * Eviction policy (baseline): oldest-entry-first by ascending `sequence`.
 * No salience, decay, or probabilistic forgetting.
 *
 * Keying:
 * - resource_announcement: at most one per featureId; second remember is a no-op
 * - resource_observation: at most one per featureId; remember refreshes (new sequence)
 * - heard_signal: at most one per emissionId; second remember is a no-op
 */

import type {
	CreatureMemory,
	CreatureMemoryEntry,
	HeardSignalMemory,
	HeardSignalMemoryDraft,
	ResourceAnnouncementMemory,
	ResourceAnnouncementMemoryDraft,
	ResourceObservationMemory,
	ResourceObservationMemoryDraft
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
 * Insert or refresh a resource-observation memory keyed by featureId.
 * Refresh drops the prior observation for that feature and inserts a new entry
 * with the next sequence so the observation becomes most recent.
 */
export function rememberResourceObservation(
	memory: CreatureMemory,
	draft: ResourceObservationMemoryDraft
): CreatureMemory {
	const withoutPrior = forgetEntries(
		memory,
		(e) => e.kind === 'resource_observation' && e.featureId === draft.featureId
	);

	const entry: ResourceObservationMemory = {
		kind: 'resource_observation',
		sequence: withoutPrior.nextSequence,
		rememberedAt: draft.rememberedAt,
		featureId: draft.featureId,
		resourceKind: draft.resourceKind,
		position: { x: draft.position.x, y: draft.position.y },
		empty: draft.empty
	};

	return insertEntry(withoutPrior, entry);
}

/**
 * Insert a heard-signal memory for one emission.
 * No-op if this emissionId is already retained.
 * Does not store sender identity.
 */
export function rememberHeardSignal(
	memory: CreatureMemory,
	draft: HeardSignalMemoryDraft
): CreatureMemory {
	const already = memory.entries.some(
		(e) => e.kind === 'heard_signal' && e.emissionId === draft.emissionId
	);
	if (already) {
		return memory;
	}

	const entry: HeardSignalMemory = {
		kind: 'heard_signal',
		sequence: memory.nextSequence,
		rememberedAt: draft.rememberedAt,
		emissionId: draft.emissionId,
		symbolId: draft.symbolId,
		origin: { x: draft.origin.x, y: draft.origin.y }
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
 * Consume a heard_signal after successful investigation of that emission.
 * No-op if the emission is not retained. Does not reset nextSequence.
 * Interrupted investigations must not call this — the chirp stays actionable.
 */
export function forgetHeardSignal(memory: CreatureMemory, emissionId: string): CreatureMemory {
	return forgetEntries(memory, (e) => e.kind === 'heard_signal' && e.emissionId === emissionId);
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
