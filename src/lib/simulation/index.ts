/**
 * Simulation public entry point.
 *
 * Owns authoritative simulation state, deterministic creature creation, fixed-step
 * advancement, needs-driven decisions and bounded movement. Presentation and Svelte
 * must not store creature authority inside Three.js objects.
 */

export type {
	ActiveSignalInvestigation,
	AnnouncementOpportunity,
	AnnouncementOpportunityDecision,
	AnnouncementOpportunityDecisionReason,
	AnnouncementOpportunityOutcome,
	AnnouncementOpportunityState,
	AnnouncementOutcomeReason,
	BehaviourTransition,
	CandidateEvaluation,
	ClarityEvidence,
	Creature,
	CreatureAction,
	CreatureGoal,
	CreatureLexicon,
	CreatureMemory,
	CreatureMemoryEntry,
	CreaturePerception,
	CreatureTarget,
	DecisionRecord,
	DecisionTrigger,
	HeardSignal,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	NewlyPerceivedResource,
	PendingSignal,
	ResourceAnnouncementMemory,
	ResourceFeaturePerceptionEpisode,
	ResourceObservation,
	SignalEmission,
	SignalInvestigationOpportunity,
	SimulationConfig,
	SimulationState,
	SpeedRange,
	SymbolAssociation,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence,
	SymbolSelectionMode,
	CuriosityDecision,
	CuriosityEvidence
} from './types';

export { DEFAULT_SYMBOL_INVENTORY, LEXICON_MEANINGS } from './types';

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
	moveToward,
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
	INVESTIGATION_ELIGIBLE_SCORE,
	WANDER_BASELINE_SCORE
} from './behaviour';
export {
	expireEmissions,
	selectContextSymbol,
	selectPreferredSymbol,
	selectReceivers,
	stepCommunication,
	type EmissionRequest
} from './communication';

export {
	countAcceptedPending,
	createEmptyAssociations,
	decideCuriosityAcceptance,
	distanceFalloffFactor,
	emptyLexicon,
	findAssociation,
	mostRecentCuriosityDecision,
	resolveCreatureLexicon,
	selectBestAcceptedOpportunity,
	selectBestPendingSignal
} from './learning';

export {
	applySuccessfulAnnouncementMemories,
	countMemoryEntries,
	createEmptyMemory,
	ensureCreatureMemory,
	findResourceAnnouncementMemory,
	hasResourceAnnouncementMemory,
	isValidCreatureMemory,
	memoryUsage,
	rememberResourceAnnouncement,
	sampleMemoryCapacity
} from './memory';
