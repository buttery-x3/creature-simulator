/**
 * Creature behaviour subdomain: needs, decisions, actions, local perception, search.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export { advanceNeeds, clampNeed, recoveryComplete } from './needs';
export {
	ensureSearchTarget,
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
	tryPerceiveAndPursue,
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
	INVESTIGATION_ELIGIBLE_SCORE,
	isExploreExemption,
	selectBestCandidate,
	WANDER_BASELINE_SCORE
} from './decisions';
export { actionForGoal, appendTransition, applyDecision, transitionToConsumptive } from './actions';
export {
	stepCreatureBehaviour,
	type BehaviourStepConfig,
	type CreatureBehaviourStepResult
} from './step-creature-behaviour';
