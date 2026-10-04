export type {
	ExpressionKind,
	InnateExpression,
	PeerObservation,
	Relationship,
	SocialState,
	MoodSnapshot
} from './types';
export { SOCIAL_DEFAULTS } from './defaults';
export { emptySocialState, updateRelationships } from './relationships';
export { observePeers } from './observe-peers';
export {
	advanceSocial,
	deriveMood,
	recordInjury,
	executeExpression,
	type MoodInput
} from './expressions';

export {
	FOLLOW_DEFAULTS,
	emptyCompanionshipState,
	hasCompanionDeparture,
	applyCompanionshipSelection,
	advanceCompanionship,
	finishCompanionship,
	observeCompanionship,
	hasVisiblePredecessor
} from './companionship';
export type {
	CompanionshipState,
	CompanionContact,
	FollowEpisode,
	CompanionOutcome,
	CompanionEndReason
} from './companionship';
