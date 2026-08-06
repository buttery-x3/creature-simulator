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
import type { HeardSignal, SignalEmission, SymbolId } from './communication/types';
import type {
	ActiveSignalInvestigation,
	LearningHistoryEntry,
	PendingSignal,
	SymbolAssociation
} from './learning/types';

export type { HeardSignal, SignalEmission, SymbolId } from './communication/types';
export { DEFAULT_SYMBOL_INVENTORY } from './communication/types';
export type {
	ActiveSignalInvestigation,
	LearningHistoryEntry,
	LearningOutcome,
	PendingSignal,
	SymbolAssociation
} from './learning/types';

/** Outcome the creature is currently pursuing. */
export type CreatureGoal = 'seek_food' | 'seek_water' | 'rest' | 'investigate_signal' | 'wander';

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
	 * Personal food/water association strengths per symbol.
	 * Independent per creature; starts with no semantic knowledge.
	 */
	symbolAssociations: SymbolAssociation[];
	/** Short-lived heard-signal investigation candidates (bounded, deduped). */
	pendingSignals: PendingSignal[];
	/** Active signal investigation evidence, if any. */
	activeInvestigation: ActiveSignalInvestigation | null;
	/** Recent learning outcomes, newest last, length-capped. */
	recentLearning: LearningHistoryEntry[];
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

	/** How long a pending heard signal remains an investigation candidate. */
	pendingSignalLifetimeSeconds: number;
	/** Max pending investigation candidates per creature. */
	maxPendingSignalsPerCreature: number;
	/**
	 * Inclusive range for per-creature curiosity sampled at creation
	 * (independent `deriveSeed(seed, 'curiosity', id)` stream).
	 */
	curiosityRange: { min: number; max: number };
	/** Multiplier applied to creature.curiosity in investigation scoring. */
	investigationCuriosityWeight: number;
	/**
	 * Characteristic length for smooth distance falloff:
	 * distanceFactor = 1 / (1 + distance / investigationDistanceScale).
	 */
	investigationDistanceScale: number;
	/** Weight of normalised age penalty in investigation scoring. */
	investigationAgeWeight: number;
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
