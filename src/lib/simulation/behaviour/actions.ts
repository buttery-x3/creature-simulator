/**
 * Goal/action transitions and consumptive recovery handling.
 */

import type {
	BehaviourTransition,
	Creature,
	CreatureAction,
	CreatureGoal,
	CreatureTarget,
	DecisionRecord,
	SimulationConfig
} from '../types';

/**
 * Choose the action for a goal.
 * Need goals without a usable resource/feature target enter `search` (not wander).
 * Rest without home is not expected; if target missing, search is not used for rest.
 * Signal investigation: move to origin, then `investigate` (stop and inspect — no movement).
 */
export function actionForGoal(
	goal: CreatureGoal,
	arrived: boolean,
	hasUsableFeatureTarget: boolean
): CreatureAction {
	if (goal === 'wander') {
		return 'wander';
	}
	if (goal === 'investigate_signal') {
		return arrived ? 'investigate' : 'move';
	}
	if (goal === 'prepare_announcement') {
		// Stay at speaking point (or keep moving toward it); never consumptive.
		return 'move';
	}
	if (goal === 'seek_food' || goal === 'seek_water') {
		if (!hasUsableFeatureTarget) {
			return 'search';
		}
		if (!arrived) {
			return 'move';
		}
		return goal === 'seek_food' ? 'eat' : 'drink';
	}
	// rest
	if (!arrived) {
		return 'move';
	}
	return 'sleep';
}

export function appendTransition(
	history: readonly BehaviourTransition[],
	entry: BehaviourTransition,
	limit: number
): BehaviourTransition[] {
	const next = [...history, entry];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

export type ApplyDecisionResult = {
	goal: CreatureGoal;
	action: CreatureAction;
	target: Creature['target'];
	goalStartedAt: number;
	actionStartedAt: number;
	nextReconsiderAt: number;
	lastDecision: DecisionRecord;
	lastCandidates: DecisionRecord['candidates'];
	recentTransitions: BehaviourTransition[];
};

function decisionHasFeatureTarget(target: CreatureTarget | null, goal: CreatureGoal): boolean {
	if (goal === 'wander' || goal === 'investigate_signal' || goal === 'prepare_announcement') {
		return false;
	}
	if (goal === 'rest') {
		return target?.kind === 'feature' && target.featureKind === 'home';
	}
	return (
		target?.kind === 'feature' &&
		((goal === 'seek_food' && target.featureKind === 'food') ||
			(goal === 'seek_water' && target.featureKind === 'water'))
	);
}

/**
 * Apply a decision record onto creature behaviour fields.
 * `arrived` controls whether a need goal starts as move or consumptive action.
 */
export function applyDecision(
	creature: Pick<
		Creature,
		'goal' | 'action' | 'target' | 'goalStartedAt' | 'actionStartedAt' | 'recentTransitions'
	>,
	decision: DecisionRecord,
	arrived: boolean,
	config: Pick<SimulationConfig, 'reconsiderIntervalSeconds' | 'decisionHistoryLimit'>
): ApplyDecisionResult {
	const goal = decision.selectedGoal;
	const hasFeature = decisionHasFeatureTarget(decision.selectedTarget, goal);
	const action = actionForGoal(goal, arrived && hasFeature, hasFeature);
	const target = decision.selectedTarget;
	const goalChanged = goal !== creature.goal;
	const actionChanged = action !== creature.action;

	let recentTransitions = creature.recentTransitions;
	if (goalChanged || actionChanged) {
		recentTransitions = appendTransition(
			creature.recentTransitions,
			{
				timeSeconds: decision.timeSeconds,
				fromGoal: creature.goal,
				toGoal: goal,
				fromAction: creature.action,
				toAction: action,
				reason: decision.selectionReason
			},
			config.decisionHistoryLimit
		);
	}

	return {
		goal,
		action,
		target,
		goalStartedAt: goalChanged ? decision.timeSeconds : creature.goalStartedAt,
		actionStartedAt: actionChanged ? decision.timeSeconds : creature.actionStartedAt,
		nextReconsiderAt: decision.timeSeconds + config.reconsiderIntervalSeconds,
		lastDecision: decision,
		lastCandidates: decision.candidates,
		recentTransitions
	};
}

/**
 * Transition move → consumptive or investigate action on arrival without a full replan.
 */
export function transitionToConsumptive(
	creature: Creature,
	timeSeconds: number,
	config: Pick<SimulationConfig, 'decisionHistoryLimit' | 'reconsiderIntervalSeconds'>
): Partial<Creature> | null {
	if (creature.action !== 'move') {
		return null;
	}
	const hasFeature = decisionHasFeatureTarget(creature.target, creature.goal);
	const nextAction = actionForGoal(creature.goal, true, hasFeature);
	if (nextAction === 'move' || nextAction === 'wander' || nextAction === 'search') {
		return null;
	}

	const recentTransitions = appendTransition(
		creature.recentTransitions,
		{
			timeSeconds,
			fromGoal: creature.goal,
			toGoal: creature.goal,
			fromAction: creature.action,
			toAction: nextAction,
			reason: `arrived at target; begin ${nextAction}`
		},
		config.decisionHistoryLimit
	);

	return {
		action: nextAction,
		actionStartedAt: timeSeconds,
		// Keep nextReconsiderAt; consumptive / investigation completion will force replan.
		recentTransitions
	};
}
