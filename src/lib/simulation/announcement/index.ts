/**
 * Resource-announcement subdomain: kind-level clarity, speaking-position search,
 * and executor lifecycle under the announce_resource intention.
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
	getActiveOpportunity
} from './opportunity-lifecycle';

export {
	collectClarityCandidates,
	stepAnnouncement,
	type AnnouncementStepConfig,
	type AnnouncementStepResult
} from './step-announcement';
