/**
 * Simulation public entry point.
 *
 * Owns authoritative simulation state, deterministic creature creation, fixed-step
 * advancement, needs-driven decisions and bounded movement. Presentation and Svelte
 * must not store creature authority inside Three.js objects.
 */

export type {
	ActiveSignalInvestigation,
	BehaviourTransition,
	CandidateEvaluation,
	Creature,
	CreatureAction,
	CreatureGoal,
	CreaturePerception,
	CreatureTarget,
	DecisionRecord,
	DecisionTrigger,
	HeardSignal,
	LearningHistoryEntry,
	LearningOutcome,
	PendingSignal,
	ResourceObservation,
	SignalEmission,
	SimulationConfig,
	SimulationState,
	SpeedRange,
	SymbolAssociation,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence
} from './types';

export { DEFAULT_SYMBOL_INVENTORY } from './types';

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
	sampleSearchTarget,
	sampleWanderTarget,
	shortestAngleDelta,
	stepCreature
} from './creature-movement';

export { formatCreatureInspection, formatSimulationDiagnostics } from './diagnostics';

export {
	buildPopulationSymbolDiagnostics,
	formatPopulationSymbolDiagnostics,
	type ContextPopulationSummary,
	type PopulationSymbolDiagnostics,
	type SymbolContextAssociationSummary,
	type SymbolContextEmissionSummary
} from './population-symbol-diagnostics';

export {
	advanceNeeds,
	clampNeed,
	commitDecision,
	emptyPerception,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	isAtFeature,
	isAtTarget,
	isTargetValid,
	queryFeaturesNear,
	recoveryComplete,
	selectBestCandidate,
	selectNearestFeature,
	senseAt,
	WANDER_BASELINE_SCORE
} from './behaviour';

export {
	buildEmissionWeights,
	expireEmissions,
	selectContextSymbol,
	selectPreferredSymbol,
	selectReceivers,
	stepCommunication,
	type EmissionRequest
} from './communication';

export {
	createEmptyAssociations,
	distanceFalloffFactor,
	findAssociation,
	scoreInvestigationCandidate,
	selectBestPendingSignal
} from './learning';
