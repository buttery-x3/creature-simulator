/**
 * Learning subdomain: personal symbol evidence, exclusive lexicon, signal investigation.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own emission, reception or goal selection — only investigation opportunities,
 * evidence updates, lexicon resolution, and learning histories.
 */

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
} from './types';

export { LEXICON_MEANINGS } from './types';

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
	appendLexiconHistory,
	applyLexiconResolution,
	diffLexiconChanges,
	emptyLexicon,
	resolveCreatureLexicon,
	type LexiconResolveConfig,
	type LexiconResolveResult
} from './lexicon-resolution';

export {
	activeToPendingShape,
	appendLearningHistory,
	beginInvestigation,
	countAcceptedPending,
	CURIOSITY_SAMPLE_CHANNEL,
	decideCuriosityAcceptance,
	distanceFalloffFactor,
	expirePendingSignals,
	heardToOpportunity,
	heardToPending,
	insertPendingFromHeard,
	isNearOrigin,
	mostRecentCuriosityDecision,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin,
	removePendingByEmissionId,
	selectBestAcceptedOpportunity,
	selectBestPendingSignal,
	type InvestigationSelection
} from './signal-investigation';

export {
	advanceActiveLearning,
	ingestHeardIntoPending,
	interruptInvestigation,
	resolveInvestigationAtSite,
	stepPostReceptionLearning,
	type LearningStepConfig
} from './step-signal-learning';
