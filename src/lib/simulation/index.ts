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
	EnvironmentState,
	FoodSpawnOutcome,
	HeardSignal,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	NewlyPerceivedResource,
	PendingSignal,
	HeardSignalMemory,
	ResourceAnnouncementMemory,
	ResourceFeaturePerceptionEpisode,
	ResourceObservation,
	ResourceObservationMemory,
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
	CuriosityEvidence,
	WeatherPhase
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
	type CommunicationStepResult,
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
	applyHeardSignalMemories,
	applyResourceObservationMemories,
	applySuccessfulAnnouncementMemories,
	countMemoryEntries,
	createEmptyMemory,
	ensureCreatureMemory,
	findHeardSignalMemory,
	findNewestUsableResourceObservation,
	findResourceAnnouncementMemory,
	findResourceObservationMemory,
	hasHeardSignalMemory,
	hasResourceAnnouncementMemory,
	hasResourceObservationMemory,
	isValidCreatureMemory,
	listHeardSignalMemories,
	listResourceObservations,
	memoryUsage,
	rememberHeardSignal,
	rememberResourceAnnouncement,
	rememberResourceObservation,
	sampleMemoryCapacity
} from './memory';

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
} from './cognition';

export {
	arbitrate,
	buildCandidates,
	DEFAULT_COGNITION_CONFIG,
	INTENTION_RANK,
	INTENTION_TIE_BREAK_ORDER,
	mergeCognitionConfig,
	selectBestCandidate as selectBestIntentionCandidate
} from './cognition';

export {
	createInitialEnvironment,
	emptyGrant,
	filterAvailableResources,
	isResourceAvailable,
	resolveConsumption,
	stepResources
} from './resources';
