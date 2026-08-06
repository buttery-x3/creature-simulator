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

/** Outcome the creature is currently pursuing. */
export type CreatureGoal = 'seek_food' | 'seek_water' | 'rest' | 'wander';

/** Current step used to pursue the goal. Distinct from goal. */
export type CreatureAction = 'move' | 'eat' | 'drink' | 'sleep' | 'wander';

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

	/** Hunger pressure in [0, 1]; larger = more hungry. */
	hunger: number;
	/** Thirst pressure in [0, 1]; larger = more thirsty. */
	thirst: number;
	/** Energy satisfaction in [0, 1]; larger = more rested. */
	energy: number;

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
};

export type SimulationState = {
	seed: string;
	/** Simulated seconds advanced by fixed steps. */
	timeSeconds: number;
	habitat: Habitat;
	creatures: Creature[];
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

	/** Initial hunger pressure at creation (fixed for determinism). */
	initialHunger: number;
	/** Initial thirst pressure at creation. */
	initialThirst: number;
	/** Initial energy satisfaction at creation. */
	initialEnergy: number;
};
