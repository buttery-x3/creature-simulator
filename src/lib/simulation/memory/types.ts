/**
 * Creature memory types: first-class bounded retained experience.
 *
 * Memory is distinct from perception (current sensing), announcement queues,
 * communication histories, and learning/lexicon evidence.
 *
 * Entry kinds:
 * - resource_announcement — “I announced this feature” (no position)
 * - resource_observation — “I saw this resource here” (position + water empty flag)
 * - heard_signal — “I heard this symbol from this place” (no sender identity)
 */

import type { Vec2 } from '$lib/habitat';
import type { SymbolId } from '../communication/types';

/** Discriminator for memory entry kinds (extensible). */
export type CreatureMemoryEntryKind =
	'resource_announcement' | 'resource_observation' | 'heard_signal';

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
 * Direct resource observation: “I saw this resource at this place.”
 * Food uses empty=false; water uses empty to record last-observed basin state.
 * Does not store quantity/abundance or confidence.
 */
export type ResourceObservationMemory = {
	kind: 'resource_observation';
	sequence: number;
	rememberedAt: number;
	featureId: string;
	resourceKind: 'food' | 'water';
	position: Vec2;
	/** Last observed empty state. Meaningful for water; always false for food. */
	empty: boolean;
};

/**
 * Heard signal: “I heard this symbol from this location.”
 * No sender identity, meaning, curiosity, or confidence.
 */
export type HeardSignalMemory = {
	kind: 'heard_signal';
	sequence: number;
	rememberedAt: number;
	emissionId: string;
	symbolId: SymbolId;
	origin: Vec2;
};

/**
 * Discriminated memory entry union.
 * Future kinds extend this union without replacing the container.
 */
export type CreatureMemoryEntry =
	ResourceAnnouncementMemory | ResourceObservationMemory | HeardSignalMemory;

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
	| 'same_episode'
	| 'already_active'
	| 'announcement_remembered'
	| 'created'
	| 'announcement_busy'
	| 'not_selected_same_perception_pass';

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

/** Draft for a resource-observation memory before sequence assignment. */
export type ResourceObservationMemoryDraft = {
	rememberedAt: number;
	featureId: string;
	resourceKind: 'food' | 'water';
	position: Vec2;
	empty: boolean;
};

/** Draft for a heard-signal memory before sequence assignment. */
export type HeardSignalMemoryDraft = {
	rememberedAt: number;
	emissionId: string;
	symbolId: SymbolId;
	origin: Vec2;
};
