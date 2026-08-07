/**
 * Memory subdomain: first-class bounded per-creature retained experience.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own perception, announcement lifecycle, transmission, or lexicon learning.
 */

export type {
	AnnouncementOpportunityDecision,
	AnnouncementOpportunityDecisionReason,
	CreatureMemory,
	CreatureMemoryEntry,
	CreatureMemoryEntryKind,
	ResourceAnnouncementMemory,
	ResourceAnnouncementMemoryDraft
} from './types';

export { createEmptyMemory, MEMORY_CAPACITY_CHANNEL, sampleMemoryCapacity } from './create-memory';

export {
	countMemoryEntries,
	findResourceAnnouncementMemory,
	hasResourceAnnouncementMemory,
	memoryUsage
} from './query';

export { evictToCapacity, forgetEntries, rememberResourceAnnouncement } from './mutate';

export { applySuccessfulAnnouncementMemories } from './apply-announcement-memory';
