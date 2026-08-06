/**
 * Pure population-level symbol evidence, lexicon assignment and emission diagnostics.
 *
 * Observational only: never mutates creature evidence or lexicons, never influences
 * symbol selection, never declares a global or “correct” food/water symbol.
 *
 * Concentration: for each context, max emission share among symbols in the
 * recent window, plus normalised Shannon entropy of emission shares
 * (0 = single-symbol concentration when total>0, 1 = uniform over inventory).
 */

import type { ResourceDiscoveryDetail, SignalEmission, SymbolId } from './communication/types';
import type { Creature, SimulationConfig, SimulationState, SymbolAssociation } from './types';

export type SymbolContextAssociationSummary = {
	symbolId: SymbolId;
	/** Mean raw evidence strength for this context (not exclusive lexicon). */
	meanStrength: number;
	medianStrength: number;
	creaturesWithEvidence: number;
	proportionWithEvidence: number;
	/** Creatures for which this symbol has the highest raw evidence in context. */
	creaturesStrongest: number;
	proportionStrongest: number;
	/** Creatures whose exclusive lexicon assigns this symbol to the context. */
	creaturesAssigned: number;
	proportionAssigned: number;
};

export type SymbolContextEmissionSummary = {
	symbolId: SymbolId;
	recentCount: number;
	recentShare: number;
};

export type ContextPopulationSummary = {
	context: ResourceDiscoveryDetail;
	associations: SymbolContextAssociationSummary[];
	emissions: SymbolContextEmissionSummary[];
	/** Symbol with highest mean raw evidence (observational; not canonical meaning). */
	highestMeanAssociationSymbolId: SymbolId | null;
	/**
	 * Symbol most often assigned in exclusive lexicons for this context
	 * (observational; not canonical meaning).
	 */
	mostAssignedSymbolId: SymbolId | null;
	/** Creatures with no exclusive assignment for this context. */
	creaturesUnassigned: number;
	proportionUnassigned: number;
	/** Max share among exclusive assignments (excluding unassigned). */
	assignmentConcentrationMaxShare: number;
	/** Symbol with most recent emissions in window (observational). */
	mostEmittedSymbolId: SymbolId | null;
	/** Max recent emission share in [0, 1]. */
	emissionConcentrationMaxShare: number;
	/**
	 * Normalised Shannon entropy of recent emission shares over inventory.
	 * 0 when all mass on one symbol (or no emissions); 1 when uniform.
	 */
	emissionEntropyNormalised: number;
	/** Creatures with any non-zero evidence count for this context. */
	creaturesContributingEvidence: number;
	/** Recent emissions in window using learned_lexicon mode. */
	recentLearnedEmissions: number;
	/** Recent emissions in window using exploratory mode. */
	recentExploratoryEmissions: number;
};

export type PopulationSymbolDiagnostics = {
	timeSeconds: number;
	windowSeconds: number;
	creatureCount: number;
	inventory: readonly SymbolId[];
	food: ContextPopulationSummary;
	water: ContextPopulationSummary;
};

export type PopulationDiagnosticsConfig = Pick<
	SimulationConfig,
	'symbolInventory' | 'recentEmissionDiagnosticsWindowSeconds'
>;

function medianOf(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1]! + sorted[mid]!) / 2;
	}
	return sorted[mid]!;
}

function strengthOf(
	assoc: SymbolAssociation | undefined,
	context: ResourceDiscoveryDetail
): number {
	if (!assoc) {
		return 0;
	}
	return context === 'food' ? assoc.foodStrength : assoc.waterStrength;
}

function evidenceCountOf(
	assoc: SymbolAssociation | undefined,
	context: ResourceDiscoveryDetail
): number {
	if (!assoc) {
		return 0;
	}
	return context === 'food' ? assoc.foodEvidenceCount : assoc.waterEvidenceCount;
}

function lexiconAssignment(
	creature: Creature,
	context: ResourceDiscoveryDetail
): SymbolId | null {
	return creature.lexicon[context];
}

function buildAssociationSummaries(
	creatures: readonly Creature[],
	inventory: readonly SymbolId[],
	context: ResourceDiscoveryDetail
): {
	associations: SymbolContextAssociationSummary[];
	highestMeanAssociationSymbolId: SymbolId | null;
	mostAssignedSymbolId: SymbolId | null;
	creaturesUnassigned: number;
	proportionUnassigned: number;
	assignmentConcentrationMaxShare: number;
	creaturesContributingEvidence: number;
} {
	const n = creatures.length;
	const contributing = new Set<string>();

	// Strongest raw-evidence symbol per creature (ties: inventory order / first max).
	const strongestCount = new Map<SymbolId, number>();
	const assignedCount = new Map<SymbolId, number>();
	for (const symbolId of inventory) {
		strongestCount.set(symbolId, 0);
		assignedCount.set(symbolId, 0);
	}

	let unassigned = 0;
	for (const creature of creatures) {
		let bestId: SymbolId | null = null;
		let bestStrength = -Infinity;
		for (const symbolId of inventory) {
			const row = creature.symbolAssociations.find((a) => a.symbolId === symbolId);
			const s = strengthOf(row, context);
			if (s > bestStrength) {
				bestStrength = s;
				bestId = symbolId;
			}
		}
		if (bestId !== null && bestStrength > 0) {
			strongestCount.set(bestId, (strongestCount.get(bestId) ?? 0) + 1);
		}

		const assigned = lexiconAssignment(creature, context);
		if (assigned === null) {
			unassigned += 1;
		} else if (assignedCount.has(assigned)) {
			assignedCount.set(assigned, (assignedCount.get(assigned) ?? 0) + 1);
		}
	}

	const associations: SymbolContextAssociationSummary[] = inventory.map((symbolId) => {
		const strengths: number[] = [];
		let withEvidence = 0;
		for (const creature of creatures) {
			const row = creature.symbolAssociations.find((a) => a.symbolId === symbolId);
			const s = strengthOf(row, context);
			strengths.push(s);
			if (evidenceCountOf(row, context) > 0) {
				withEvidence += 1;
				contributing.add(creature.id);
			}
		}
		const meanStrength = n === 0 ? 0 : strengths.reduce((sum, v) => sum + v, 0) / n;
		const creaturesStrongest = strongestCount.get(symbolId) ?? 0;
		const creaturesAssigned = assignedCount.get(symbolId) ?? 0;
		return {
			symbolId,
			meanStrength,
			medianStrength: medianOf(strengths),
			creaturesWithEvidence: withEvidence,
			proportionWithEvidence: n === 0 ? 0 : withEvidence / n,
			creaturesStrongest,
			proportionStrongest: n === 0 ? 0 : creaturesStrongest / n,
			creaturesAssigned,
			proportionAssigned: n === 0 ? 0 : creaturesAssigned / n
		};
	});

	let highestMeanAssociationSymbolId: SymbolId | null = null;
	let highestMean = -Infinity;
	for (const row of associations) {
		if (row.meanStrength > highestMean) {
			highestMean = row.meanStrength;
			highestMeanAssociationSymbolId = row.symbolId;
		}
	}
	if (highestMean <= 0) {
		highestMeanAssociationSymbolId = null;
	}

	let mostAssignedSymbolId: SymbolId | null = null;
	let maxAssigned = 0;
	let assignmentConcentrationMaxShare = 0;
	const assignedCreatures = n - unassigned;
	for (const row of associations) {
		if (row.creaturesAssigned > maxAssigned) {
			maxAssigned = row.creaturesAssigned;
			mostAssignedSymbolId = row.symbolId;
		}
		const share = assignedCreatures === 0 ? 0 : row.creaturesAssigned / assignedCreatures;
		if (share > assignmentConcentrationMaxShare) {
			assignmentConcentrationMaxShare = share;
		}
	}
	if (maxAssigned === 0) {
		mostAssignedSymbolId = null;
		assignmentConcentrationMaxShare = 0;
	}

	return {
		associations,
		highestMeanAssociationSymbolId,
		mostAssignedSymbolId,
		creaturesUnassigned: unassigned,
		proportionUnassigned: n === 0 ? 0 : unassigned / n,
		assignmentConcentrationMaxShare,
		creaturesContributingEvidence: contributing.size
	};
}

function buildEmissionSummaries(
	emissions: readonly SignalEmission[],
	inventory: readonly SymbolId[],
	context: ResourceDiscoveryDetail,
	timeSeconds: number,
	windowSeconds: number
): {
	emissions: SymbolContextEmissionSummary[];
	mostEmittedSymbolId: SymbolId | null;
	emissionConcentrationMaxShare: number;
	emissionEntropyNormalised: number;
	recentLearnedEmissions: number;
	recentExploratoryEmissions: number;
} {
	const windowStart = timeSeconds - windowSeconds;
	const counts = new Map<SymbolId, number>();
	for (const symbolId of inventory) {
		counts.set(symbolId, 0);
	}

	let total = 0;
	let recentLearnedEmissions = 0;
	let recentExploratoryEmissions = 0;
	for (const emission of emissions) {
		if (emission.contextDetail !== context) {
			continue;
		}
		if (emission.emittedAt < windowStart) {
			continue;
		}
		if (!counts.has(emission.symbolId)) {
			continue;
		}
		counts.set(emission.symbolId, (counts.get(emission.symbolId) ?? 0) + 1);
		total += 1;
		if (emission.selectionEvidence.mode === 'learned_lexicon') {
			recentLearnedEmissions += 1;
		} else if (emission.selectionEvidence.mode === 'exploratory') {
			recentExploratoryEmissions += 1;
		}
	}

	const emissionRows: SymbolContextEmissionSummary[] = inventory.map((symbolId) => {
		const recentCount = counts.get(symbolId) ?? 0;
		return {
			symbolId,
			recentCount,
			recentShare: total === 0 ? 0 : recentCount / total
		};
	});

	let mostEmittedSymbolId: SymbolId | null = null;
	let maxCount = 0;
	let maxShare = 0;
	for (const row of emissionRows) {
		if (row.recentCount > maxCount) {
			maxCount = row.recentCount;
			mostEmittedSymbolId = row.symbolId;
		}
		if (row.recentShare > maxShare) {
			maxShare = row.recentShare;
		}
	}
	if (maxCount === 0) {
		mostEmittedSymbolId = null;
		maxShare = 0;
	}

	// Normalised Shannon entropy over inventory (log base inventory.length).
	let entropy = 0;
	if (total > 0 && inventory.length > 1) {
		for (const row of emissionRows) {
			if (row.recentShare <= 0) {
				continue;
			}
			entropy -= row.recentShare * Math.log(row.recentShare);
		}
		const maxEntropy = Math.log(inventory.length);
		entropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
	} else if (total > 0 && inventory.length === 1) {
		entropy = 0;
	}

	return {
		emissions: emissionRows,
		mostEmittedSymbolId,
		emissionConcentrationMaxShare: maxShare,
		emissionEntropyNormalised: entropy,
		recentLearnedEmissions,
		recentExploratoryEmissions
	};
}

function buildContextSummary(
	creatures: readonly Creature[],
	emissions: readonly SignalEmission[],
	inventory: readonly SymbolId[],
	context: ResourceDiscoveryDetail,
	timeSeconds: number,
	windowSeconds: number
): ContextPopulationSummary {
	const assoc = buildAssociationSummaries(creatures, inventory, context);
	const emit = buildEmissionSummaries(emissions, inventory, context, timeSeconds, windowSeconds);
	return {
		context,
		associations: assoc.associations,
		emissions: emit.emissions,
		highestMeanAssociationSymbolId: assoc.highestMeanAssociationSymbolId,
		mostAssignedSymbolId: assoc.mostAssignedSymbolId,
		creaturesUnassigned: assoc.creaturesUnassigned,
		proportionUnassigned: assoc.proportionUnassigned,
		assignmentConcentrationMaxShare: assoc.assignmentConcentrationMaxShare,
		mostEmittedSymbolId: emit.mostEmittedSymbolId,
		emissionConcentrationMaxShare: emit.emissionConcentrationMaxShare,
		emissionEntropyNormalised: emit.emissionEntropyNormalised,
		creaturesContributingEvidence: assoc.creaturesContributingEvidence,
		recentLearnedEmissions: emit.recentLearnedEmissions,
		recentExploratoryEmissions: emit.recentExploratoryEmissions
	};
}

/**
 * Derive population communication/convergence diagnostics from current state.
 * Pure: does not mutate state, evidence or lexicons.
 */
export function buildPopulationSymbolDiagnostics(
	state: SimulationState,
	config: PopulationDiagnosticsConfig
): PopulationSymbolDiagnostics {
	const inventory = config.symbolInventory;
	const windowSeconds = config.recentEmissionDiagnosticsWindowSeconds;
	return {
		timeSeconds: state.timeSeconds,
		windowSeconds,
		creatureCount: state.creatures.length,
		inventory,
		food: buildContextSummary(
			state.creatures,
			state.recentEmissions,
			inventory,
			'food',
			state.timeSeconds,
			windowSeconds
		),
		water: buildContextSummary(
			state.creatures,
			state.recentEmissions,
			inventory,
			'water',
			state.timeSeconds,
			windowSeconds
		)
	};
}

/**
 * Multi-line text summary for workbench diagnostics (observational language only).
 */
export function formatPopulationSymbolDiagnostics(
	diagnostics: PopulationSymbolDiagnostics
): string {
	const lines: string[] = [
		'population symbol diagnostics (observational; no global dictionary):',
		`  t=${diagnostics.timeSeconds.toFixed(3)}s window=${diagnostics.windowSeconds.toFixed(1)}s creatures=${diagnostics.creatureCount}`
	];

	for (const ctx of [diagnostics.food, diagnostics.water] as const) {
		lines.push(
			`  ${ctx.context}: highest mean evidence=${ctx.highestMeanAssociationSymbolId ?? 'none'}` +
				` most assigned in lexicon=${ctx.mostAssignedSymbolId ?? 'none'}` +
				` unassigned=${ctx.creaturesUnassigned}` +
				` assignment concentration=${ctx.assignmentConcentrationMaxShare.toFixed(3)}` +
				` most emitted in window=${ctx.mostEmittedSymbolId ?? 'none'}` +
				` emission concentration max-share=${ctx.emissionConcentrationMaxShare.toFixed(3)}` +
				` entropy(norm)=${ctx.emissionEntropyNormalised.toFixed(3)}` +
				` evidence contributors=${ctx.creaturesContributingEvidence}` +
				` learnedEmit=${ctx.recentLearnedEmissions} exploratoryEmit=${ctx.recentExploratoryEmissions}`
		);
		for (const a of ctx.associations) {
			const e = ctx.emissions.find((row) => row.symbolId === a.symbolId);
			lines.push(
				`    ${a.symbolId}: meanEvidence=${a.meanStrength.toFixed(3)} median=${a.medianStrength.toFixed(3)}` +
					` evidence=${a.creaturesWithEvidence}/${diagnostics.creatureCount}` +
					` assigned=${a.creaturesAssigned}` +
					` strongestEvidence=${a.creaturesStrongest}` +
					` recentEmit=${e?.recentCount ?? 0} share=${(e?.recentShare ?? 0).toFixed(3)}`
			);
		}
	}

	return lines.join('\n');
}
