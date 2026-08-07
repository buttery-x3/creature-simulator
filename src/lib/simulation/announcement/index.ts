/**
 * Resource-announcement subdomain: perception-episode opportunities, kind-level
 * clarity, speaking-position search, and preparation lifecycle.
 *
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export type {
	AnnouncementCueState,
	AnnouncementOpportunity,
	AnnouncementOpportunityOutcome,
	AnnouncementOpportunityState,
	AnnouncementOutcomeReason,
	ClarityEvidence,
	NewlyPerceivedResource,
	ResourceFeaturePerceptionEpisode
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
	appendOpportunityDecisions,
	appendOutcome,
	buildOutcome,
	createOpportunitiesFromDiscoveries,
	emptyAnnouncementState,
	getActiveOpportunity,
	removeOpportunityAndPromote,
	updateOpportunity
} from './opportunity-lifecycle';

export {
	collectClarityCandidates,
	isAnnouncementLocked,
	stepAnnouncement,
	type AnnouncementStepConfig,
	type AnnouncementStepResult
} from './step-announcement';
