/**
 * Creature memory types: first-class bounded retained experience.
 *
 * Memory is distinct from perception (current sensing), announcement queues,
 * communication histories, and learning/lexicon evidence.
 *
 * The entry union is designed so later issues can add kinds without replacing
 * the container. Only `resource_announcement` is implemented in this baseline.
 */

/** Discriminator for memory entry kinds (extensible). */
export type CreatureMemoryEntryKind = 'resource_announcement';

/**
 * Successful resource announcement: “I have announced this feature.”
 * Does not store position or navigation knowledge.
 */
export type ResourceAnnouncementMemory = {
	kind: 'resource_announcement';
	/** Monotonic insertion order for this creature (eviction key). */
	sequence: number;
	/** Simulation time when the successful emission was remembered. */
	rememberedAt: number;
	featureId: string;
	resourceKind: 'food' | 'water';
	opportunityId: string;
	emissionId: string;
};

/**
 * Discriminated memory entry union.
 * Future kinds (resource_location, heard_communication, …) extend this union.
 */
export type CreatureMemoryEntry = ResourceAnnouncementMemory;

/**
 * Authoritative per-creature memory container.
 * Plain serialisable; capacity is creature-local, not a global history.
 */
export type CreatureMemory = {
	/** Max retained entries (≥ 1). Sampled at creation; serialised with the creature. */
	capacity: number;
	/** Next sequence number to assign on insert (monotonic). */
	nextSequence: number;
	/** Retained entries, oldest first (lowest sequence first). */
	entries: CreatureMemoryEntry[];
};

/**
 * Why a newly perceived feature did or did not create an announcement opportunity.
 * Local diagnostics only — not a global audit stream.
 */
export type AnnouncementOpportunityDecisionReason =
	'same_episode' | 'open_or_queued' | 'announcement_remembered' | 'created' | 'queue_overflow';

export type AnnouncementOpportunityDecision = {
	timeSeconds: number;
	featureId: string;
	resourceKind: 'food' | 'water';
	perceptionEpisodeId: string;
	reason: AnnouncementOpportunityDecisionReason;
	/** Present when reason is created. */
	opportunityId: string | null;
};

/** Draft for a new resource-announcement memory before sequence assignment. */
export type ResourceAnnouncementMemoryDraft = {
	rememberedAt: number;
	featureId: string;
	resourceKind: 'food' | 'water';
	opportunityId: string;
	emissionId: string;
};
