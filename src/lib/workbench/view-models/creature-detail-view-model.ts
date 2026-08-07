/**
 * Pure creature roster and selected-detail helpers for the Creatures tab.
 * Arbitration and investigation views read authoritative lastArbitration / memory only.
 */

import type {
	AnnouncementOpportunityDecision,
	Creature,
	CreatureMemory,
	CreatureTarget,
	IntentionCandidate,
	IntentionKind,
	SignalEmission,
	SymbolId
} from '$lib/simulation';
import { createEmptyMemory, ensureCreatureMemory, listHeardSignalMemories } from '$lib/simulation';

export type RosterRow = {
	id: string;
	hunger: number;
	thirst: number;
	energy: number;
	intention: IntentionKind;
	foodSymbolId: SymbolId | null;
	waterSymbolId: SymbolId | null;
};

export type LabelledScoreTerm = {
	label: string;
	value: number;
};

/**
 * Compact investigation / heard-signal summary for the Creatures tab.
 */
export type InvestigationOpportunitySummary = {
	heardSignalMemoryCount: number;
	activeEmissionId: string | null;
	activeSymbolId: SymbolId | null;
	newestHeardEmissionId: string | null;
	newestHeardSymbolId: SymbolId | null;
} | null;

export type CandidateView = {
	intention: IntentionKind;
	valid: boolean;
	score: number;
	baseScore: number;
	continuityAdjustment: number;
	reasonCodes: string[];
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
		intention: c.intention,
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
 * Build investigation / heard-signal memory summary for the selected creature.
 */
export function buildInvestigationOpportunitySummary(
	creature: Creature,
	_timeSeconds: number
): InvestigationOpportunitySummary {
	void _timeSeconds;
	const heard = listHeardSignalMemories(ensureCreatureMemory(creature).memory);
	const active = creature.activeInvestigation;
	const newest = heard.length > 0 ? heard[heard.length - 1]! : null;

	if (!newest && !active && heard.length === 0) {
		return {
			heardSignalMemoryCount: 0,
			activeEmissionId: null,
			activeSymbolId: null,
			newestHeardEmissionId: null,
			newestHeardSymbolId: null
		};
	}

	return {
		heardSignalMemoryCount: heard.length,
		activeEmissionId: active?.emissionId ?? null,
		activeSymbolId: active?.symbolId ?? null,
		newestHeardEmissionId: newest?.emissionId ?? null,
		newestHeardSymbolId: newest?.symbolId ?? null
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
	const candidates: IntentionCandidate[] = creature.lastArbitration?.candidates ?? [];
	const selectedIntention = creature.lastArbitration?.selectedIntention ?? creature.intention;

	return candidates.map((c) => ({
		intention: c.intention,
		valid: c.valid,
		score: c.score,
		baseScore: c.baseScore,
		continuityAdjustment: c.continuityAdjustment,
		reasonCodes: [...c.reasonCodes],
		rejectionReason: c.rejectionReason,
		selected: c.intention === selectedIntention,
		scoreTerms:
			c.intention === 'investigate_signal' && investigation
				? [
						{ label: 'Total score', value: c.score },
						{ label: 'Heard memories', value: investigation.heardSignalMemoryCount },
						...(c.continuityAdjustment !== 0
							? [{ label: 'Continuity', value: c.continuityAdjustment }]
							: [])
					]
				: c.valid
					? [
							{ label: 'Total score', value: c.score },
							{ label: 'Base score', value: c.baseScore },
							...(c.continuityAdjustment !== 0
								? [{ label: 'Continuity', value: c.continuityAdjustment }]
								: []),
							...(c.intention === 'satisfy_hunger'
								? [{ label: 'Hunger pressure', value: creature.hunger }]
								: []),
							...(c.intention === 'satisfy_thirst'
								? [{ label: 'Thirst pressure', value: creature.thirst }]
								: []),
							...(c.intention === 'rest'
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

/** Row for the Creatures-tab Memory section (presentation only). */
export type MemoryEntryView = {
	kind: string;
	subjectId: string;
	resourceKind: 'food' | 'water' | null;
	symbolId: SymbolId | null;
	timeSeconds: number;
	sequence: number;
	emissionId: string | null;
	opportunityId: string | null;
	/** Water observation empty flag; null when not applicable. */
	empty: boolean | null;
	/** Compact position label for observation/heard entries. */
	positionLabel: string | null;
};

export type MemorySectionView = {
	capacity: number;
	used: number;
	entries: MemoryEntryView[];
};

function formatPositionLabel(position: { x: number; y: number }): string {
	return `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`;
}

/**
 * Build structured memory section for selected creature detail.
 * Resolves announcement emission symbols from recentEmitted when present.
 */
export function buildMemorySectionView(creature: Creature): MemorySectionView {
	const safe = ensureCreatureMemory(creature);
	const byEmission = new Map<string, SignalEmission>();
	for (const emission of safe.recentEmitted) {
		byEmission.set(emission.id, emission);
	}

	// Newest last in storage; show newest first in the UI.
	const entries: MemoryEntryView[] = [...safe.memory.entries]
		.slice()
		.reverse()
		.map((entry) => {
			if (entry.kind === 'resource_announcement') {
				const emission = byEmission.get(entry.emissionId);
				return {
					kind: 'resource announcement',
					subjectId: entry.featureId,
					resourceKind: entry.resourceKind,
					symbolId: emission?.symbolId ?? null,
					timeSeconds: entry.rememberedAt,
					sequence: entry.sequence,
					emissionId: entry.emissionId,
					opportunityId: entry.opportunityId,
					empty: null,
					positionLabel: null
				};
			}
			if (entry.kind === 'resource_observation') {
				const emptyLabel =
					entry.resourceKind === 'water' ? (entry.empty ? ' empty' : ' available') : '';
				return {
					kind: `resource observation${emptyLabel}`,
					subjectId: entry.featureId,
					resourceKind: entry.resourceKind,
					symbolId: null,
					timeSeconds: entry.rememberedAt,
					sequence: entry.sequence,
					emissionId: null,
					opportunityId: null,
					empty: entry.resourceKind === 'water' ? entry.empty : null,
					positionLabel: formatPositionLabel(entry.position)
				};
			}
			// heard_signal — no sender identity in display either
			return {
				kind: 'heard signal',
				subjectId: entry.emissionId,
				resourceKind: null,
				symbolId: entry.symbolId,
				timeSeconds: entry.rememberedAt,
				sequence: entry.sequence,
				emissionId: entry.emissionId,
				opportunityId: null,
				empty: null,
				positionLabel: formatPositionLabel(entry.origin)
			};
		});

	return {
		capacity: safe.memory.capacity,
		used: safe.memory.entries.length,
		entries
	};
}

/** Serialised memory for Debug tab copy/inspect. */
export function formatCreatureMemoryJson(memory: CreatureMemory | null | undefined): string {
	return JSON.stringify(memory ?? createEmptyMemory(1), null, 2);
}

export function lastAnnouncementOpportunityDecision(
	creature: Creature
): AnnouncementOpportunityDecision | null {
	const list = creature.recentAnnouncementOpportunityDecisions;
	if (!Array.isArray(list) || list.length === 0) {
		return null;
	}
	return list[list.length - 1] ?? null;
}
