/**
 * Communication tab aggregates: funnel stages, lexicon matrix, live feed, investigations.
 * Observational only. Lifetime counters that do not exist are marked unavailable.
 */

import {
	buildPopulationSymbolDiagnostics,
	type PopulationSymbolDiagnostics,
	type SimulationConfig,
	type SimulationState,
	type SymbolId
} from '$lib/simulation';
import { evidenceRowCount } from './creature-detail-view-model';

export type FunnelStageAvailability = 'available' | 'unavailable' | 'recent_window';

export type FunnelStage = {
	id: string;
	label: string;
	availability: FunnelStageAvailability;
	/** Present when availability is available or recent_window. */
	value: number | null;
	note: string | null;
};

export type LexiconMatrixRow = {
	creatureId: string;
	foodSymbolId: SymbolId | null;
	waterSymbolId: SymbolId | null;
	evidenceCount: number;
};

export type LiveFeedItem = {
	id: string;
	timeSeconds: number;
	kind: string;
	summary: string;
	creatureId: string | null;
	symbolId: SymbolId | null;
};

export type ActiveInvestigationRow = {
	listenerId: string;
	senderId: string;
	symbolId: SymbolId;
	emissionId: string;
	originX: number;
	originY: number;
	startedAt: number;
};

export type CompletedOutcomeCounts = {
	food_evidence: number;
	water_evidence: number;
	mixed_evidence: number;
	no_evidence: number;
	interrupted: number;
	/** Labelled as bounded recent history, not lifetime. */
	source: 'recent_history';
};

export type CommunicationViewModel = {
	population: PopulationSymbolDiagnostics;
	funnel: FunnelStage[];
	lexiconMatrix: LexiconMatrixRow[];
	liveFeed: LiveFeedItem[];
	activeInvestigations: ActiveInvestigationRow[];
	completedOutcomes: CompletedOutcomeCounts;
};

export type CommunicationViewConfig = Pick<
	SimulationConfig,
	'symbolInventory' | 'recentEmissionDiagnosticsWindowSeconds'
>;

export function buildCommunicationViewModel(
	state: SimulationState,
	config: CommunicationViewConfig
): CommunicationViewModel {
	const population = buildPopulationSymbolDiagnostics(state, config);
	const funnel = buildFunnel(state, population);
	const lexiconMatrix = state.creatures.map((c) => ({
		creatureId: c.id,
		foodSymbolId: c.lexicon.food,
		waterSymbolId: c.lexicon.water,
		evidenceCount: evidenceRowCount(c)
	}));

	const liveFeed = buildLiveFeed(state);
	const activeInvestigations: ActiveInvestigationRow[] = [];
	const completedOutcomes: CompletedOutcomeCounts = {
		food_evidence: 0,
		water_evidence: 0,
		mixed_evidence: 0,
		no_evidence: 0,
		interrupted: 0,
		source: 'recent_history'
	};

	for (const creature of state.creatures) {
		if (creature.activeInvestigation) {
			const inv = creature.activeInvestigation;
			activeInvestigations.push({
				listenerId: creature.id,
				senderId: inv.senderId,
				symbolId: inv.symbolId,
				emissionId: inv.emissionId,
				originX: inv.origin.x,
				originY: inv.origin.y,
				startedAt: inv.startedAt
			});
		}
		for (const entry of creature.recentLearning) {
			completedOutcomes[entry.outcome] = (completedOutcomes[entry.outcome] ?? 0) + 1;
		}
	}

	return {
		population,
		funnel,
		lexiconMatrix,
		liveFeed,
		activeInvestigations,
		completedOutcomes
	};
}

function buildFunnel(
	state: SimulationState,
	population: PopulationSymbolDiagnostics
): FunnelStage[] {
	const recentEmissions =
		population.food.emissions.reduce((s, e) => s + e.recentCount, 0) +
		population.water.emissions.reduce((s, e) => s + e.recentCount, 0);

	let recentHeard = 0;
	let recentLexiconChanges = 0;
	let recentLearning = 0;
	let activeInvestigations = 0;
	let clearEvidence = 0;
	let noEvidence = 0;
	let ambiguous = 0;

	for (const creature of state.creatures) {
		recentHeard += creature.recentHeard.length;
		recentLexiconChanges += creature.recentLexiconChanges.length;
		recentLearning += creature.recentLearning.length;
		if (creature.activeInvestigation) {
			activeInvestigations += 1;
		}
		for (const entry of creature.recentLearning) {
			if (entry.outcome === 'food_evidence' || entry.outcome === 'water_evidence') {
				clearEvidence += 1;
			} else if (entry.outcome === 'no_evidence' || entry.outcome === 'interrupted') {
				noEvidence += 1;
			} else if (entry.outcome === 'mixed_evidence') {
				ambiguous += 1;
			}
		}
	}

	const windowLabel = `recent window ${population.windowSeconds.toFixed(0)}s (bounded histories, not lifetime)`;

	return [
		{
			id: 'resource_discoveries',
			label: 'Resource discoveries',
			availability: 'unavailable',
			value: null,
			note: 'No lifetime discovery counter yet (see FLAME-72)'
		},
		{
			id: 'announcement_opportunities',
			label: 'Announcement opportunities',
			availability: 'unavailable',
			value: null,
			note: 'No opportunity counter yet (see FLAME-72)'
		},
		{
			id: 'announcements_emitted',
			label: 'Announcements emitted',
			availability: 'recent_window',
			value: recentEmissions,
			note: windowLabel
		},
		{
			id: 'active_emissions',
			label: 'Active announcements (now)',
			availability: 'available',
			value: state.activeEmissions.length,
			note: null
		},
		{
			id: 'signals_received',
			label: 'Signals received',
			availability: 'recent_window',
			value: recentHeard,
			note: 'Bounded recentHeard histories (not lifetime)'
		},
		{
			id: 'investigations_selected',
			label: 'Investigations selected (active)',
			availability: 'available',
			value: activeInvestigations,
			note: 'Currently active investigations'
		},
		{
			id: 'investigations_completed',
			label: 'Investigations completed',
			availability: 'recent_window',
			value: recentLearning,
			note: 'Bounded recentLearning entries (not lifetime)'
		},
		{
			id: 'clear_evidence',
			label: 'Clear evidence',
			availability: 'recent_window',
			value: clearEvidence,
			note: 'food_evidence + water_evidence in recent history'
		},
		{
			id: 'no_evidence',
			label: 'No evidence',
			availability: 'recent_window',
			value: noEvidence,
			note: 'no_evidence + interrupted in recent history'
		},
		{
			id: 'ambiguous_evidence',
			label: 'Ambiguous evidence',
			availability: 'recent_window',
			value: ambiguous,
			note: 'mixed_evidence in recent history'
		},
		{
			id: 'lexicon_changes',
			label: 'Lexicon changes',
			availability: 'recent_window',
			value: recentLexiconChanges,
			note: 'Bounded recentLexiconChanges (not lifetime)'
		}
	];
}

function buildLiveFeed(state: SimulationState): LiveFeedItem[] {
	const items: LiveFeedItem[] = [];

	for (const creature of state.creatures) {
		for (const emission of creature.recentEmitted) {
			items.push({
				id: `feed-emit-${emission.id}`,
				timeSeconds: emission.emittedAt,
				kind: 'emitted',
				summary: `${creature.id} emitted ${emission.symbolId} (${emission.selectionEvidence.mode})`,
				creatureId: creature.id,
				symbolId: emission.symbolId
			});
		}
		for (const heard of creature.recentHeard) {
			items.push({
				id: `feed-heard-${creature.id}-${heard.emissionId}-${heard.heardAt}`,
				timeSeconds: heard.heardAt,
				kind: 'heard',
				summary: `${creature.id} heard ${heard.symbolId} from ${heard.senderId}`,
				creatureId: creature.id,
				symbolId: heard.symbolId
			});
		}
		if (creature.activeInvestigation) {
			const inv = creature.activeInvestigation;
			items.push({
				id: `feed-inv-${creature.id}-${inv.emissionId}`,
				timeSeconds: inv.startedAt,
				kind: 'investigation',
				summary: `${creature.id} investigating ${inv.symbolId} from ${inv.senderId}`,
				creatureId: creature.id,
				symbolId: inv.symbolId
			});
		}
		for (const entry of creature.recentLearning) {
			items.push({
				id: `feed-learn-${creature.id}-${entry.timeSeconds}-${entry.emissionId}`,
				timeSeconds: entry.timeSeconds,
				kind: 'learning',
				summary: `${creature.id} ${entry.outcome} on ${entry.symbolId}`,
				creatureId: creature.id,
				symbolId: entry.symbolId
			});
		}
		for (const change of creature.recentLexiconChanges) {
			items.push({
				id: `feed-lex-${creature.id}-${change.timeSeconds}-${change.meaning}`,
				timeSeconds: change.timeSeconds,
				kind: 'lexicon',
				summary: `${creature.id} lexicon ${change.meaning}: ${change.previousSymbolId ?? 'null'}→${change.newSymbolId ?? 'null'}`,
				creatureId: creature.id,
				symbolId: change.newSymbolId
			});
		}
	}

	items.sort((a, b) => b.timeSeconds - a.timeSeconds);
	return items.slice(0, 40);
}
