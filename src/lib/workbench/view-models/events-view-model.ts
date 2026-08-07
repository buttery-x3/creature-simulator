/**
 * Normalise bounded per-creature histories into chronological event rows.
 * Not an authoritative audit log — FLAME-72 will own full linked audit events.
 */

import type { Creature, SimulationState, SymbolId } from '$lib/simulation';
import type { EventCategory, EventFilterState } from '../workbench-types';

export type EventRow = {
	id: string;
	timeSeconds: number;
	category: EventCategory;
	creatureId: string | null;
	event: string;
	subject: string;
	result: string;
	symbolId: SymbolId | null;
	featureId: string | null;
	senderId: string | null;
	listenerId: string | null;
	/** Expandable structured payload (JSON-serialisable plain data). */
	detail: Record<string, unknown>;
};

export function buildEventRows(state: SimulationState): EventRow[] {
	const rows: EventRow[] = [];

	for (const creature of state.creatures) {
		appendCreatureEvents(rows, creature);
	}

	for (const emission of state.activeEmissions) {
		rows.push({
			id: `active-emission-${emission.id}`,
			timeSeconds: emission.emittedAt,
			category: 'Communication',
			creatureId: emission.senderId,
			event: 'Active emission',
			subject: emission.symbolId,
			result: `${emission.context}/${emission.contextDetail}`,
			symbolId: emission.symbolId,
			featureId: null,
			senderId: emission.senderId,
			listenerId: null,
			detail: {
				emissionId: emission.id,
				origin: emission.origin,
				expiresAt: emission.expiresAt,
				mode: emission.selectionEvidence.mode
			}
		});
	}

	rows.sort((a, b) => {
		if (a.timeSeconds !== b.timeSeconds) {
			return a.timeSeconds - b.timeSeconds;
		}
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});

	return rows;
}

function appendCreatureEvents(rows: EventRow[], creature: Creature): void {
	for (const t of creature.recentTransitions) {
		rows.push({
			id: `transition-${creature.id}-${t.timeSeconds}-${t.toGoal}-${t.toAction}`,
			timeSeconds: t.timeSeconds,
			category: 'Behaviour',
			creatureId: creature.id,
			event: 'Goal/action change',
			subject: `${t.fromGoal}/${t.fromAction}`,
			result: `${t.toGoal}/${t.toAction}`,
			symbolId: null,
			featureId: null,
			senderId: null,
			listenerId: null,
			detail: { reason: t.reason }
		});
	}

	for (const emission of creature.recentEmitted) {
		rows.push({
			id: `emitted-${emission.id}`,
			timeSeconds: emission.emittedAt,
			category: 'Communication',
			creatureId: creature.id,
			event: 'Emitted',
			subject: emission.symbolId,
			result: `${emission.selectionEvidence.mode} · ${emission.contextDetail}`,
			symbolId: emission.symbolId,
			featureId: null,
			senderId: creature.id,
			listenerId: null,
			detail: {
				emissionId: emission.id,
				reason: emission.selectionEvidence.reason,
				usedFallback: emission.selectionEvidence.usedFallback
			}
		});
	}

	for (const heard of creature.recentHeard) {
		rows.push({
			id: `heard-${creature.id}-${heard.emissionId}-${heard.heardAt}`,
			timeSeconds: heard.heardAt,
			category: 'Communication',
			creatureId: creature.id,
			event: 'Heard',
			subject: heard.symbolId,
			result: `from ${heard.senderId}`,
			symbolId: heard.symbolId,
			featureId: null,
			senderId: heard.senderId,
			listenerId: creature.id,
			detail: { origin: heard.origin, emissionId: heard.emissionId }
		});
	}

	if (creature.activeInvestigation) {
		const inv = creature.activeInvestigation;
		rows.push({
			id: `investigation-active-${creature.id}-${inv.emissionId}`,
			timeSeconds: inv.startedAt,
			category: 'Investigation',
			creatureId: creature.id,
			event: 'Investigating',
			subject: inv.symbolId,
			result: `from ${inv.senderId}`,
			symbolId: inv.symbolId,
			featureId: null,
			senderId: inv.senderId,
			listenerId: creature.id,
			detail: { origin: inv.origin, emissionId: inv.emissionId }
		});
	}

	for (const entry of creature.recentLearning) {
		rows.push({
			id: `learning-${creature.id}-${entry.timeSeconds}-${entry.emissionId}-${entry.outcome}`,
			timeSeconds: entry.timeSeconds,
			category: 'Learning',
			creatureId: creature.id,
			event: 'Learning outcome',
			subject: entry.symbolId,
			result: entry.outcome,
			symbolId: entry.symbolId,
			featureId: null,
			senderId: null,
			listenerId: creature.id,
			detail: {
				reason: entry.reason,
				food: `${entry.foodStrengthBefore}→${entry.foodStrengthAfter}`,
				water: `${entry.waterStrengthBefore}→${entry.waterStrengthAfter}`,
				emissionId: entry.emissionId
			}
		});
	}

	for (const change of creature.recentLexiconChanges) {
		rows.push({
			id: `lexicon-${creature.id}-${change.timeSeconds}-${change.meaning}`,
			timeSeconds: change.timeSeconds,
			category: 'Lexicon',
			creatureId: creature.id,
			event: 'Lexicon change',
			subject: change.meaning,
			result: `${change.previousSymbolId ?? 'null'}→${change.newSymbolId ?? 'null'}`,
			symbolId: change.newSymbolId,
			featureId: null,
			senderId: null,
			listenerId: null,
			detail: {
				assignmentScore: change.assignmentScore,
				reason: change.reason,
				evidenceNote: change.evidenceNote
			}
		});
	}

	const p = creature.perception;
	if (p.lastUpdatedAt >= 0) {
		// One compact perception snapshot marker (not every observation as a spam row).
		// Only include when there is a tracked feature or non-empty perception lists.
		if (p.tracked || p.perceivedFoodIds.length > 0 || p.perceivedWaterIds.length > 0) {
			rows.push({
				id: `perception-${creature.id}-${p.lastUpdatedAt}`,
				timeSeconds: p.lastUpdatedAt,
				category: 'Perception',
				creatureId: creature.id,
				event: 'Perception update',
				subject: p.tracked
					? `${p.tracked.featureKind}:${p.tracked.featureId}`
					: `food ${p.perceivedFoodIds.length} / water ${p.perceivedWaterIds.length}`,
				result: p.tracked ? 'tracked' : 'snapshot',
				symbolId: null,
				featureId: p.tracked?.featureId ?? null,
				senderId: null,
				listenerId: null,
				detail: {
					perceivedFoodIds: p.perceivedFoodIds,
					perceivedWaterIds: p.perceivedWaterIds,
					tracked: p.tracked
				}
			});
		}
	}
}

export function filterEventRows(
	rows: readonly EventRow[],
	filter: EventFilterState,
	timeSeconds: number
): EventRow[] {
	const minTime =
		filter.windowSeconds !== null && filter.windowSeconds > 0
			? timeSeconds - filter.windowSeconds
			: null;

	return rows.filter((row) => {
		if (filter.category !== 'all' && row.category !== filter.category) {
			return false;
		}
		if (filter.creatureId !== 'all' && row.creatureId !== filter.creatureId) {
			return false;
		}
		if (filter.symbolId !== 'all' && row.symbolId !== filter.symbolId) {
			return false;
		}
		if (minTime !== null && row.timeSeconds < minTime) {
			return false;
		}
		return true;
	});
}
