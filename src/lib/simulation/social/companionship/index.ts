export { FOLLOW_DEFAULTS } from './defaults';
export {
	emptyCompanionshipState,
	hasCompanionDeparture,
	applyCompanionshipSelection,
	advanceCompanionship,
	finishCompanionship
} from './session';
export { observeCompanionship, hasVisiblePredecessor } from './observations';
export type {
	CompanionshipState,
	CompanionContact,
	FollowEpisode,
	CompanionOutcome,
	CompanionEndReason
} from './types';
