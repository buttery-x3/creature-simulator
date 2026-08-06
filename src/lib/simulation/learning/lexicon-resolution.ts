/**
 * Deterministic exclusive lexicon resolution from personal raw evidence.
 *
 * Pure: no population state, no emitter context, no Math.random.
 * Evidence may overlap; the resolved lexicon is one-to-one (meaning ↔ symbol).
 */

import type { SymbolId } from '../communication/types';
import {
	LEXICON_MEANINGS,
	type CreatureLexicon,
	type LexiconChangeEntry,
	type LexiconMeaning,
	type SymbolAssociation
} from './types';

export type LexiconResolveConfig = {
	lexiconAssignmentMinStrength: number;
	lexiconAssignmentMinEvidenceCount: number;
};

export type LexiconResolveResult = {
	lexicon: CreatureLexicon;
	/** Total evidence score of the chosen assignment. */
	score: number;
	/** Score of the next-best distinct assignment, if any. */
	runnerUpScore: number | null;
	reason: string;
};

export function emptyLexicon(): CreatureLexicon {
	return { food: null, water: null };
}

function strengthFor(row: SymbolAssociation | undefined, meaning: LexiconMeaning): number {
	if (!row) {
		return 0;
	}
	const raw = meaning === 'food' ? row.foodStrength : row.waterStrength;
	return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function countFor(row: SymbolAssociation | undefined, meaning: LexiconMeaning): number {
	if (!row) {
		return 0;
	}
	const raw = meaning === 'food' ? row.foodEvidenceCount : row.waterEvidenceCount;
	return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function isEligible(
	row: SymbolAssociation | undefined,
	meaning: LexiconMeaning,
	config: LexiconResolveConfig
): boolean {
	const strength = strengthFor(row, meaning);
	const count = countFor(row, meaning);
	return (
		strength >= config.lexiconAssignmentMinStrength &&
		count >= config.lexiconAssignmentMinEvidenceCount
	);
}

function evidenceBySymbol(
	evidence: readonly SymbolAssociation[]
): Map<SymbolId, SymbolAssociation> {
	return new Map(evidence.map((row) => [row.symbolId, row]));
}

function symbolOrderIndex(inventory: readonly SymbolId[], symbolId: SymbolId | null): number {
	if (symbolId === null) {
		// Null sorts last among choices for a meaning.
		return Number.POSITIVE_INFINITY;
	}
	const idx = inventory.indexOf(symbolId);
	return idx >= 0 ? idx : Number.POSITIVE_INFINITY - 1;
}

function assignmentCount(lexicon: CreatureLexicon): number {
	return LEXICON_MEANINGS.reduce((n, m) => n + (lexicon[m] !== null ? 1 : 0), 0);
}

/**
 * Lexicographic comparison of two lexicons for deterministic tie-breaking.
 * Meanings in LEXICON_MEANINGS order; null last; otherwise inventory symbol order.
 * Returns negative if a is preferred over b when scores/counts are equal.
 */
function compareLexiconOrder(
	a: CreatureLexicon,
	b: CreatureLexicon,
	inventory: readonly SymbolId[]
): number {
	for (const meaning of LEXICON_MEANINGS) {
		const ai = symbolOrderIndex(inventory, a[meaning]);
		const bi = symbolOrderIndex(inventory, b[meaning]);
		if (ai !== bi) {
			return ai - bi;
		}
	}
	return 0;
}

function scoreAssignment(
	lexicon: CreatureLexicon,
	byId: Map<SymbolId, SymbolAssociation>
): number {
	let score = 0;
	for (const meaning of LEXICON_MEANINGS) {
		const symbolId = lexicon[meaning];
		if (symbolId === null) {
			continue;
		}
		score += strengthFor(byId.get(symbolId), meaning);
	}
	return score;
}

function isValidExclusive(lexicon: CreatureLexicon): boolean {
	const assigned = LEXICON_MEANINGS.map((m) => lexicon[m]).filter(
		(s): s is SymbolId => s !== null
	);
	return new Set(assigned).size === assigned.length;
}

/**
 * Resolve a non-duplicating food/water lexicon maximising total evidence score.
 *
 * Exhaustive over partial assignments (meanings may remain null). Symbols must
 * meet min strength and evidence-count thresholds to be eligible for a meaning.
 *
 * Tie-break (stable):
 * 1. higher total score
 * 2. more meanings assigned
 * 3. earlier inventory order per meaning in LEXICON_MEANINGS order (null last)
 */
export function resolveCreatureLexicon(
	evidence: readonly SymbolAssociation[],
	inventory: readonly SymbolId[],
	config: LexiconResolveConfig
): LexiconResolveResult {
	const byId = evidenceBySymbol(evidence);

	const eligible: Record<LexiconMeaning, (SymbolId | null)[]> = {
		food: [null],
		water: [null]
	};
	for (const symbolId of inventory) {
		const row = byId.get(symbolId);
		for (const meaning of LEXICON_MEANINGS) {
			if (isEligible(row, meaning, config)) {
				eligible[meaning].push(symbolId);
			}
		}
	}

	type Candidate = { lexicon: CreatureLexicon; score: number };
	const candidates: Candidate[] = [];

	for (const food of eligible.food) {
		for (const water of eligible.water) {
			const lexicon: CreatureLexicon = { food, water };
			if (!isValidExclusive(lexicon)) {
				continue;
			}
			candidates.push({ lexicon, score: scoreAssignment(lexicon, byId) });
		}
	}

	// Always at least the all-null assignment.
	if (candidates.length === 0) {
		candidates.push({ lexicon: emptyLexicon(), score: 0 });
	}

	candidates.sort((a, b) => {
		if (b.score !== a.score) {
			return b.score - a.score;
		}
		const countDiff = assignmentCount(b.lexicon) - assignmentCount(a.lexicon);
		if (countDiff !== 0) {
			return countDiff;
		}
		return compareLexiconOrder(a.lexicon, b.lexicon, inventory);
	});

	const best = candidates[0]!;
	const runnerUp = candidates.find(
		(c) =>
			c.lexicon.food !== best.lexicon.food ||
			c.lexicon.water !== best.lexicon.water
	);

	const parts: string[] = [];
	for (const meaning of LEXICON_MEANINGS) {
		const symbolId = best.lexicon[meaning];
		parts.push(symbolId === null ? `${meaning}=null` : `${meaning}=${symbolId}`);
	}
	const reason =
		best.score <= 0 && assignmentCount(best.lexicon) === 0
			? 'insufficient_evidence'
			: `max_total_evidence score=${best.score.toFixed(4)} (${parts.join(', ')})`;

	return {
		lexicon: best.lexicon,
		score: best.score,
		runnerUpScore: runnerUp ? runnerUp.score : null,
		reason
	};
}

/**
 * Build per-meaning change entries when the exclusive lexicon shifts.
 */
export function diffLexiconChanges(
	previous: CreatureLexicon,
	next: CreatureLexicon,
	meta: {
		timeSeconds: number;
		assignmentScore: number;
		reason: string;
		evidenceNote: string;
	}
): LexiconChangeEntry[] {
	const entries: LexiconChangeEntry[] = [];
	for (const meaning of LEXICON_MEANINGS) {
		if (previous[meaning] === next[meaning]) {
			continue;
		}
		entries.push({
			timeSeconds: meta.timeSeconds,
			meaning,
			previousSymbolId: previous[meaning],
			newSymbolId: next[meaning],
			assignmentScore: meta.assignmentScore,
			reason: meta.reason,
			evidenceNote: meta.evidenceNote
		});
	}
	return entries;
}

/** Append lexicon change entries, dropping oldest when over limit. */
export function appendLexiconHistory(
	history: readonly LexiconChangeEntry[],
	entries: readonly LexiconChangeEntry[],
	limit: number
): LexiconChangeEntry[] {
	if (entries.length === 0) {
		return [...history];
	}
	const next = [...history, ...entries];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

/**
 * Apply resolution after an evidence mutation: store lexicon and append change history.
 */
export function applyLexiconResolution(
	previous: CreatureLexicon,
	history: readonly LexiconChangeEntry[],
	evidence: readonly SymbolAssociation[],
	inventory: readonly SymbolId[],
	timeSeconds: number,
	config: LexiconResolveConfig & { lexiconHistoryLimit: number },
	evidenceNote: string
): {
	lexicon: CreatureLexicon;
	recentLexiconChanges: LexiconChangeEntry[];
	resolve: LexiconResolveResult;
} {
	const resolve = resolveCreatureLexicon(evidence, inventory, config);
	const changes = diffLexiconChanges(previous, resolve.lexicon, {
		timeSeconds,
		assignmentScore: resolve.score,
		reason: resolve.reason,
		evidenceNote
	});
	return {
		lexicon: resolve.lexicon,
		recentLexiconChanges: appendLexiconHistory(history, changes, config.lexiconHistoryLimit),
		resolve
	};
}
