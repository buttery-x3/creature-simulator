/**
 * Cognition subdomain: pure memory-aware continuous intention arbitration.
 *
 * FLAME-79 builds the replacement decision model; FLAME-80 wires it into the
 * step loop and removes legacy goal/lock/opportunity ownership.
 *
 * Does not own movement, emission, perception sensing, or memory writes.
 */

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
} from './types';

export { INTENTION_RANK, INTENTION_TIE_BREAK_ORDER } from './types';

export { DEFAULT_COGNITION_CONFIG, mergeCognitionConfig } from './score-constants';

export { SPEECH_WEIGHT_FLOOR, SPEECH_WEIGHT_SPAN, verbosityToSpeechWeight } from './speech-weight';

export {
	CURIOSITY_WEIGHT_FLOOR,
	CURIOSITY_WEIGHT_SPAN,
	curiosityToInvestigationWeight
} from './curiosity-weight';

export {
	homeTarget,
	selectAnnounceTarget,
	selectNearestPerceivedResource,
	selectResourceNeedTarget,
	selectSignalInvestigationTarget
} from './target-selection';

export { buildCandidates } from './build-candidates';

export {
	annotateSelection,
	applyContinuity,
	buildArbitrationRecord,
	selectBestCandidate
} from './select-intention';

export { arbitrate } from './arbitrate';
