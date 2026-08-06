/**
 * Learning subdomain: personal symbol evidence, exclusive lexicon, signal investigation.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own emission, reception or goal selection — only pending candidates,
 * evidence updates, lexicon resolution, investigation and learning histories.
 */

export type {
	ActiveSignalInvestigation,
	CreatureLexicon,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
	PendingSignal,
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
