/**
 * Candidate goal evaluation, commitment, hysteresis and decision evidence.
 *
 * Deliberately small: no planner, behaviour tree or ML controller.
 */

import type { Habitat } from '$lib/habitat';
import type {
	CandidateEvaluation,
	Creature,
	CreatureGoal,
	DecisionRecord,
	DecisionTrigger,
	SimulationConfig
} from '../types';
import { foodTarget, homeTarget, pointTarget, waterTarget } from './resource-awareness';

/** Tie-break order when scores are equal (earlier wins). */
export const GOAL_TIE_BREAK_ORDER: readonly CreatureGoal[] = [
	'seek_food',
	'seek_water',
	'rest',
	'wander'
] as const;

const GOAL_RANK = Object.fromEntries(
	GOAL_TIE_BREAK_ORDER.map((goal, index) => [goal, index])
) as Record<CreatureGoal, number>;

export type DecisionConfig = Pick<
	SimulationConfig,
	| 'seekFoodThreshold'
	| 'seekWaterThreshold'
	| 'restThreshold'
	| 'goalSwitchMargin'
	| 'minGoalCommitmentSeconds'
	| 'reconsiderIntervalSeconds'
>;

/**
 * Baseline wander score. Need-driven goals must exceed this (and their thresholds)
 * to displace wandering; keeps free roaming the default when needs are mild.
 */
export const WANDER_BASELINE_SCORE = 0.35;

export function evaluateCandidates(
	creature: Pick<Creature, 'position' | 'hunger' | 'thirst' | 'energy' | 'wanderTarget'>,
	habitat: Habitat,
	config: DecisionConfig
): CandidateEvaluation[] {
	const food = foodTarget(creature.position, habitat);
	const water = waterTarget(creature.position, habitat);
	const home = homeTarget(habitat);
	const wander = pointTarget(creature.wanderTarget);

	const hungerScore = creature.hunger;
	const thirstScore = creature.thirst;
	const restScore = 1 - creature.energy;

	const foodValid = food !== null && hungerScore >= config.seekFoodThreshold;
	const waterValid = water !== null && thirstScore >= config.seekWaterThreshold;
	const restValid = restScore >= config.restThreshold;

	const candidates: CandidateEvaluation[] = [
		{
			goal: 'seek_food',
			valid: foodValid,
			score: hungerScore,
			reason: `hunger pressure ${hungerScore.toFixed(3)}`,
			target: food,
			rejectionReason: !food
				? 'no food sources in habitat'
				: hungerScore < config.seekFoodThreshold
					? `hunger ${hungerScore.toFixed(3)} below threshold ${config.seekFoodThreshold}`
					: undefined
		},
		{
			goal: 'seek_water',
			valid: waterValid,
			score: thirstScore,
			reason: `thirst pressure ${thirstScore.toFixed(3)}`,
			target: water,
			rejectionReason: !water
				? 'no water regions in habitat'
				: thirstScore < config.seekWaterThreshold
					? `thirst ${thirstScore.toFixed(3)} below threshold ${config.seekWaterThreshold}`
					: undefined
		},
		{
			goal: 'rest',
			valid: restValid,
			score: restScore,
			reason: `energy deficit ${restScore.toFixed(3)} (energy ${creature.energy.toFixed(3)})`,
			target: home,
			rejectionReason: !restValid
				? `energy deficit ${restScore.toFixed(3)} below threshold ${config.restThreshold}`
				: undefined
		},
		{
			goal: 'wander',
			valid: true,
			score: WANDER_BASELINE_SCORE,
			reason: `fallback baseline ${WANDER_BASELINE_SCORE}`,
			target: wander
		}
	];

	return candidates;
}

/**
 * Select among valid candidates: highest score, then fixed goal order (earlier wins).
 */
export function selectBestCandidate(
	candidates: readonly CandidateEvaluation[]
): CandidateEvaluation {
	const valid = candidates.filter((c) => c.valid);
	const pool = valid.length > 0 ? valid : candidates.filter((c) => c.goal === 'wander');
	let best = pool[0]!;
	for (let i = 1; i < pool.length; i += 1) {
		const candidate = pool[i]!;
		if (
			candidate.score > best.score ||
			(candidate.score === best.score && GOAL_RANK[candidate.goal] < GOAL_RANK[best.goal])
		) {
			best = candidate;
		}
	}
	return best;
}

export type CommitDecisionInput = {
	creature: Pick<
		Creature,
		| 'goal'
		| 'action'
		| 'target'
		| 'goalStartedAt'
		| 'hunger'
		| 'thirst'
		| 'energy'
		| 'position'
		| 'wanderTarget'
	>;
	habitat: Habitat;
	timeSeconds: number;
	trigger: DecisionTrigger;
	config: DecisionConfig;
};

/**
 * Evaluate candidates and apply hysteresis / min commitment for ordinary reconsider.
 * Immediate triggers (invalid_target, action_complete, initial) always accept the best goal.
 */
export function commitDecision(input: CommitDecisionInput): DecisionRecord {
	const { creature, habitat, timeSeconds, trigger, config } = input;
	const candidates = evaluateCandidates(creature, habitat, config);
	const best = selectBestCandidate(candidates);
	const currentEval = candidates.find((c) => c.goal === creature.goal);

	let selected = best;
	let selectionReason = `highest valid score ${best.score.toFixed(3)} (${best.reason})`;

	const forceSwitch =
		trigger === 'invalid_target' || trigger === 'action_complete' || trigger === 'initial';

	if (!forceSwitch && currentEval?.valid) {
		const heldFor = timeSeconds - creature.goalStartedAt;
		const commitmentMet = heldFor >= config.minGoalCommitmentSeconds;
		const beatsByMargin = best.score >= currentEval.score + config.goalSwitchMargin;
		const sameGoal = best.goal === creature.goal;

		if (sameGoal) {
			// Refresh evaluation/target for the continuing goal.
			selected = currentEval;
			selectionReason = `continue ${creature.goal} (score ${currentEval.score.toFixed(3)})`;
		} else if (!commitmentMet) {
			selected = currentEval;
			selectionReason = `hold ${creature.goal}: commitment ${heldFor.toFixed(3)}s < ${config.minGoalCommitmentSeconds}s`;
		} else if (!beatsByMargin) {
			selected = currentEval;
			selectionReason =
				`hold ${creature.goal}: challenger ${best.goal} score ${best.score.toFixed(3)} ` +
				`does not beat ${currentEval.score.toFixed(3)} + margin ${config.goalSwitchMargin}`;
		} else {
			selectionReason =
				`switch to ${best.goal}: score ${best.score.toFixed(3)} beats ` +
				`${creature.goal} ${currentEval.score.toFixed(3)} by margin`;
		}
	} else if (forceSwitch) {
		selectionReason = `${trigger}: select ${best.goal} (score ${best.score.toFixed(3)}; ${best.reason})`;
	}

	// Annotate rejection reasons on non-selected candidates for inspection.
	const annotated = candidates.map((c) => {
		if (c.goal === selected.goal) {
			const rest = { ...c };
			delete rest.rejectionReason;
			return rest;
		}
		if (!c.valid && c.rejectionReason) {
			return c;
		}
		if (c.valid && c.goal !== selected.goal) {
			return {
				...c,
				rejectionReason:
					c.rejectionReason ??
					`not selected; score ${c.score.toFixed(3)} vs ${selected.goal} ${selected.score.toFixed(3)}`
			};
		}
		return c;
	});

	return {
		timeSeconds,
		trigger,
		previousGoal: trigger === 'initial' ? null : creature.goal,
		selectedGoal: selected.goal,
		selectedTarget: selected.target,
		selectionReason,
		candidates: annotated
	};
}
