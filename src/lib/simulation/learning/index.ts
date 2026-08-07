/**
 * Learning subdomain: personal symbol evidence, exclusive lexicon, investigation execution.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 *
 * Does not own emission, reception or intention selection — only investigation
 * execution context, evidence updates, lexicon resolution, and learning histories.
 */

export type {
	ActiveSignalInvestigation,
	CreatureLexicon,
	LearningHistoryEntry,
	LearningOutcome,
	LexiconChangeEntry,
	LexiconMeaning,
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
	appendLearningHistory,
	beginInvestigation,
	distanceFalloffFactor,
	isNearOrigin,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin
} from './signal-investigation';

export {
	interruptInvestigation,
	resolveInvestigationAtSite,
	type LearningStepConfig
} from './step-signal-learning';
