/**
 * Pure creature roster and selected-detail helpers for the Creatures tab.
 * Investigation score terms are recomputed via exported scoring helpers (display only).
 */

import type {
	CandidateEvaluation,
	Creature,
	CreatureTarget,
	PendingSignal,
	SimulationConfig,
	SymbolId
} from '$lib/simulation';
import { scoreInvestigationCandidate, selectBestPendingSignal } from '$lib/simulation';

export type RosterRow = {
	id: string;
	hunger: number;
	thirst: number;
	energy: number;
	goal: Creature['goal'];
	foodSymbolId: SymbolId | null;
	waterSymbolId: SymbolId | null;
};

export type LabelledScoreTerm = {
	label: string;
	value: number;
};

export type InvestigationScoreBreakdown = {
	totalScore: number;
	terms: LabelledScoreTerm[];
	/** Full scorer reason string for Debug / secondary display. */
	rawReason: string;
	symbolId: SymbolId;
	emissionId: string;
} | null;

export type CandidateView = {
	goal: CandidateEvaluation['goal'];
	valid: boolean;
	score: number;
	reason: string;
	rejectionReason?: string;
	selected: boolean;
	/** Labelled terms when this is investigate_signal and structured score is available. */
	scoreTerms: LabelledScoreTerm[] | null;
};

export function buildRosterRows(creatures: readonly Creature[]): RosterRow[] {
	return creatures.map((c) => ({
		id: c.id,
		hunger: c.hunger,
		thirst: c.thirst,
		energy: c.energy,
		goal: c.goal,
		foodSymbolId: c.lexicon.food,
		waterSymbolId: c.lexicon.water
	}));
}

export function formatTargetLabel(target: CreatureTarget | null): string {
	if (!target) {
		return 'none';
	}
	if (target.kind === 'point') {
		return `point (${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)})`;
	}
	return `${target.featureKind}:${target.featureId}`;
}

export type InvestigationScoreConfig = Pick<
	SimulationConfig,
	| 'pendingSignalLifetimeSeconds'
	| 'investigationCuriosityWeight'
	| 'investigationDistanceScale'
	| 'investigationAgeWeight'
>;

/**
 * Recompute investigation score breakdown for the creature's active or best pending signal.
 */
export function buildInvestigationScoreBreakdown(
	creature: Creature,
	timeSeconds: number,
	config: InvestigationScoreConfig
): InvestigationScoreBreakdown {
	const scoreConfig = {
		pendingSignalLifetimeSeconds: config.pendingSignalLifetimeSeconds,
		investigationCuriosityWeight: config.investigationCuriosityWeight,
		investigationDistanceScale: config.investigationDistanceScale,
		investigationAgeWeight: config.investigationAgeWeight
	};

	const scored =
		creature.activeInvestigation && creature.goal === 'investigate_signal'
			? scoreInvestigationCandidate(
					creature,
					{
						emissionId: creature.activeInvestigation.emissionId,
						symbolId: creature.activeInvestigation.symbolId,
						senderId: creature.activeInvestigation.senderId,
						origin: { ...creature.activeInvestigation.origin },
						heardAt: creature.activeInvestigation.startedAt,
						expiresAt: Number.POSITIVE_INFINITY
					} satisfies PendingSignal,
					timeSeconds,
					scoreConfig
				)
			: selectBestPendingSignal(creature, creature.pendingSignals, timeSeconds, scoreConfig);

	if (!scored) {
		return null;
	}

	return {
		totalScore: scored.score,
		terms: [
			{ label: 'Curiosity contribution', value: scored.curiosityTerm },
			{ label: 'Resource bias', value: scored.resourceBias },
			{ label: 'Distance factor', value: scored.distanceFactor },
			{ label: 'Age penalty', value: scored.agePenalty }
		],
		rawReason: scored.reason,
		symbolId: scored.pending.symbolId,
		emissionId: scored.pending.emissionId
	};
}

export function buildCandidateViews(
	creature: Creature,
	investigation: InvestigationScoreBreakdown
): CandidateView[] {
	const candidates =
		creature.lastCandidates.length > 0
			? creature.lastCandidates
			: (creature.lastDecision?.candidates ?? []);
	const selectedGoal = creature.lastDecision?.selectedGoal ?? creature.goal;

	return candidates.map((c) => ({
		goal: c.goal,
		valid: c.valid,
		score: c.score,
		reason: c.reason,
		rejectionReason: c.rejectionReason,
		selected: c.goal === selectedGoal,
		scoreTerms:
			c.goal === 'investigate_signal' && investigation
				? [{ label: 'Total score', value: investigation.totalScore }, ...investigation.terms]
				: c.goal !== 'investigate_signal'
					? [
							{ label: 'Total score', value: c.score },
							...(c.goal === 'seek_food'
								? [{ label: 'Hunger pressure', value: creature.hunger }]
								: []),
							...(c.goal === 'seek_water'
								? [{ label: 'Thirst pressure', value: creature.thirst }]
								: []),
							...(c.goal === 'rest'
								? [{ label: 'Energy deficit', value: 1 - creature.energy }]
								: [])
						]
					: null
	}));
}

export function lastEmittedSymbolId(creature: Creature): SymbolId | null {
	const last = creature.recentEmitted[creature.recentEmitted.length - 1];
	return last?.symbolId ?? null;
}

export function lastHeardSymbolId(creature: Creature): SymbolId | null {
	const last = creature.recentHeard[creature.recentHeard.length - 1];
	return last?.symbolId ?? null;
}

export function lastLearningSummary(creature: Creature): string | null {
	const last = creature.recentLearning[creature.recentLearning.length - 1];
	if (!last) {
		return null;
	}
	return `${last.outcome} · ${last.symbolId} @ ${last.timeSeconds.toFixed(2)}s`;
}

export function evidenceRowCount(creature: Creature): number {
	return creature.symbolAssociations.reduce(
		(sum, row) => sum + row.foodEvidenceCount + row.waterEvidenceCount,
		0
	);
}
