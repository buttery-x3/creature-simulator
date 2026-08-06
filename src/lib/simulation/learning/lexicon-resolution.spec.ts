import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMBOL_INVENTORY } from '../communication/types';
import type { SymbolAssociation } from './types';
import {
	diffLexiconChanges,
	emptyLexicon,
	resolveCreatureLexicon,
	type LexiconResolveConfig
} from './lexicon-resolution';

const config: LexiconResolveConfig = {
	lexiconAssignmentMinStrength: 0.15,
	lexiconAssignmentMinEvidenceCount: 1
};

function row(
	symbolId: SymbolAssociation['symbolId'],
	food: number,
	water: number,
	foodN = food > 0 ? 1 : 0,
	waterN = water > 0 ? 1 : 0
): SymbolAssociation {
	return {
		symbolId,
		foodStrength: food,
		waterStrength: water,
		foodEvidenceCount: foodN,
		waterEvidenceCount: waterN
	};
}

function evidence(
	overrides: Partial<
		Record<(typeof DEFAULT_SYMBOL_INVENTORY)[number], { food?: number; water?: number }>
	>
): SymbolAssociation[] {
	return DEFAULT_SYMBOL_INVENTORY.map((symbolId) =>
		row(symbolId, overrides[symbolId]?.food ?? 0, overrides[symbolId]?.water ?? 0)
	);
}

describe('resolveCreatureLexicon', () => {
	it('leaves both meanings unassigned with zero evidence', () => {
		const result = resolveCreatureLexicon(
			evidence({}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(result.lexicon).toEqual(emptyLexicon());
		expect(result.score).toBe(0);
		expect(result.reason).toBe('insufficient_evidence');
	});

	it('does not assign below strength threshold', () => {
		const result = resolveCreatureLexicon(
			evidence({ 'glyph-1': { food: 0.1 } }),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(result.lexicon.food).toBeNull();
	});

	it('assigns food when only food evidence is sufficient', () => {
		const result = resolveCreatureLexicon(
			evidence({ 'glyph-2': { food: 0.25 } }),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(result.lexicon.food).toBe('glyph-2');
		expect(result.lexicon.water).toBeNull();
	});

	it('never assigns one symbol to both food and water', () => {
		const result = resolveCreatureLexicon(
			evidence({
				'glyph-2': { food: 0.9, water: 0.8 },
				'glyph-1': { food: 0.4, water: 0.6 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(result.lexicon.food).not.toBeNull();
		expect(result.lexicon.water).not.toBeNull();
		expect(result.lexicon.food).not.toBe(result.lexicon.water);
		// Max total: food→glyph-2 (0.9) + water→glyph-1 (0.6) = 1.5
		// alternative food→glyph-1 (0.4) + water→glyph-2 (0.8) = 1.2
		expect(result.lexicon.food).toBe('glyph-2');
		expect(result.lexicon.water).toBe('glyph-1');
		expect(result.score).toBeCloseTo(1.5);
	});

	it('retains overlapping raw evidence while keeping exclusive assignment', () => {
		const rows = evidence({
			'glyph-2': { food: 0.9, water: 0.8 },
			'glyph-1': { food: 0.4, water: 0.6 }
		});
		const result = resolveCreatureLexicon(rows, DEFAULT_SYMBOL_INVENTORY, config);
		expect(result.lexicon.food).toBe('glyph-2');
		expect(result.lexicon.water).toBe('glyph-1');
		const g2 = rows.find((r) => r.symbolId === 'glyph-2')!;
		expect(g2.foodStrength).toBe(0.9);
		expect(g2.waterStrength).toBe(0.8);
	});

	it('selects maximum-total-evidence non-duplicating mapping', () => {
		const result = resolveCreatureLexicon(
			evidence({
				'glyph-0': { food: 0.5, water: 0.1 },
				'glyph-1': { food: 0.3, water: 0.7 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(result.lexicon.food).toBe('glyph-0');
		expect(result.lexicon.water).toBe('glyph-1');
		expect(result.score).toBeCloseTo(1.2);
	});

	it('uses deterministic inventory-order tie-breaking', () => {
		const a = resolveCreatureLexicon(
			evidence({
				'glyph-0': { food: 0.5 },
				'glyph-1': { food: 0.5 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		const b = resolveCreatureLexicon(
			evidence({
				'glyph-0': { food: 0.5 },
				'glyph-1': { food: 0.5 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(a.lexicon).toEqual(b.lexicon);
		expect(a.lexicon.food).toBe('glyph-0');
	});

	it('handles mixed evidence on a single symbol without dual assignment', () => {
		const result = resolveCreatureLexicon(
			evidence({ 'glyph-2': { food: 0.5, water: 0.4 } }),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		// Only one meaning can take glyph-2; food score 0.5 > water 0.4
		expect(result.lexicon.food).toBe('glyph-2');
		expect(result.lexicon.water).toBeNull();
	});

	it('reassigns when later evidence supports a better mapping', () => {
		const before = resolveCreatureLexicon(
			evidence({
				'glyph-2': { food: 0.9 },
				'glyph-1': { water: 0.8 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(before.lexicon).toEqual({ food: 'glyph-2', water: 'glyph-1' });

		const after = resolveCreatureLexicon(
			evidence({
				'glyph-2': { food: 0.3, water: 0.9 },
				'glyph-1': { food: 0.85, water: 0.2 }
			}),
			DEFAULT_SYMBOL_INVENTORY,
			config
		);
		expect(after.lexicon.food).toBe('glyph-1');
		expect(after.lexicon.water).toBe('glyph-2');
	});

	it('treats non-finite strengths as ineligible', () => {
		const rows = evidence({});
		rows[0] = {
			symbolId: 'glyph-0',
			foodStrength: Number.NaN,
			waterStrength: Number.POSITIVE_INFINITY,
			foodEvidenceCount: 5,
			waterEvidenceCount: 5
		};
		const result = resolveCreatureLexicon(rows, DEFAULT_SYMBOL_INVENTORY, config);
		expect(result.lexicon).toEqual(emptyLexicon());
	});
});

describe('diffLexiconChanges', () => {
	it('records only meanings that changed', () => {
		const entries = diffLexiconChanges(
			{ food: 'glyph-0', water: null },
			{ food: 'glyph-1', water: 'glyph-2' },
			{
				timeSeconds: 3,
				assignmentScore: 1.2,
				reason: 'test',
				evidenceNote: 'note'
			}
		);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			meaning: 'food',
			previousSymbolId: 'glyph-0',
			newSymbolId: 'glyph-1'
		});
		expect(entries[1]).toMatchObject({
			meaning: 'water',
			previousSymbolId: null,
			newSymbolId: 'glyph-2'
		});
	});
});
