/**
 * Context-sensitive deterministic symbol selection for emission.
 *
 * Learned production uses the creature's exclusive lexicon assignment for the
 * discovered resource context. Unassigned contexts use deterministic exploratory
 * selection among symbols not currently assigned to another meaning.
 *
 * There is no independent multi-context weighted sampling path and no speaker
 * success feedback. Communication only reads serialisable lexicon values.
 *
 * Seed stream (exploratory only):
 *   deriveSeed(simulationSeed, 'communication', 'context-symbol', creatureId,
 *              String(emissionCount), contextDetail)
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type {
	ResourceDiscoveryDetail,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence,
	SymbolSelectionMode
} from './types';

/** Minimal lexicon row — data only; no learning module import. */
export type LexiconAssignmentRow = {
	food: SymbolId | null;
	water: SymbolId | null;
};

export type SelectContextSymbolInput = {
	simulationSeed: string;
	creatureId: string;
	emissionCount: number;
	contextDetail: ResourceDiscoveryDetail;
	inventory: readonly SymbolId[];
	lexicon: LexiconAssignmentRow;
	preferredSymbolId: SymbolId;
};

export type SelectContextSymbolResult = {
	symbolId: SymbolId;
	evidence: SymbolSelectionEvidence;
	/** Concise reason string for emission.symbolSelectionReason. */
	reasonText: string;
};

function assignedSymbols(lexicon: LexiconAssignmentRow): Set<SymbolId> {
	const set = new Set<SymbolId>();
	if (lexicon.food !== null) {
		set.add(lexicon.food);
	}
	if (lexicon.water !== null) {
		set.add(lexicon.water);
	}
	return set;
}

function formatReasonText(evidence: SymbolSelectionEvidence): string {
	if (evidence.mode === 'learned_lexicon') {
		return `learned_lexicon context=${evidence.emissionContext} symbol=${evidence.selectedSymbolId}`;
	}
	if (evidence.mode === 'exploratory') {
		return `exploratory context=${evidence.emissionContext} symbol=${evidence.selectedSymbolId} sample=${evidence.sample?.toFixed(4) ?? 'n/a'}`;
	}
	return `${evidence.reason} (${evidence.selectedSymbolId}, context=${evidence.emissionContext})`;
}

function buildCandidateNotes(
	inventory: readonly SymbolId[],
	contextDetail: ResourceDiscoveryDetail,
	lexicon: LexiconAssignmentRow,
	selectedSymbolId: SymbolId,
	pool: readonly SymbolId[],
	mode: SymbolSelectionMode
): SymbolSelectionCandidateEvidence[] {
	const otherMeaning: ResourceDiscoveryDetail = contextDetail === 'food' ? 'water' : 'food';
	const assignedHere = lexicon[contextDetail];
	const assignedOther = lexicon[otherMeaning];
	const poolSet = new Set(pool);

	return inventory.map((symbolId) => {
		let note: string;
		if (symbolId === selectedSymbolId) {
			note = mode === 'learned_lexicon' ? 'selected_learned' : 'selected_exploratory';
		} else if (symbolId === assignedHere) {
			note = 'assigned_context';
		} else if (symbolId === assignedOther) {
			note = 'assigned_other_meaning';
		} else if (poolSet.has(symbolId)) {
			note = 'exploratory_eligible';
		} else {
			note = 'not_in_pool';
		}
		return {
			symbolId,
			eligible: poolSet.has(symbolId) || symbolId === selectedSymbolId,
			note
		};
	});
}

/**
 * Deterministic symbol selection for a resource-discovery emission.
 *
 * 1. If lexicon[context] is set and present in inventory → learned_lexicon.
 * 2. Else exploratory among inventory symbols not assigned to any meaning
 *    (if that pool is empty, use full inventory).
 * 3. Seeded uniform sample over the exploratory pool.
 * 4. Fallback to preferred / first inventory only if inventory is non-empty but
 *    sampling cannot proceed (should not occur with non-empty inventory).
 */
export function selectContextSymbol(input: SelectContextSymbolInput): SelectContextSymbolResult {
	const {
		simulationSeed,
		creatureId,
		emissionCount,
		contextDetail,
		inventory,
		lexicon,
		preferredSymbolId
	} = input;

	if (inventory.length === 0) {
		throw new Error('symbol inventory must be non-empty for context-sensitive emission');
	}

	const assignedForContext = lexicon[contextDetail];
	if (assignedForContext !== null && inventory.includes(assignedForContext)) {
		const evidence: SymbolSelectionEvidence = {
			emissionContext: contextDetail,
			selectedSymbolId: assignedForContext,
			assignedSymbolId: assignedForContext,
			mode: 'learned_lexicon',
			candidates: buildCandidateNotes(
				inventory,
				contextDetail,
				lexicon,
				assignedForContext,
				[assignedForContext],
				'learned_lexicon'
			),
			sample: null,
			usedFallback: false,
			reason: 'learned_lexicon'
		};
		return {
			symbolId: assignedForContext,
			evidence,
			reasonText: formatReasonText(evidence)
		};
	}

	const taken = assignedSymbols(lexicon);
	let pool = inventory.filter((symbolId) => !taken.has(symbolId));
	let poolNote = 'prefer_unassigned';
	if (pool.length === 0) {
		pool = [...inventory];
		poolNote = 'all_assigned_use_inventory';
	}

	const stream = deriveSeed(
		simulationSeed,
		'communication',
		'context-symbol',
		creatureId,
		String(emissionCount),
		contextDetail
	);
	const rng = createSeededRng(stream);
	const sample = rng.next();
	const index = Math.min(pool.length - 1, Math.floor(sample * pool.length));
	const selectedSymbolId = pool[index]!;

	const evidence: SymbolSelectionEvidence = {
		emissionContext: contextDetail,
		selectedSymbolId,
		assignedSymbolId: assignedForContext,
		mode: 'exploratory',
		candidates: buildCandidateNotes(
			inventory,
			contextDetail,
			lexicon,
			selectedSymbolId,
			pool,
			'exploratory'
		),
		sample,
		usedFallback: false,
		reason: `exploratory_${poolNote}`
	};

	// Defensive: if selection somehow invalid, fall back explicitly.
	if (!inventory.includes(selectedSymbolId)) {
		const fallbackInInventory = inventory.includes(preferredSymbolId);
		const fallbackId = fallbackInInventory ? preferredSymbolId : inventory[0]!;
		const fallbackMode: SymbolSelectionMode = fallbackInInventory
			? 'fallback_preferred'
			: 'fallback_inventory';
		const fallbackEvidence: SymbolSelectionEvidence = {
			emissionContext: contextDetail,
			selectedSymbolId: fallbackId,
			assignedSymbolId: assignedForContext,
			mode: fallbackMode,
			candidates: buildCandidateNotes(
				inventory,
				contextDetail,
				lexicon,
				fallbackId,
				pool,
				fallbackMode
			),
			sample: null,
			usedFallback: true,
			reason: fallbackMode
		};
		return {
			symbolId: fallbackId,
			evidence: fallbackEvidence,
			reasonText: formatReasonText(fallbackEvidence)
		};
	}

	return {
		symbolId: selectedSymbolId,
		evidence,
		reasonText: formatReasonText(evidence)
	};
}
