/**
 * Creature behaviour subdomain: needs, decisions, actions, local perception, search.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export { advanceNeeds, clampNeed, recoveryComplete } from './needs';
export {
	foodTarget,
	hasUsableResourceTarget,
	homeTarget,
	isAtFeature,
	isAtTarget,
	isTargetValid,
	movementPoint,
	pointTarget,
	resolveFeature,
	selectNearestFeature,
	waterTarget
} from './resource-awareness';
export {
	clearTracked,
	emptyPerception,
	isCurrentlyPerceived,
	isTrackedUsable,
	selectNearestPerceived,
	senseAt,
	startTracking,
	updatePerception
} from './perception';
export { circleIntersectsRect, queryFeaturesNear } from './habitat-feature-query';
export {
	commitDecision,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	selectBestCandidate,
	WANDER_BASELINE_SCORE
} from './decisions';
export { actionForGoal, appendTransition, applyDecision, transitionToConsumptive } from './actions';
export { stepCreatureBehaviour, type BehaviourStepConfig } from './step-creature-behaviour';
