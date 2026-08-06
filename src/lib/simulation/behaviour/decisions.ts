/**
 * Candidate goal evaluation, commitment, hysteresis and decision evidence.
 *
 * Deliberately small: no planner, behaviour tree or ML controller.
 * Food/water targets come from local perception/track only; missing targets
 * leave the need goal valid so the action layer can enter search.
 *
 * Explore exemption: wander → investigate_signal skips goalSwitchMargin so
 * unknown signals can displace ordinary wandering on a normal reconsider.
 */

import type { Habitat } from '$lib/habitat';
import {
	activeToPendingShape,
	scoreInvestigationCandidate,
	selectBestPendingSignal
} from '../learning/signal-investigation';
import type {
	CandidateEvaluation,
	Creature,
	CreatureGoal,
	DecisionRecord,
	DecisionTrigger,
	SimulationConfig
} from '../types';
import { foodTarget, homeTarget, pointTarget, waterTarget } from './resource-awareness';

/**
 * Tie-break order when scores are equal (earlier wins).
 * Survival goals beat investigation; investigation beats wander at equal score.
 */
export const GOAL_TIE_BREAK_ORDER: readonly CreatureGoal[] = [
	'seek_food',
	'seek_water',
	'rest',
	'investigate_signal',
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
	| 'trackedObservationDurationSeconds'
	| 'pendingSignalLifetimeSeconds'
	| 'investigationCuriosityWeight'
	| 'investigationDistanceScale'
	| 'investigationAgeWeight'
>;

/**
 * Baseline wander score. Need-driven goals must exceed this (and their thresholds)
 * to displace wandering; keeps free roaming the default when needs are mild.
 */
export const WANDER_BASELINE_SCORE = 0.35;

export function evaluateCandidates(
	creature: Pick<
		Creature,
		| 'position'
		| 'hunger'
		| 'thirst'
		| 'energy'
		| 'curiosity'
		| 'wanderTarget'
		| 'perception'
		| 'pendingSignals'
		| 'symbolAssociations'
		| 'activeInvestigation'
		| 'goal'
	>,
	habitat: Habitat,
	config: DecisionConfig,
	timeSeconds: number
): CandidateEvaluation[] {
	const trackDuration = config.trackedObservationDurationSeconds;
	const food = foodTarget(
		creature.position,
		habitat,
		creature.perception,
		timeSeconds,
		trackDuration
	);
	const water = waterTarget(
		creature.position,
		habitat,
		creature.perception,
		timeSeconds,
		trackDuration
	);
	const home = homeTarget(habitat);
	const wander = pointTarget(creature.wanderTarget);

	const hungerScore = creature.hunger;
	const thirstScore = creature.thirst;
	const restScore = 1 - creature.energy;

	const foodValid = hungerScore >= config.seekFoodThreshold;
	const waterValid = thirstScore >= config.seekWaterThreshold;
	const restValid = restScore >= config.restThreshold;

	const scoreConfig = {
		pendingSignalLifetimeSeconds: config.pendingSignalLifetimeSeconds,
		investigationCuriosityWeight: config.investigationCuriosityWeight,
		investigationDistanceScale: config.investigationDistanceScale,
		investigationAgeWeight: config.investigationAgeWeight
	};

	// Prefer scoring the active investigation while committed; otherwise best pending.
	const investigationEval: ReturnType<typeof scoreInvestigationCandidate> | null =
		creature.activeInvestigation && creature.goal === 'investigate_signal'
			? scoreInvestigationCandidate(
					creature,
					activeToPendingShape(
						creature.activeInvestigation,
						creature.activeInvestigation.startedAt
					),
					timeSeconds,
					scoreConfig
				)
			: selectBestPendingSignal(creature, creature.pendingSignals, timeSeconds, scoreConfig);

	const investigateValid = investigationEval !== null;
	const investigateTarget = investigationEval
		? pointTarget(investigationEval.pending.origin)
		: null;

	const candidates: CandidateEvaluation[] = [
		{
			goal: 'seek_food',
			valid: foodValid,
			score: hungerScore,
			reason: food
				? `hunger pressure ${hungerScore.toFixed(3)}; food target available`
				: `hunger pressure ${hungerScore.toFixed(3)}; no relevant resource currently perceived — will search`,
			target: food,
			rejectionReason: !foodValid
				? `hunger ${hungerScore.toFixed(3)} below threshold ${config.seekFoodThreshold}`
				: undefined
		},
		{
			goal: 'seek_water',
			valid: waterValid,
			score: thirstScore,
			reason: water
				? `thirst pressure ${thirstScore.toFixed(3)}; water target available`
				: `thirst pressure ${thirstScore.toFixed(3)}; no relevant resource currently perceived — will search`,
			target: water,
			rejectionReason: !waterValid
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
			goal: 'investigate_signal',
			valid: investigateValid,
			score: investigationEval?.score ?? 0,
			reason: investigationEval?.reason ?? 'no pending or active signal investigation candidate',
			target: investigateTarget,
			rejectionReason: !investigateValid ? 'no non-expired pending signal candidates' : undefined
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
		| 'curiosity'
		| 'position'
		| 'wanderTarget'
		| 'perception'
		| 'pendingSignals'
		| 'symbolAssociations'
		| 'activeInvestigation'
	>;
	habitat: Habitat;
	timeSeconds: number;
	trigger: DecisionTrigger;
	config: DecisionConfig;
};

/**
 * True when wander may yield to investigation without goalSwitchMargin.
 * Survival goals retain full hysteresis. Min commitment still applies.
 */
export function isExploreExemption(
	currentGoal: CreatureGoal,
	challengerGoal: CreatureGoal
): boolean {
	return currentGoal === 'wander' && challengerGoal === 'investigate_signal';
}

/**
 * Evaluate candidates and apply hysteresis / min commitment for ordinary reconsider.
 * Immediate triggers (invalid_target, action_complete, initial) always accept the best goal.
 * Explore exemption: wander → investigate_signal skips the switch margin.
 */
export function commitDecision(input: CommitDecisionInput): DecisionRecord {
	const { creature, habitat, timeSeconds, trigger, config } = input;
	const candidates = evaluateCandidates(creature, habitat, config, timeSeconds);
	const best = selectBestCandidate(candidates);
	const currentEval = candidates.find((c) => c.goal === creature.goal);

	let selected = best;
	let selectionReason = `highest valid score ${best.score.toFixed(3)} (${best.reason})`;

	const forceSwitch =
		trigger === 'invalid_target' || trigger === 'action_complete' || trigger === 'initial';

	if (!forceSwitch && currentEval?.valid) {
		const heldFor = timeSeconds - creature.goalStartedAt;
		const commitmentMet = heldFor >= config.minGoalCommitmentSeconds;
		const exploreExemption = isExploreExemption(creature.goal, best.goal);
		const beatsByMargin =
			exploreExemption || best.score >= currentEval.score + config.goalSwitchMargin;
		const sameGoal = best.goal === creature.goal;

		if (sameGoal) {
			selected = currentEval;
			selectionReason = `continue ${creature.goal} (score ${currentEval.score.toFixed(3)}; ${currentEval.reason})`;
		} else if (!commitmentMet) {
			selected = currentEval;
			selectionReason = `hold ${creature.goal}: commitment ${heldFor.toFixed(3)}s < ${config.minGoalCommitmentSeconds}s`;
		} else if (!beatsByMargin) {
			selected = currentEval;
			selectionReason =
				`hold ${creature.goal}: challenger ${best.goal} score ${best.score.toFixed(3)} ` +
				`does not beat ${currentEval.score.toFixed(3)} + margin ${config.goalSwitchMargin}`;
		} else if (exploreExemption) {
			selectionReason =
				`explore exemption: switch wander → investigate_signal ` +
				`(score ${best.score.toFixed(3)}; margin waived; ${best.reason})`;
		} else {
			selectionReason =
				`switch to ${best.goal}: score ${best.score.toFixed(3)} beats ` +
				`${creature.goal} ${currentEval.score.toFixed(3)} by margin`;
		}
	} else if (forceSwitch) {
		selectionReason = `${trigger}: select ${best.goal} (score ${best.score.toFixed(3)}; ${best.reason})`;
	}

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
