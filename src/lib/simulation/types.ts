/**
 * Authoritative simulation state: habitat plus creatures.
 *
 * Creatures are never stored on {@link Habitat}. Facing is radians on the
 * ground plane (0 faces +x, positive turns toward +y / counter-clockwise).
 *
 * Need scale (documented):
 * - hunger / thirst: pressure — 0 = sated/quenched, 1 = maximum need
 * - energy: satisfaction — 0 = exhausted, 1 = fully rested
 *
 * Decision model (FLAME-80): unified intention arbitration is authoritative.
 * Intentions (what the creature is trying to accomplish) are distinct from
 * low-level actions (move/eat/search/…).
 */

import type { Habitat, HabitatFeatureKind, HabitatGenerationConfig, Vec2 } from '$lib/habitat';
import type {
	ActiveAnnouncementExecution,
	AnnouncementExecutionOutcome
} from './announcement/types';
import type { ArbitrationRecord, ArbitrationTrigger, IntentionKind } from './cognition/types';
import type { HeardSignal, SignalEmission, SymbolId } from './communication/types';
import type {
	ActiveSignalInvestigation,
	CreatureLexicon,
	LearningHistoryEntry,
	LexiconChangeEntry,
	SymbolAssociation
} from './learning/types';
import type { CreatureMemory } from './memory/types';
import type { EnvironmentState } from './resources/types';

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
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	SymbolAssociation
} from './learning/types';
export { LEXICON_MEANINGS } from './learning/types';
export type {
	ActiveAnnouncementExecution,
	AnnouncementExecutionOutcome,
	AnnouncementExecutionState,
	AnnouncementOutcomeReason,
	ClarityEvidence
} from './announcement/types';
export type {
	CreatureMemory,
	CreatureMemoryEntry,
	HeardSignalMemory,
	ResourceAnnouncementMemory,
	ResourceObservationMemory
} from './memory/types';
export type {
	ArbitrationInput,
	ArbitrationRecord,
	ArbitrationTrigger,
	CandidateFactor,
	CandidateReasonCode,
	CandidateReference,
	CognitionConfig,
	IntentionCandidate,
	IntentionKind,
	PerceivedResource
} from './cognition/types';

/** Current step used to pursue the intention. Distinct from intention. */
export type CreatureAction =
	'move' | 'investigate' | 'eat' | 'drink' | 'sleep' | 'wander' | 'search';

/**
 * A single food/water observation in the current perception snapshot.
 * Not long-term memory — only the latest sense result.
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
 * Resource location memory lives on {@link CreatureMemory}, not here.
 */
export type CreaturePerception = {
	/** Simulation time of the latest perception update. */
	lastUpdatedAt: number;
	perceivedFoodIds: string[];
	perceivedWaterIds: string[];
	/** Structured snapshot of currently perceived food/water only. */
	observations: ResourceObservation[];
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

/** Bounded history entry for intention/action transitions. */
export type BehaviourTransition = {
	timeSeconds: number;
	fromIntention: IntentionKind;
	toIntention: IntentionKind;
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
	/**
	 * Lifetime-stable preference for speech/communication intentions (domain [0, 1]).
	 * Sampled deterministically at creation from an independent seed channel.
	 * Generic trait — first consumer is announce_resource cognition scoring only.
	 * Not derived from needs, memory, lexicon, or current action; not mutated over time.
	 */
	verbosity: number;
	/**
	 * Lifetime-stable preference for optional information / novelty (domain [0, 1]).
	 * Sampled deterministically at creation from an independent seed channel.
	 * Generic trait — first consumer is optional investigate_signal cognition scoring only.
	 * Not derived from needs, memory, lexicon, or current action; not mutated over time.
	 * Does not gate validity or need-driven signal information value.
	 */
	curiosity: number;
	/** Wander stream destination (also mirrored in target when intention is wander). */
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

	/** Latest local sensing snapshot. */
	perception: CreaturePerception;

	/** Hunger pressure in [0, 1]; larger = more hungry. */
	hunger: number;
	/** Thirst pressure in [0, 1]; larger = more thirsty. */
	thirst: number;
	/** Energy satisfaction in [0, 1]; larger = more rested. */
	energy: number;

	/**
	 * First-class bounded memory of retained experience (not perception).
	 * Capacity is sampled at creation; entries are kind-discriminated.
	 */
	memory: CreatureMemory;

	/** What the creature is trying to accomplish (cognition-selected). */
	intention: IntentionKind;
	/** Concrete physical step under the current intention. */
	action: CreatureAction;
	target: CreatureTarget | null;
	/** Simulation time when the current intention was selected. */
	intentionStartedAt: number;
	/** Simulation time when the current action began. */
	actionStartedAt: number;
	/**
	 * Simulation time of the next ordinary (periodic) reconsideration.
	 * Heartbeat only — not commitment ownership.
	 */
	nextReconsiderAt: number;
	/**
	 * Event-driven arbitration request for the next behaviour step.
	 * Set after meaningful events (e.g. new heard_signal memory); cleared on arbitrate.
	 */
	pendingArbitrationTrigger: ArbitrationTrigger | null;

	/** Latest structured arbitration evidence (authoritative decision record). */
	lastArbitration: ArbitrationRecord | null;
	/** Recent intention/action transitions, newest last, length-capped. */
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
	 * Execution-local investigation context while travelling/inspecting a signal.
	 * Not a behaviour lock; ordinary arbitration may replace the intention.
	 */
	activeInvestigation: ActiveSignalInvestigation | null;
	/** Recent learning outcomes, newest last, length-capped. */
	recentLearning: LearningHistoryEntry[];

	/**
	 * Executor state for announce_resource intention (clarity / speaking position).
	 * Not a decision owner — cognition selects the intention; this only advances emit prep.
	 */
	activeAnnouncementExecution: ActiveAnnouncementExecution | null;
	/** Monotonic counter for stable execution diagnostic ids. */
	announcementExecutionCounter: number;
	/** Bounded recent announcement-execution outcomes for local diagnostics. */
	recentAnnouncementOutcomes: AnnouncementExecutionOutcome[];
};

export type SimulationState = {
	seed: string;
	/** Simulated seconds advanced by fixed steps. */
	timeSeconds: number;
	habitat: Habitat;
	/**
	 * Runtime resource/weather clocks and counters (plain serialisable).
	 * Initial schedules are deterministic from seed + config.
	 */
	environment: EnvironmentState;
	creatures: Creature[];
	/** Currently active (non-expired) emissions. */
	activeEmissions: SignalEmission[];
	/** Bounded recent emission history for diagnostics, newest last. */
	recentEmissions: SignalEmission[];
};

export type { EnvironmentState, FoodSpawnOutcome, WeatherPhase } from './resources/types';

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

	/** Minimum hunger pressure before satisfy_hunger is valid. */
	seekFoodThreshold: number;
	/** Minimum thirst pressure before satisfy_thirst is valid. */
	seekWaterThreshold: number;
	/** Minimum energy deficit (1 - energy) before rest is valid. */
	restThreshold: number;

	/** Fixed wander baseline score in unified arbitration. */
	wanderBaseline: number;
	/** Fixed investigate_signal baseline when heard_signal memory exists. */
	signalBaseline: number;
	/** Max recency boost added to signal baseline for newest memories. */
	signalRecencyBoostMax: number;
	/** Fixed announce_resource baseline when a valid unannounced resource is perceived. */
	announceBaseline: number;
	/** Soft continuity bonus for the current intention when still valid. */
	continuityBonus: number;
	/** Need score multiplier when a usable resource is currently perceived. */
	targetQualityVisible: number;
	/** Need score multiplier when only a remembered resource location is known. */
	targetQualityRemembered: number;
	/** Need score multiplier when the only path is blind search. */
	targetQualitySearch: number;

	/** Interval between ordinary (periodic) reconsiderations. Heartbeat only. */
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
	/** Max length of recentAnnouncementOutcomes (oldest dropped). */
	recentAnnouncementOutcomeHistoryLimit: number;

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

	/**
	 * Inclusive integer range for per-creature memory capacity sampled at creation
	 * (independent `deriveSeed(seed, 'memory-capacity', id)` stream).
	 * Min must be ≥ 1. Not derived from intelligence.
	 */
	memoryCapacityRange: { min: number; max: number };
	/**
	 * Characteristic length for presentation-only smooth distance falloff on signal rings:
	 * distanceFactor = 1 / (1 + distance / investigationDistanceScale).
	 * Does **not** affect investigation eligibility.
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

	// --- Finite renewable resources + minimal rain (FLAME-77) ---

	/**
	 * Maximum simultaneous food features (initial + runtime).
	 * Uneaten food cannot accumulate without bound.
	 */
	maxActiveFoodSources: number;
	/**
	 * Simulated seconds between runtime food-spawn opportunities.
	 * Time-driven only — never hunger-driven rescue.
	 */
	foodSpawnIntervalSeconds: number;
	/** Minimum simulated seconds between rain events (clear→rain schedule). */
	rainIntervalMinSeconds: number;
	/** Maximum simulated seconds between rain events. */
	rainIntervalMaxSeconds: number;
	/** How long weather stays `rain` after a rain event starts. */
	rainDurationSeconds: number;
};
