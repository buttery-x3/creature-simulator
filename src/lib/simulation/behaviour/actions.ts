/**
 * Goal/action transitions and consumptive recovery handling.
 */

import type {
	BehaviourTransition,
	Creature,
	CreatureAction,
	CreatureGoal,
	DecisionRecord,
	SimulationConfig
} from '../types';

export function actionForGoal(goal: CreatureGoal, arrived: boolean): CreatureAction {
	if (goal === 'wander') {
		return 'wander';
	}
	if (!arrived) {
		return 'move';
	}
	switch (goal) {
		case 'seek_food':
			return 'eat';
		case 'seek_water':
			return 'drink';
		case 'rest':
			return 'sleep';
	}
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
	const action = actionForGoal(goal, arrived);
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
 * Transition move → consumptive action on arrival without a full replan.
 */
export function transitionToConsumptive(
	creature: Creature,
	timeSeconds: number,
	config: Pick<SimulationConfig, 'decisionHistoryLimit' | 'reconsiderIntervalSeconds'>
): Partial<Creature> | null {
	if (creature.action !== 'move') {
		return null;
	}
	const nextAction = actionForGoal(creature.goal, true);
	if (nextAction === 'move' || nextAction === 'wander') {
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
		// Keep nextReconsiderAt; consumptive completion will force replan.
		recentTransitions
	};
}
