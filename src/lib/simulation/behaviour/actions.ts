/**
 * Intention/action transitions and consumptive recovery handling.
 */

import type { IntentionKind } from '../cognition/types';
import type {
	ArbitrationRecord,
	BehaviourTransition,
	Creature,
	CreatureAction,
	CreatureTarget,
	SimulationConfig
} from '../types';

/**
 * Choose the action for an intention.
 * Need intentions without a usable resource/feature target enter `search` (not wander).
 * Signal investigation: move to origin, then `investigate` (stop and inspect).
 * Announcement: move/reposition only (never consumptive).
 */
export function actionForIntention(
	intention: IntentionKind,
	arrived: boolean,
	hasUsableFeatureTarget: boolean
): CreatureAction {
	if (intention === 'wander') {
		return 'wander';
	}
	if (intention === 'investigate_signal') {
		return arrived ? 'investigate' : 'move';
	}
	if (intention === 'announce_resource') {
		return 'move';
	}
	if (intention === 'satisfy_hunger' || intention === 'satisfy_thirst') {
		if (!hasUsableFeatureTarget) {
			return 'search';
		}
		if (!arrived) {
			return 'move';
		}
		return intention === 'satisfy_hunger' ? 'eat' : 'drink';
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

export type ApplyArbitrationResult = {
	intention: IntentionKind;
	action: CreatureAction;
	target: Creature['target'];
	intentionStartedAt: number;
	actionStartedAt: number;
	nextReconsiderAt: number;
	pendingArbitrationTrigger: null;
	lastArbitration: ArbitrationRecord;
	recentTransitions: BehaviourTransition[];
};

function intentionHasFeatureTarget(
	target: CreatureTarget | null,
	intention: IntentionKind
): boolean {
	if (
		intention === 'wander' ||
		intention === 'investigate_signal' ||
		intention === 'announce_resource'
	) {
		return false;
	}
	if (intention === 'rest') {
		return target?.kind === 'feature' && target.featureKind === 'home';
	}
	return (
		target?.kind === 'feature' &&
		((intention === 'satisfy_hunger' && target.featureKind === 'food') ||
			(intention === 'satisfy_thirst' && target.featureKind === 'water'))
	);
}

function selectionReasonText(record: ArbitrationRecord): string {
	const codes = record.selectionReasonCodes.join(',');
	const selected = record.candidates.find((c) => c.intention === record.selectedIntention);
	const score = selected?.score;
	return score !== undefined
		? `${record.trigger}: ${record.selectedIntention} (${codes}; score ${score.toFixed(3)})`
		: `${record.trigger}: ${record.selectedIntention} (${codes})`;
}

/**
 * Apply an arbitration record onto creature behaviour fields.
 * `arrived` controls whether a need intention starts as move or consumptive action.
 */
export function applyArbitration(
	creature: Pick<
		Creature,
		| 'intention'
		| 'action'
		| 'target'
		| 'intentionStartedAt'
		| 'actionStartedAt'
		| 'recentTransitions'
	>,
	record: ArbitrationRecord,
	arrived: boolean,
	config: Pick<SimulationConfig, 'reconsiderIntervalSeconds' | 'decisionHistoryLimit'>
): ApplyArbitrationResult {
	const intention = record.selectedIntention;
	const hasFeature = intentionHasFeatureTarget(record.selectedTarget, intention);
	const action = actionForIntention(intention, arrived && hasFeature, hasFeature);
	const target = record.selectedTarget;
	const intentionChanged = intention !== creature.intention;
	const actionChanged = action !== creature.action;

	let recentTransitions = creature.recentTransitions;
	if (intentionChanged || actionChanged) {
		recentTransitions = appendTransition(
			creature.recentTransitions,
			{
				timeSeconds: record.timeSeconds,
				fromIntention: creature.intention,
				toIntention: intention,
				fromAction: creature.action,
				toAction: action,
				reason: selectionReasonText(record)
			},
			config.decisionHistoryLimit
		);
	}

	return {
		intention,
		action,
		target,
		intentionStartedAt: intentionChanged ? record.timeSeconds : creature.intentionStartedAt,
		actionStartedAt: actionChanged ? record.timeSeconds : creature.actionStartedAt,
		nextReconsiderAt: record.timeSeconds + config.reconsiderIntervalSeconds,
		pendingArbitrationTrigger: null,
		lastArbitration: record,
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
	const hasFeature = intentionHasFeatureTarget(creature.target, creature.intention);
	const nextAction = actionForIntention(creature.intention, true, hasFeature);
	if (nextAction === 'move' || nextAction === 'wander' || nextAction === 'search') {
		return null;
	}

	const recentTransitions = appendTransition(
		creature.recentTransitions,
		{
			timeSeconds,
			fromIntention: creature.intention,
			toIntention: creature.intention,
			fromAction: creature.action,
			toAction: nextAction,
			reason: `arrived at target; begin ${nextAction}`
		},
		config.decisionHistoryLimit
	);

	return {
		action: nextAction,
		actionStartedAt: timeSeconds,
		recentTransitions
	};
}
