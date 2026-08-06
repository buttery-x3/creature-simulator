/**
 * Creature behaviour subdomain: needs, decisions, actions, temporary resource awareness.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export { advanceNeeds, clampNeed, recoveryComplete } from './needs';
export {
	foodTarget,
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
	commitDecision,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	selectBestCandidate,
	WANDER_BASELINE_SCORE
} from './decisions';
export { actionForGoal, appendTransition, applyDecision, transitionToConsumptive } from './actions';
export { stepCreatureBehaviour, type BehaviourStepConfig } from './step-creature-behaviour';
