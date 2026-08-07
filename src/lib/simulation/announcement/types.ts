/**
 * Resource-announcement subdomain types.
 *
 * Feature identity drives episodes, provenance and presentation.
 * Resource kind drives clarity, symbol selection and learning meaning.
 * Listener-facing HeardSignal must never include these fields.
 */

import type { Vec2 } from '$lib/habitat';
import type { SymbolId, SymbolSelectionMode } from '../communication/types';

/** Continuous perception episode for one creature + one resource feature. */
export type ResourceFeaturePerceptionEpisode = {
	episodeId: string;
	featureId: string;
	resourceKind: 'food' | 'water';
	/** Simulation time when the feature entered perception for this episode. */
	startedAt: number;
};

/** Feature that transitioned not-perceived → perceived on a sensing pass. */
export type NewlyPerceivedResource = {
	featureId: string;
	resourceKind: 'food' | 'water';
	position: Vec2;
	perceptionEpisodeId: string;
	discoveredAt: number;
};

export type AnnouncementOpportunityState = 'ready' | 'repositioning' | 'queued';

/**
 * Authoritative announcement opportunity for one discovery episode.
 * triggerFeatureId is causal provenance and must never be silently rewritten.
 */
export type AnnouncementOpportunity = {
	id: string;
	creatureId: string;
	triggerFeatureId: string;
	resourceKind: 'food' | 'water';
	/** Feature centre at discovery (fallback for presentation). */
	triggerFeaturePosition: Vec2;
	perceptionEpisodeId: string;
	discoveredAt: number;
	/** Creature position when the opportunity was created. */
	discoveryCreaturePosition: Vec2;
	state: AnnouncementOpportunityState;
	/** Speaking point while repositioning; null when not yet chosen / not needed. */
	speakingTarget: Vec2 | null;
	/** Initial clarity snapshot at opportunity creation (or first evaluation). */
	initialClarity: ClarityEvidence | null;
};

export type ClarityEvidence = {
	announcedKind: 'food' | 'water';
	nearestAnnouncedKindDistance: number | null;
	nearestOppositeKindDistance: number | null;
	clarityMargin: number;
	clear: boolean;
	/** Machine-readable reason (clear_no_opposite, clear_margin, unclear_tie, …). */
	reason: string;
};

export type AnnouncementOutcomeReason =
	| 'emitted'
	| 'invalid_trigger_feature'
	| 'no_announced_kind_available'
	| 'no_valid_speaking_position'
	| 'queue_overflow'
	| 'world_reset'
	| 'creature_removed';

/** Bounded inspectable history of completed or invalidated opportunities. */
export type AnnouncementOpportunityOutcome = {
	opportunityId: string;
	creatureId: string;
	triggerFeatureId: string;
	resourceKind: 'food' | 'water';
	perceptionEpisodeId: string;
	discoveredAt: number;
	discoveryCreaturePosition: Vec2;
	triggerFeaturePosition: Vec2;
	initialClarity: ClarityEvidence | null;
	finalClarity: ClarityEvidence | null;
	repositioningRequired: boolean;
	speakingTarget: Vec2 | null;
	finalEmitterPosition: Vec2 | null;
	emittedSignalId: string | null;
	emittedSymbolId: SymbolId | null;
	productionMode: SymbolSelectionMode | null;
	queuePosition: number | null;
	completedAt: number;
	reason: AnnouncementOutcomeReason;
};

/** Presentation-only active cue snapshot derived from authoritative state. */
export type AnnouncementCueState = {
	creatureId: string;
	opportunityId: string;
	triggerFeatureId: string;
	triggerFeaturePosition: Vec2;
	/** Simulation time when the cue should start fading (emit time), or null while preparing. */
	fadeStartedAt: number | null;
};
