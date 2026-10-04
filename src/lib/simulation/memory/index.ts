/**
 * Memory subdomain: first-class bounded per-creature retained experience.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own perception, announcement lifecycle, transmission, or lexicon learning.
 */

export type {
	DangerObservationMemory,
	DangerObservationMemoryDraft,
	CreatureMemory,
	CreatureMemoryEntry,
	CreatureMemoryEntryKind,
	HeardSignalMemory,
	HeardSignalMemoryDraft,
	ResourceAnnouncementMemory,
	ResourceAnnouncementMemoryDraft,
	ResourceObservationMemory,
	ResourceObservationMemoryDraft
} from './types';

export {
	createEmptyMemory,
	DEFAULT_FALLBACK_MEMORY_CAPACITY,
	ensureCreatureMemory,
	isValidCreatureMemory,
	MEMORY_CAPACITY_CHANNEL,
	sampleMemoryCapacity
} from './create-memory';

export {
	countMemoryEntries,
	DANGER_MEMORY_LIFETIME_SECONDS,
	listDangerObservations,
	findHeardSignalMemory,
	findNewestUsableResourceObservation,
	findResourceAnnouncementMemory,
	findResourceObservationMemory,
	hasHeardSignalMemory,
	hasResourceAnnouncementMemory,
	hasResourceObservationMemory,
	listHeardSignalMemories,
	listResourceObservations,
	memoryUsage
} from './query';

export {
	evictToCapacity,
	markHeardSignalEvidenceApplied,
	rememberDangerObservation,
	forgetEntries,
	forgetHeardSignal,
	rememberHeardSignal,
	rememberResourceAnnouncement,
	rememberResourceObservation
} from './mutate';

export { applySuccessfulAnnouncementMemories } from './apply-announcement-memory';

export {
	applyHeardSignalMemories,
	applyResourceObservationMemories,
	isSensingPassDue,
	isSensingPassThisStep
} from './apply-sensory-memory';
