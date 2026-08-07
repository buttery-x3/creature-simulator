/**
 * Simulation public entry point.
 *
 * Owns authoritative simulation state, deterministic creature creation, fixed-step
 * advancement, unified intention arbitration and bounded movement. Presentation and
 * Svelte must not store creature authority inside Three.js objects.
 */

export type {
	ActiveSignalInvestigation,
	AnnouncementOpportunity,
	AnnouncementOpportunityDecision,
	AnnouncementOpportunityDecisionReason,
	AnnouncementOpportunityOutcome,
	AnnouncementOpportunityState,
	AnnouncementOutcomeReason,
	ArbitrationInput,
	ArbitrationRecord,
	ArbitrationTrigger,
	BehaviourTransition,
	CandidateFactor,
	CandidateReasonCode,
	CandidateReference,
	ClarityEvidence,
	CognitionConfig,
	Creature,
	CreatureAction,
	CreatureLexicon,
	CreatureMemory,
	CreatureMemoryEntry,
	CreaturePerception,
	CreatureTarget,
	EnvironmentState,
	FoodSpawnOutcome,
	HeardSignal,
	HeardSignalMemory,
	IntentionCandidate,
	IntentionKind,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	PerceivedResource,
	ResourceAnnouncementMemory,
	ResourceObservation,
	ResourceObservationMemory,
	SignalEmission,
	SimulationConfig,
	SimulationState,
	SpeedRange,
	SymbolAssociation,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence,
	SymbolSelectionMode,
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
	emptyPerception,
	isAtFeature,
	isAtTarget,
	isTargetValid,
	queryFeaturesNear,
	recoveryComplete,
	selectNearestFeature,
	senseAt
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
	createEmptyAssociations,
	distanceFalloffFactor,
	emptyLexicon,
	findAssociation,
	resolveCreatureLexicon
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
