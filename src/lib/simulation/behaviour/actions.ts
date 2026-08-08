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
 *
 * Need intentions:
 * - no target → `search` (no useful knowledge)
 * - feature target → move / eat / drink
 * - point target (remembered belief) → move toward stored position (never search)
 *
 * Signal investigation: move to origin, then `investigate`.
 * Announcement: move/reposition only (never consumptive).
 */
export function actionForIntention(
	intention: IntentionKind,
	arrived: boolean,
	hasUsableFeatureTarget: boolean,
	hasConcreteDestination = hasUsableFeatureTarget
): CreatureAction {
	if (intention === 'explore') {
		return 'explore';
	}
	if (intention === 'investigate_signal') {
		return arrived ? 'investigate' : 'move';
	}
	if (intention === 'announce_resource') {
		return 'move';
	}
	if (intention === 'satisfy_hunger' || intention === 'satisfy_thirst') {
		// Search only when cognition supplied no destination (search_fallback).
		if (!hasConcreteDestination) {
			return 'search';
		}
		if (!arrived) {
			return 'move';
		}
		// Consumptive only on authoritative feature targets (not remembered points).
		if (!hasUsableFeatureTarget) {
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
		intention === 'explore' ||
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

/** True when the intention has a navigation destination (feature or remembered point). */
function intentionHasConcreteDestination(
	target: CreatureTarget | null,
	intention: IntentionKind
): boolean {
	if (intentionHasFeatureTarget(target, intention)) {
		return true;
	}
	if (
		(intention === 'satisfy_hunger' || intention === 'satisfy_thirst') &&
		target?.kind === 'point'
	) {
		return Number.isFinite(target.position.x) && Number.isFinite(target.position.y);
	}
	if (intention === 'investigate_signal' && target?.kind === 'point') {
		return Number.isFinite(target.position.x) && Number.isFinite(target.position.y);
	}
	if (intention === 'announce_resource') {
		return target !== null;
	}
	return false;
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
	const hasDestination = intentionHasConcreteDestination(record.selectedTarget, intention);
	const action = actionForIntention(
		intention,
		arrived && (hasFeature || hasDestination),
		hasFeature,
		hasDestination
	);
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
	const hasDestination = intentionHasConcreteDestination(creature.target, creature.intention);
	const nextAction = actionForIntention(creature.intention, true, hasFeature, hasDestination);
	if (nextAction === 'move' || nextAction === 'explore' || nextAction === 'search') {
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
