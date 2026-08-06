/**
 * Simulation public entry point.
 *
 * Owns authoritative simulation state, deterministic creature creation, fixed-step
 * advancement, needs-driven decisions and bounded movement. Presentation and Svelte
 * must not store creature authority inside Three.js objects.
 */

export type {
	BehaviourTransition,
	CandidateEvaluation,
	Creature,
	CreatureAction,
	CreatureGoal,
	CreatureTarget,
	DecisionRecord,
	DecisionTrigger,
	SimulationConfig,
	SimulationState,
	SpeedRange
} from './types';

export {
	DEFAULT_SIMULATION_CONFIG,
	SimulationCreationError,
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot
} from './create-simulation';

export { advanceSimulation, stepSimulation, type CatchUpResult } from './step-simulation';

export {
	clampToInterior,
	distanceSquared,
	interiorPositionBounds,
	normalizeAngle,
	sampleInteriorPoint,
	sampleWanderTarget,
	shortestAngleDelta,
	stepCreature
} from './creature-movement';

export { formatCreatureInspection, formatSimulationDiagnostics } from './diagnostics';

export {
	advanceNeeds,
	clampNeed,
	commitDecision,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	isAtFeature,
	isAtTarget,
	isTargetValid,
	recoveryComplete,
	selectBestCandidate,
	selectNearestFeature,
	WANDER_BASELINE_SCORE
} from './behaviour';
