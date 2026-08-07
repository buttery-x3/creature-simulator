/**
 * Authoritative simulation state: habitat plus creatures.
 *
 * Creatures are never stored on {@link Habitat}. Facing is radians on the
 * ground plane (0 faces +x, positive turns toward +y / counter-clockwise).
 *
 * Need scale (documented):
 * - hunger / thirst: pressure — 0 = sated/quenched, 1 = maximum need
 * - energy: satisfaction — 0 = exhausted, 1 = fully rested
 */

import type { Habitat, HabitatFeatureKind, HabitatGenerationConfig, Vec2 } from '$lib/habitat';
import type {
	AnnouncementOpportunity,
	AnnouncementOpportunityOutcome,
	ResourceFeaturePerceptionEpisode
} from './announcement/types';
import type { HeardSignal, SignalEmission, SymbolId } from './communication/types';
import type {
	ActiveSignalInvestigation,
	CreatureLexicon,
	LearningHistoryEntry,
	LexiconChangeEntry,
	SignalInvestigationOpportunity,
	SymbolAssociation
} from './learning/types';
import type { AnnouncementOpportunityDecision, CreatureMemory } from './memory/types';

export type {
	HeardSignal,
	SignalEmission,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence,
	SymbolSelectionMode
} from './communication/types';
export { DEFAULT_SYMBOL_INVENTORY } from './communication/types';
export type {
	ActiveSignalInvestigation,
	CreatureLexicon,
	CuriosityDecision,
	CuriosityEvidence,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	PendingSignal,
	SignalInvestigationOpportunity,
	SymbolAssociation
} from './learning/types';
export { LEXICON_MEANINGS } from './learning/types';
export type {
	AnnouncementOpportunity,
	AnnouncementOpportunityOutcome,
	AnnouncementOpportunityState,
	AnnouncementOutcomeReason,
	ClarityEvidence,
	NewlyPerceivedResource,
	ResourceFeaturePerceptionEpisode
} from './announcement/types';
export type {
	AnnouncementOpportunityDecision,
	AnnouncementOpportunityDecisionReason,
	CreatureMemory,
	CreatureMemoryEntry,
	ResourceAnnouncementMemory
} from './memory/types';

/** Outcome the creature is currently pursuing. */
export type CreatureGoal =
	'seek_food' | 'seek_water' | 'rest' | 'investigate_signal' | 'prepare_announcement' | 'wander';

/** Current step used to pursue the goal. Distinct from goal. */
export type CreatureAction =
	'move' | 'investigate' | 'eat' | 'drink' | 'sleep' | 'wander' | 'search';

/**
 * A single food/water observation (current snapshot or brief tracked pursuit).
 * Not long-term memory — only the latest sense result and optional current track.
 */
export type ResourceObservation = {
	featureId: string;
	featureKind: Extract<HabitatFeatureKind, 'food' | 'water'>;
	/** Last observed feature centre (simulation ground plane). */
	position: Vec2;
	/** Simulation time when this observation was taken/refreshed. */
	observedAt: number;
};

/**
 * Authoritative per-creature perception. Plain serialisable; no Three.js/UI state.
 * Home is innate knowledge and is never stored here.
 */
export type CreaturePerception = {
	/** Simulation time of the latest perception update. */
	lastUpdatedAt: number;
	perceivedFoodIds: string[];
	perceivedWaterIds: string[];
	/** Structured snapshot of currently perceived food/water only. */
	observations: ResourceObservation[];
	/** Single briefly retained pursuit observation, if any. */
	tracked: ResourceObservation | null;
	/**
	 * Continuous per-feature perception episodes (currently visible resources).
	 * Used for announcement opportunity deduplication — not long-term memory.
	 */
	activeEpisodes: ResourceFeaturePerceptionEpisode[];
	/** Monotonic counter for stable episode ids on this creature. */
	episodeCounter: number;
};

/**
 * Habitat feature or free-space point associated with the current action.
 * Feature targets use authoritative simulation footprints, not presentation meshes.
 */
export type CreatureTarget =
	| {
			kind: 'feature';
			featureId: string;
			featureKind: Extract<HabitatFeatureKind, 'food' | 'water' | 'home'>;
	  }
	| { kind: 'point'; position: Vec2 };

/** Why a candidate goal scored as it did (structured evidence for the inspector). */
export type CandidateEvaluation = {
	goal: CreatureGoal;
	valid: boolean;
	score: number;
	/** Primary human-readable reason for the score. */
	reason: string;
	target: CreatureTarget | null;
	/** Present when the candidate could not be selected. */
	rejectionReason?: string;
};

export type DecisionTrigger = 'initial' | 'reconsider' | 'invalid_target' | 'action_complete';

/** Structured record of one goal decision; UI must not invent reasons. */
export type DecisionRecord = {
	timeSeconds: number;
	trigger: DecisionTrigger;
	previousGoal: CreatureGoal | null;
	selectedGoal: CreatureGoal;
	selectedTarget: CreatureTarget | null;
	selectionReason: string;
	candidates: CandidateEvaluation[];
};

/** Bounded history entry for goal/action transitions. */
export type BehaviourTransition = {
	timeSeconds: number;
	fromGoal: CreatureGoal;
	toGoal: CreatureGoal;
	fromAction: CreatureAction;
	toAction: CreatureAction;
	reason: string;
};

export type Creature = {
	id: string;
	position: Vec2;
	/** Radians on the ground plane; 0 faces +x. */
	facing: number;
	/** Simulation units per simulated second. */
	movementSpeed: number;
	/** Wander stream destination (also mirrored in target when goal is wander). */
	wanderTarget: Vec2;
	/** Increments each time a new wander target is chosen. */
	wanderDecisionIndex: number;
	/**
	 * Active search destination while action is search (mirrors point target).
	 * Separate from wanderTarget so search diagnostics stay distinct.
	 */
	searchTarget: Vec2;
	/** Increments each time a new search point is chosen. */
	searchDecisionIndex: number;

	/** Latest local sensing snapshot and optional brief resource track. */
	perception: CreaturePerception;

	/** Hunger pressure in [0, 1]; larger = more hungry. */
	hunger: number;
	/** Thirst pressure in [0, 1]; larger = more thirsty. */
	thirst: number;
	/** Energy satisfaction in [0, 1]; larger = more rested. */
	energy: number;

	/**
	 * Individual curiosity trait sampled at creation (independent seed stream).
	 * Primary source of unknown-symbol investigation interest.
	 */
	curiosity: number;

	/**
	 * First-class bounded memory of retained experience (not perception).
	 * Capacity is sampled at creation; entries are kind-discriminated.
	 */
	memory: CreatureMemory;
	/**
	 * Bounded recent announcement opportunity create/suppress decisions
	 * (local diagnostics before a global audit stream exists).
	 */
	recentAnnouncementOpportunityDecisions: AnnouncementOpportunityDecision[];

	goal: CreatureGoal;
	action: CreatureAction;
	target: CreatureTarget | null;
	/** Simulation time when the current goal was selected. */
	goalStartedAt: number;
	/** Simulation time when the current action began. */
	actionStartedAt: number;
	/** Simulation time of the next ordinary reconsideration. */
	nextReconsiderAt: number;

	lastDecision: DecisionRecord | null;
	/** Snapshot of candidates from the most recent decision. */
	lastCandidates: CandidateEvaluation[];
	/** Recent goal/action transitions, newest last, length-capped. */
	recentTransitions: BehaviourTransition[];

	/**
	 * Deterministic preferred symbol assigned at creation.
	 * Arbitrary — no resource or danger meaning.
	 */
	preferredSymbolId: SymbolId;
	/** Number of emissions this creature has produced (drives stable emission ids). */
	emissionCount: number;
	/** Simulation time of last accepted emission; -1 if never. */
	lastEmissionAt: number;
	/** Recent emissions by this creature, newest last, length-capped. */
	recentEmitted: SignalEmission[];
	/** Recent signals heard by this creature, newest last, length-capped. */
	recentHeard: HeardSignal[];

	/**
	 * Personal raw food/water evidence per symbol (may be ambiguous/overlapping).
	 * Independent per creature; starts with no semantic knowledge.
	 */
	symbolAssociations: SymbolAssociation[];
	/**
	 * Exclusive personal lexicon derived from evidence (one symbol per meaning).
	 * Null assignment = unassigned; not a global dictionary entry.
	 */
	lexicon: CreatureLexicon;
	/** Recent exclusive-lexicon reassignments, newest last, length-capped. */
	recentLexiconChanges: LexiconChangeEntry[];
	/**
	 * Short-lived heard-signal investigation opportunities (bounded, deduped by emissionId).
	 * Each entry carries an explicit curiosity accept/reject decision made once at ingest.
	 */
	pendingSignals: SignalInvestigationOpportunity[];
	/** Active signal investigation evidence, if any. */
	activeInvestigation: ActiveSignalInvestigation | null;
	/** Recent learning outcomes, newest last, length-capped. */
	recentLearning: LearningHistoryEntry[];

	/**
	 * Open resource-announcement opportunities (active + queued), newest not required.
	 * Order is creation order; at most one is ready/repositioning at a time.
	 */
	announcementOpportunities: AnnouncementOpportunity[];
	/** Monotonic counter for stable opportunity ids. */
	announcementOpportunityCounter: number;
	/** Bounded recent opportunity outcomes for local lifecycle diagnostics. */
	recentAnnouncementOutcomes: AnnouncementOpportunityOutcome[];
	/**
	 * Presentation/diagnostic cue for the active (or just-emitted) opportunity.
	 * Authoritative fade timing; presentation only reads this.
	 */
	activeAnnouncementCue: {
		opportunityId: string;
		triggerFeatureId: string;
		triggerFeaturePosition: Vec2;
		/** When set, cue is fading after emission; null while preparing. */
		fadeStartedAt: number | null;
	} | null;
};

export type SimulationState = {
	seed: string;
	/** Simulated seconds advanced by fixed steps. */
	timeSeconds: number;
	habitat: Habitat;
	creatures: Creature[];
	/** Currently active (non-expired) emissions. */
	activeEmissions: SignalEmission[];
	/** Bounded recent emission history for diagnostics, newest last. */
	recentEmissions: SignalEmission[];
};

/** Inclusive movement-speed range sampled at creature creation. */
export type SpeedRange = {
	min: number;
	max: number;
};

/**
 * Configuration for creating and stepping a simulation.
 * Plain serialisable values only — no RNG closures.
 */
export type SimulationConfig = {
	seed: string;
	/** Habitat generation settings excluding seed (seed comes from this config). */
	habitat: Omit<HabitatGenerationConfig, 'seed'>;
	creatureCount: number;
	movementSpeed: SpeedRange;
	/** Maximum absolute turn rate in radians per simulated second. */
	maxTurnRate: number;
	/** Half-extent margin so creature footprint stays inside bounds and home. */
	creatureRadius: number;
	/** Fixed simulation step duration in seconds. */
	fixedDt: number;
	/** Cap on fixed steps processed per wall-clock catch-up. */
	maxCatchUpSteps: number;
	/** Distance at which a wander/move target is considered reached. */
	arrivalDistance: number;

	/** Hunger pressure rise per simulated second while not eating. */
	hungerRisePerSecond: number;
	/** Thirst pressure rise per simulated second while not drinking. */
	thirstRisePerSecond: number;
	/** Energy drain per simulated second while not sleeping. */
	energyDrainPerSecond: number;
	/** Hunger pressure reduction per second while eating. */
	eatRecoveryPerSecond: number;
	/** Thirst pressure reduction per second while drinking. */
	drinkRecoveryPerSecond: number;
	/** Energy restoration per second while sleeping. */
	sleepRecoveryPerSecond: number;

	/** Minimum hunger pressure before seek_food is valid. */
	seekFoodThreshold: number;
	/** Minimum thirst pressure before seek_water is valid. */
	seekWaterThreshold: number;
	/** Minimum energy deficit (1 - energy) before rest is valid. */
	restThreshold: number;

	/**
	 * Challenger must beat the current goal score by at least this margin to switch
	 * (hysteresis). Prevents thrashing on tiny score differences.
	 */
	goalSwitchMargin: number;
	/** Minimum time a goal must be held before ordinary reconsideration can switch. */
	minGoalCommitmentSeconds: number;
	/** Interval between ordinary reconsiderations. */
	reconsiderIntervalSeconds: number;

	/** Stop eating when hunger pressure falls to this level. */
	eatUntilHunger: number;
	/** Stop drinking when thirst pressure falls to this level. */
	drinkUntilThirst: number;
	/** Stop sleeping when energy rises to this level. */
	sleepUntilEnergy: number;

	/** Max length of recentTransitions (oldest dropped). */
	decisionHistoryLimit: number;

	/**
	 * Circular sensing radius on the ground plane (simulation units).
	 * Food/water footprints intersecting this circle are perceived.
	 */
	sensingRadius: number;
	/** Minimum simulated seconds between perception updates. */
	perceptionIntervalSeconds: number;
	/**
	 * How long a pursued food/water observation remains usable after last seeing it.
	 */
	trackedObservationDurationSeconds: number;

	/**
	 * Minimum opposite-kind − announced-kind distance for emitter-side clarity.
	 * Ties and smaller deltas are unclear and require repositioning.
	 */
	resourceAnnouncementClarityMargin: number;
	/**
	 * Max distance from a same-kind feature centre when searching speaking positions.
	 */
	speakingPositionSearchRadius: number;
	/**
	 * Speaking-position polar grid density (rings; angular steps = 2× this value, min 4).
	 */
	speakingPositionSearchResolution: number;
	/** Max open announcement opportunities per creature (active + queued). */
	maxQueuedAnnouncementOpportunitiesPerCreature: number;
	/** Max length of recentAnnouncementOutcomes (oldest dropped). */
	recentAnnouncementOutcomeHistoryLimit: number;
	/**
	 * How long the trigger-feature dashed cue remains after emission before disposal
	 * (authoritative fade window for presentation).
	 */
	triggerFeatureCueFadeSeconds: number;

	/**
	 * Arbitrary symbol inventory. No built-in semantic mapping to resources or danger.
	 */
	symbolInventory: readonly SymbolId[];
	/** Circular hearing radius on the ground plane (simulation units). */
	hearingRadius: number;
	/** How long an emission remains active after emission time. */
	signalLifetimeSeconds: number;
	/** Minimum simulated seconds between accepted emissions from one creature. */
	emissionCooldownSeconds: number;
	/** Max length of per-creature recentEmitted (oldest dropped). */
	recentEmittedHistoryLimit: number;
	/** Max length of per-creature recentHeard (oldest dropped). */
	recentHeardHistoryLimit: number;
	/** Max length of simulation recentEmissions (oldest dropped). */
	recentSimulationEmissionHistoryLimit: number;
	/**
	 * Simulated-time window for population “recent emission” diagnostics (seconds).
	 * Pure observation only — does not affect emission behaviour.
	 */
	recentEmissionDiagnosticsWindowSeconds: number;
	/**
	 * Minimum raw evidence strength for a meaning to claim a symbol in the exclusive lexicon.
	 */
	lexiconAssignmentMinStrength: number;
	/**
	 * Minimum evidence count for a meaning to claim a symbol in the exclusive lexicon.
	 */
	lexiconAssignmentMinEvidenceCount: number;
	/** Max length of recentLexiconChanges (oldest dropped). */
	lexiconHistoryLimit: number;

	/** How long a pending heard signal remains an investigation candidate. */
	pendingSignalLifetimeSeconds: number;
	/** Max pending investigation candidates per creature. */
	maxPendingSignalsPerCreature: number;
	/**
	 * Inclusive range for per-creature curiosity sampled at creation
	 * (independent `deriveSeed(seed, 'curiosity', id)` stream).
	 * Curiosity is susceptibility to investigating a heard communication opportunity.
	 */
	curiosityRange: { min: number; max: number };
	/**
	 * Inclusive integer range for per-creature memory capacity sampled at creation
	 * (independent `deriveSeed(seed, 'memory-capacity', id)` stream).
	 * Min must be ≥ 1. Not derived from intelligence.
	 */
	memoryCapacityRange: { min: number; max: number };
	/** Max length of recentAnnouncementOpportunityDecisions (oldest dropped). */
	recentAnnouncementOpportunityDecisionHistoryLimit: number;
	/**
	 * Characteristic length for presentation-only smooth distance falloff on signal rings:
	 * distanceFactor = 1 / (1 + distance / investigationDistanceScale).
	 * Does **not** affect curiosity acceptance or investigation goal eligibility.
	 */
	investigationDistanceScale: number;
	/** Max distance from signal origin for contextual learning evidence. */
	learningEvidenceRadius: number;
	/** Bounded additive reinforcement applied per qualifying food/water evidence. */
	associationReinforcement: number;
	/**
	 * Optional mild confidence reduction on no-evidence outcomes.
	 * 0 leaves associations unchanged (default conservative rule).
	 */
	noEvidenceConfidenceReduction: number;
	/** Max length of recentLearning (oldest dropped). */
	learningHistoryLimit: number;
	/** Inclusive lower clamp for association strengths. */
	associationStrengthMin: number;
	/** Inclusive upper clamp for association strengths. */
	associationStrengthMax: number;

	/** Initial hunger pressure at creation (fixed for determinism). */
	initialHunger: number;
	/** Initial thirst pressure at creation. */
	initialThirst: number;
	/** Initial energy satisfaction at creation. */
	initialEnergy: number;
};
