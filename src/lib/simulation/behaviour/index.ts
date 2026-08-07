/**
 * Creature behaviour subdomain: needs, actions, local perception, search, orchestration.
 * Intention selection lives in cognition; this package executes.
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
	waterTarget
} from './resource-awareness';
export {
	emptyPerception,
	isCurrentlyPerceived,
	selectNearestPerceived,
	senseAt,
	updatePerception
} from './perception';
export { circleIntersectsRect, queryFeaturesNear } from './habitat-feature-query';
export {
	actionForIntention,
	appendTransition,
	applyArbitration,
	transitionToConsumptive
} from './actions';
export { replanFromArbitration } from './apply-arbitration';
export {
	buildArbitrationInput,
	cognitionConfigFromSimulation,
	listAvailablePerceivedResources
} from './build-arbitration-input';
export {
	stepCreatureBehaviour,
	type BehaviourStepConfig,
	type CreatureBehaviourStepResult
} from './step-creature-behaviour';
