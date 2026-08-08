/**
 * Resource-announcement subdomain types.
 *
 * Feature identity drives provenance and presentation.
 * Resource kind drives clarity, symbol selection and learning meaning.
 * Listener-facing HeardSignal must never include these fields.
 *
 * Active state is execution-local after cognition selects announce_resource —
 * not a discovered behavioural opportunity waiting for acceptance.
 */

import type { Vec2 } from '$lib/habitat';

/** Lifecycle state while executing an already-selected announce_resource intention. */
export type AnnouncementExecutionState = 'evaluating' | 'repositioning';

/**
 * Execution-local state for clarity evaluation, speaking-position search,
 * multi-step repositioning, and emission handoff.
 * Not a decision owner — cognition already selected announce_resource.
 */
export type ActiveAnnouncementExecution = {
	id: string;
	creatureId: string;
	triggerFeatureId: string;
	resourceKind: 'food' | 'water';
	/** Feature centre at execution start (diagnostics / presentation). */
	triggerFeaturePosition: Vec2;
	state: AnnouncementExecutionState;
	/** Speaking point while repositioning; null when not yet chosen / not needed. */
	speakingTarget: Vec2 | null;
	/** Initial clarity snapshot at first evaluation. */
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
	| 'emission_requested'
	| 'invalid_trigger_feature'
	| 'no_announced_kind_available'
	| 'no_valid_speaking_position';

/**
 * Bounded inspectable history of completed or invalidated announcement executions.
 * Records only facts known at executor completion — emission ids live on SignalEmission.
 */
export type AnnouncementExecutionOutcome = {
	executionId: string;
	creatureId: string;
	triggerFeatureId: string;
	resourceKind: 'food' | 'water';
	triggerFeaturePosition: Vec2;
	initialClarity: ClarityEvidence | null;
	finalClarity: ClarityEvidence | null;
	repositioningRequired: boolean;
	speakingTarget: Vec2 | null;
	finalEmitterPosition: Vec2 | null;
	completedAt: number;
	reason: AnnouncementOutcomeReason;
};
