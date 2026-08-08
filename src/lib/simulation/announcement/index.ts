/**
 * Resource-announcement subdomain: kind-level clarity, speaking-position search,
 * and executor lifecycle under the announce_resource intention.
 *
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export type {
	ActiveAnnouncementExecution,
	AnnouncementExecutionOutcome,
	AnnouncementExecutionState,
	AnnouncementOutcomeReason,
	ClarityEvidence
} from './types';

export {
	evaluateKindClarity,
	nearestKindDistance,
	type ClarityResourceCandidate,
	type EvaluateKindClarityInput
} from './clarity';

export {
	findSpeakingPosition,
	type FindSpeakingPositionInput,
	type SpeakingPositionConfig,
	type SpeakingPositionResult
} from './speaking-position';

export {
	appendOutcome,
	buildOutcome,
	emptyAnnouncementState,
	getActiveExecution
} from './execution-state';

export {
	collectClarityCandidates,
	stepAnnouncement,
	type AnnouncementStepConfig,
	type AnnouncementStepResult
} from './step-announcement';
