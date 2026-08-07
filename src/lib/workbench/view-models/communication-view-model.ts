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

/** Recent heard-signal curiosity decisions for Communication tab. */
export type CuriosityOpportunityRow = {
	listenerId: string;
	symbolId: SymbolId;
	emissionId: string;
	heardAt: number;
	curiosity: number;
	decision: 'pending' | 'accepted' | 'rejected';
	sample: number | null;
	/** Whether this emission is the listener's active investigation. */
	selected: boolean;
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

/** Light announcement-memory / opportunity state before full audit (FLAME-72). */
export type AnnouncementMemorySummaryRow = {
	creatureId: string;
	announcementMemoryCount: number;
	activeTriggerFeatureId: string | null;
	activeState: 'ready' | 'repositioning' | null;
	lastDecisionReason: string | null;
	lastDecisionFeatureId: string | null;
};

export type CommunicationViewModel = {
	population: PopulationSymbolDiagnostics;
	funnel: FunnelStage[];
	lexiconMatrix: LexiconMatrixRow[];
	liveFeed: LiveFeedItem[];
	activeInvestigations: ActiveInvestigationRow[];
	curiosityOpportunities: CuriosityOpportunityRow[];
	completedOutcomes: CompletedOutcomeCounts;
	announcementMemorySummaries: AnnouncementMemorySummaryRow[];
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
	const curiosityOpportunities: CuriosityOpportunityRow[] = [];
	const announcementMemorySummaries: AnnouncementMemorySummaryRow[] = [];
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
		for (const opp of creature.pendingSignals) {
			curiosityOpportunities.push({
				listenerId: creature.id,
				symbolId: opp.symbolId,
				emissionId: opp.emissionId,
				heardAt: opp.heardAt,
				curiosity: opp.curiosityEvidence?.curiosity ?? creature.curiosity,
				decision: opp.curiosityDecision,
				sample: opp.curiosityEvidence?.deterministicSample ?? null,
				selected: creature.activeInvestigation?.emissionId === opp.emissionId
			});
		}
		for (const entry of creature.recentLearning) {
			completedOutcomes[entry.outcome] = (completedOutcomes[entry.outcome] ?? 0) + 1;
		}

		const activeOpp = creature.activeAnnouncementOpportunity;
		const decisionHistory = Array.isArray(creature.recentAnnouncementOpportunityDecisions)
			? creature.recentAnnouncementOpportunityDecisions
			: [];
		const lastDecision = decisionHistory[decisionHistory.length - 1] ?? null;
		const memoryEntries = Array.isArray(creature.memory?.entries) ? creature.memory.entries : [];
		announcementMemorySummaries.push({
			creatureId: creature.id,
			announcementMemoryCount: memoryEntries.filter((e) => e.kind === 'resource_announcement')
				.length,
			activeTriggerFeatureId: activeOpp?.triggerFeatureId ?? null,
			activeState: activeOpp?.state ?? null,
			lastDecisionReason: lastDecision?.reason ?? null,
			lastDecisionFeatureId: lastDecision?.featureId ?? null
		});
	}

	curiosityOpportunities.sort((a, b) => b.heardAt - a.heardAt);

	return {
		population,
		funnel,
		lexiconMatrix,
		liveFeed,
		activeInvestigations,
		curiosityOpportunities,
		completedOutcomes,
		announcementMemorySummaries
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
