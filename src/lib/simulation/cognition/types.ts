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

import type { SocialState, PeerObservation } from '../social/types';
import type { Vec2 } from '$lib/habitat';
import type { CreatureLexicon, SymbolAssociation } from '../learning/types';
import type { CreatureMemory } from '../memory/types';
import type { BodyState, EcologyConfig } from '../ecology/types';
import type { WorldBounds } from '$lib/habitat';
import type { CreatureTarget, WildlifeObservation } from '../types';

/** What the creature is trying to accomplish (distinct from low-level action). */
export type IntentionKind =
	| 'approach_peer'
	| 'dance'
	| 'cry'
	| 'warn_danger'
	| 'avoid_danger'
	| 'flee'
	| 'hunt'
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
	| 'peer_perception_change'
	| 'wildlife_perception_change'
	| 'danger_perception_change'
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
	| 'social_opportunity'
	| 'no_social_opportunity'
	| 'expression_cooldown'
	| 'expression_active'
	| 'peer_affinity'
	| 'observed_distress'
	| 'local_rest'
	| 'danger_aware_route'
	| 'remembered_danger'
	| 'learned_danger'
	| 'warning_opportunity'
	| 'no_warning_evidence'
	| 'danger_requires_avoidance'
	| 'local_danger'
	| 'night_rest'
	| 'hunting_payoff'
	| 'no_local_wildlife'
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
	| 'semantic_relevance'
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
	| { kind: 'creature'; creatureId: string }
	| { kind: 'wildlife'; wildlifeId: string }
	| { kind: 'feature'; featureId: string; resourceKind: 'food' | 'water' | 'home' }
	| { kind: 'heard_signal'; emissionId: string; symbolId: string }
	| { kind: 'point'; position: Vec2 };

/** Ranked retained-signal evidence, bounded by memory capacity; scores exclude continuity. */
export type SignalEvaluation = {
	emissionId: string;
	symbolId: string;
	origin: Vec2;
	sequence: number;
	interpretation: 'food' | 'water' | 'danger' | 'unknown';
	hungerPressure: number;
	thirstPressure: number;
	foodKnowledge: 'visible' | 'remembered' | 'none';
	waterKnowledge: 'visible' | 'remembered' | 'none';
	optionalScore: number;
	informationFloor: number;
	semanticContribution: number;
	recencyBoost: number;
	score: number;
	selected: boolean;
};

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
	signalEvaluations?: SignalEvaluation[];
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
	social?: { state: SocialState; peers: readonly PeerObservation[] };
	speechReady?: boolean;
	symbolAssociations?: readonly SymbolAssociation[];
	/** Optional only for resource-only pure consumers; runtime always supplies this snapshot. */
	physical?: {
		body: BodyState;
		wildlife: readonly WildlifeObservation[];
		bounds: WorldBounds;
		homePosition?: Vec2;
		homeSize?: { width: number; height: number };
		ecology: EcologyConfig;
	};
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
	/** Listener-local resolved assignments; never raw evidence or speaker context. */
	lexicon: Readonly<CreatureLexicon>;
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
	'flee',
	'avoid_danger',
	'warn_danger',
	'hunt',
	'satisfy_hunger',
	'satisfy_thirst',
	'rest',
	'investigate_signal',
	'announce_resource',
	'approach_peer',
	'dance',
	'cry',
	'explore'
] as const;

export const INTENTION_RANK: Record<IntentionKind, number> = Object.fromEntries(
	INTENTION_TIE_BREAK_ORDER.map((intention, index) => [intention, index])
) as Record<IntentionKind, number>;
