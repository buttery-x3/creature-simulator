/**
 * Pure cognition / intention arbitration types.
 *
 * Runtime-authoritative since FLAME-80: the step loop builds ArbitrationInput
 * and applies ArbitrationRecord via behaviour execution.
 *
 * Target representation:
 * - Currently perceived resources use authoritative feature targets.
 * - Remembered resource observations use point targets at the stored position
 *   (belief navigation; featureId remains diagnostic only).
 * - Remembered signal investigation uses a point target at the stored origin.
 * - When no usable resource knowledge exists, need candidates stay valid with
 *   target null and reason code `search_fallback` (executor samples search).
 *
 * Continuity: soft score bonus on the current intention’s matching candidate —
 * not a separate “continue” intention kind and not a commitment lock.
 */

import type { Vec2 } from '$lib/habitat';
import type { CreatureMemory } from '../memory/types';
import type { CreatureTarget } from '../types';

/** What the creature is trying to accomplish (distinct from low-level action). */
export type IntentionKind =
	| 'satisfy_hunger'
	| 'satisfy_thirst'
	| 'rest'
	| 'investigate_signal'
	| 'announce_resource'
	| 'explore';

/**
 * Why arbitration was requested. Triggers request reconsideration only;
 * they never map 1:1 to a forced intention.
 */
export type ArbitrationTrigger =
	| 'initial'
	| 'periodic'
	| 'new_heard_signal_memory'
	| 'relevant_resource_perception_change'
	| 'current_target_invalid'
	| 'action_complete'
	| 'need_or_recovery_complete';

/** Currently available perceived resource (caller already applied availability). */
export type PerceivedResource = {
	featureId: string;
	resourceKind: 'food' | 'water';
	position: Vec2;
};

/** Stable structured factor for diagnostics (not prose). */
export type CandidateFactor = {
	code: string;
	value: number;
};

/** Stable reason codes for candidate validity, scoring and selection. */
export type CandidateReasonCode =
	| 'always_valid'
	| 'below_threshold'
	| 'hunger_pressure'
	| 'thirst_pressure'
	| 'energy_deficit'
	| 'explore_baseline'
	| 'signal_baseline'
	| 'signal_recency'
	| 'announce_baseline'
	| 'verbosity'
	| 'speech_weight'
	| 'curiosity'
	| 'curiosity_weight'
	| 'optional_signal_score'
	| 'need_information_value'
	| 'continuity_bonus'
	| 'target_quality'
	| 'search_fallback'
	| 'visible_resource'
	| 'remembered_resource'
	| 'no_heard_signal'
	| 'no_unannounced_resource'
	| 'selected_highest_score'
	| 'selected_tie_break'
	| 'not_selected'
	| 'invalid_not_selected';

/** Diagnostic reference for the candidate’s evidence/target source. */
export type CandidateReference =
	| { kind: 'feature'; featureId: string; resourceKind: 'food' | 'water' | 'home' }
	| { kind: 'heard_signal'; emissionId: string; symbolId: string }
	| { kind: 'point'; position: Vec2 };

export type IntentionCandidate = {
	intention: IntentionKind;
	valid: boolean;
	/** Final score including continuity adjustment. */
	score: number;
	/** Score before continuity. */
	baseScore: number;
	continuityAdjustment: number;
	target: CreatureTarget | null;
	reference: CandidateReference | null;
	factors: CandidateFactor[];
	reasonCodes: CandidateReasonCode[];
	rejectionReason?: CandidateReasonCode;
};

export type ArbitrationRecord = {
	timeSeconds: number;
	trigger: ArbitrationTrigger;
	previousIntention: IntentionKind | null;
	selectedIntention: IntentionKind;
	selectedTarget: CreatureTarget | null;
	selectionReasonCodes: CandidateReasonCode[];
	candidates: IntentionCandidate[];
};

export type CognitionConfig = {
	seekFoodThreshold: number;
	seekWaterThreshold: number;
	restThreshold: number;
	exploreBaseline: number;
	signalBaseline: number;
	/** Added proportionally for newer heard_signal memories (0…this value). */
	signalRecencyBoostMax: number;
	announceBaseline: number;
	/** Soft stickiness for the current intention when still valid. */
	continuityBonus: number;
	/**
	 * Multipliers applied to need pressure for satisfy_hunger / satisfy_thirst.
	 * Visible evidence is strongest; blind search is materially discounted.
	 */
	targetQualityVisible: number;
	targetQualityRemembered: number;
	targetQualitySearch: number;
};

/**
 * Pure arbitration input snapshot. No habitat mutation, no pendingSignals,
 * no opportunity lifecycle objects.
 */
export type ArbitrationInput = {
	timeSeconds: number;
	trigger: ArbitrationTrigger;
	position: Vec2;
	hunger: number;
	thirst: number;
	energy: number;
	/**
	 * Creature speech-preference scalar in [0, 1].
	 * Weights announce_resource (and future speech intentions) only — never eligibility.
	 */
	verbosity: number;
	/**
	 * Creature optional-information / novelty preference scalar in [0, 1].
	 * Weights optional investigate_signal motivation only — never eligibility or
	 * need-driven information floors.
	 */
	curiosity: number;
	/** Available food currently in perception (already filtered usable). */
	availableFood: readonly PerceivedResource[];
	/** Available water currently in perception (already filtered usable). */
	availableWater: readonly PerceivedResource[];
	memory: CreatureMemory;
	currentIntention: IntentionKind | null;
	currentTarget: CreatureTarget | null;
	/** Innate home feature id for rest targeting. */
	homeFeatureId: string;
	config: CognitionConfig;
};

/**
 * Tie-break when scores are equal (earlier wins).
 * Survival before optional behaviours before explore.
 */
export const INTENTION_TIE_BREAK_ORDER: readonly IntentionKind[] = [
	'satisfy_hunger',
	'satisfy_thirst',
	'rest',
	'investigate_signal',
	'announce_resource',
	'explore'
] as const;

export const INTENTION_RANK: Record<IntentionKind, number> = Object.fromEntries(
	INTENTION_TIE_BREAK_ORDER.map((intention, index) => [intention, index])
) as Record<IntentionKind, number>;
