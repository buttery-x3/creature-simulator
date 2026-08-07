/**
 * Pure creature roster and selected-detail helpers for the Creatures tab.
 * Investigation opportunity summaries use authoritative curiosity decisions (display only).
 */

import type {
	CandidateEvaluation,
	Creature,
	CreatureTarget,
	SignalInvestigationOpportunity,
	SymbolId
} from '$lib/simulation';
import {
	countAcceptedPending,
	INVESTIGATION_ELIGIBLE_SCORE,
	mostRecentCuriosityDecision,
	selectBestAcceptedOpportunity
} from '$lib/simulation';

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

/**
 * Compact investigation opportunity summary for the Creatures tab (not multi-factor scores).
 */
export type InvestigationOpportunitySummary = {
	curiosity: number;
	acceptedPendingCount: number;
	recentDecision: 'accepted' | 'rejected' | 'pending' | null;
	recentEmissionId: string | null;
	recentSample: number | null;
	activeEmissionId: string | null;
	activeSymbolId: SymbolId | null;
	eligibleEmissionId: string | null;
	eligibleScore: number | null;
} | null;

export type CandidateView = {
	goal: CandidateEvaluation['goal'];
	valid: boolean;
	score: number;
	reason: string;
	rejectionReason?: string;
	selected: boolean;
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

/**
 * Build curiosity/investigation opportunity summary for the selected creature.
 */
export function buildInvestigationOpportunitySummary(
	creature: Creature,
	timeSeconds: number
): InvestigationOpportunitySummary {
	const recent = mostRecentCuriosityDecision(creature.pendingSignals);
	const acceptedCount = countAcceptedPending(creature.pendingSignals, timeSeconds);
	const eligible = selectBestAcceptedOpportunity(
		creature.pendingSignals,
		timeSeconds,
		INVESTIGATION_ELIGIBLE_SCORE
	);
	const active = creature.activeInvestigation;

	if (!recent && !active && acceptedCount === 0) {
		return {
			curiosity: creature.curiosity,
			acceptedPendingCount: 0,
			recentDecision: null,
			recentEmissionId: null,
			recentSample: null,
			activeEmissionId: null,
			activeSymbolId: null,
			eligibleEmissionId: null,
			eligibleScore: null
		};
	}

	return {
		curiosity: creature.curiosity,
		acceptedPendingCount: acceptedCount,
		recentDecision: recent?.curiosityDecision ?? null,
		recentEmissionId: recent?.emissionId ?? null,
		recentSample: recent?.curiosityEvidence?.deterministicSample ?? null,
		activeEmissionId: active?.emissionId ?? null,
		activeSymbolId: active?.symbolId ?? null,
		eligibleEmissionId: eligible?.opportunity.emissionId ?? active?.emissionId ?? null,
		eligibleScore: active ? INVESTIGATION_ELIGIBLE_SCORE : (eligible?.score ?? null)
	};
}

/** @deprecated Use {@link buildInvestigationOpportunitySummary}. */
export function buildInvestigationScoreBreakdown(
	creature: Creature,
	timeSeconds: number,
	_config?: unknown
): InvestigationOpportunitySummary {
	void _config;
	return buildInvestigationOpportunitySummary(creature, timeSeconds);
}

export function buildCandidateViews(
	creature: Creature,
	investigation: InvestigationOpportunitySummary
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
				? [
						{ label: 'Eligible score', value: investigation.eligibleScore ?? c.score },
						{ label: 'Curiosity', value: investigation.curiosity },
						...(investigation.recentSample !== null
							? [{ label: 'Last sample', value: investigation.recentSample }]
							: [])
					]
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

export function formatOpportunityDecision(
	opportunity: SignalInvestigationOpportunity | null | undefined
): string {
	if (!opportunity) {
		return '—';
	}
	return opportunity.curiosityDecision;
}
