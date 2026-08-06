/**
 * Learning subdomain: personal symbol associations and signal-guided investigation.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own emission, reception or goal selection — only pending candidates,
 * association updates, investigation evidence and learning histories.
 */

export type {
	ActiveSignalInvestigation,
	LearningHistoryEntry,
	LearningOutcome,
	PendingSignal,
	SymbolAssociation
} from './types';

export {
	applyNoEvidenceReduction,
	clampStrength,
	createEmptyAssociations,
	emptyAssociation,
	findAssociation,
	getOrCreateAssociation,
	reinforceAssociation
} from './signal-associations';

export {
	activeToPendingShape,
	appendLearningHistory,
	beginInvestigation,
	distanceFalloffFactor,
	expirePendingSignals,
	heardToPending,
	insertPendingFromHeard,
	isNearOrigin,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin,
	removePendingByEmissionId,
	scoreInvestigationCandidate,
	selectBestPendingSignal
} from './signal-investigation';

export {
	advanceActiveLearning,
	ingestHeardIntoPending,
	interruptInvestigation,
	resolveInvestigationAtSite,
	stepPostReceptionLearning,
	type LearningStepConfig
} from './step-signal-learning';
