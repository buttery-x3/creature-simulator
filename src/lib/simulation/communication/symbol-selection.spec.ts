import { describe, expect, it } from 'vitest';
import { selectContextSymbol } from './symbol-selection';
import { DEFAULT_SYMBOL_INVENTORY } from './types';
import type { LexiconAssignmentRow } from './symbol-selection';

const emptyLexicon: LexiconAssignmentRow = { food: null, water: null };

describe('selectContextSymbol', () => {
	it('emits the resolved food lexicon assignment for food context', () => {
		const result = selectContextSymbol({
			simulationSeed: 'seed-a',
			creatureId: 'creature-0',
			emissionCount: 0,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: { food: 'glyph-2', water: 'glyph-1' },
			preferredSymbolId: 'glyph-0'
		});
		expect(result.symbolId).toBe('glyph-2');
		expect(result.evidence.mode).toBe('learned_lexicon');
		expect(result.evidence.assignedSymbolId).toBe('glyph-2');
		expect(result.evidence.sample).toBeNull();
		expect(result.reasonText).toContain('learned_lexicon');
	});

	it('emits the resolved water lexicon assignment for water context', () => {
		const result = selectContextSymbol({
			simulationSeed: 'seed-a',
			creatureId: 'creature-0',
			emissionCount: 0,
			contextDetail: 'water',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: { food: 'glyph-2', water: 'glyph-1' },
			preferredSymbolId: 'glyph-0'
		});
		expect(result.symbolId).toBe('glyph-1');
		expect(result.evidence.mode).toBe('learned_lexicon');
	});

	it('uses exploratory selection when the context is unassigned', () => {
		const result = selectContextSymbol({
			simulationSeed: 'seed-a',
			creatureId: 'creature-0',
			emissionCount: 0,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: emptyLexicon,
			preferredSymbolId: 'glyph-0'
		});
		expect(result.evidence.mode).toBe('exploratory');
		expect(result.evidence.assignedSymbolId).toBeNull();
		expect(result.evidence.sample).not.toBeNull();
		expect(DEFAULT_SYMBOL_INVENTORY).toContain(result.symbolId);
	});

	it('prefers symbols not assigned to another meaning when exploring', () => {
		const result = selectContextSymbol({
			simulationSeed: 'seed-explore',
			creatureId: 'creature-1',
			emissionCount: 3,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: { food: null, water: 'glyph-0' },
			preferredSymbolId: 'glyph-0'
		});
		expect(result.evidence.mode).toBe('exploratory');
		expect(result.symbolId).not.toBe('glyph-0');
		const g0 = result.evidence.candidates.find((c) => c.symbolId === 'glyph-0')!;
		expect(g0.note).toBe('assigned_other_meaning');
	});

	it('is deterministic for identical inputs', () => {
		const input = {
			simulationSeed: 'seed-det',
			creatureId: 'creature-2',
			emissionCount: 5,
			contextDetail: 'water' as const,
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: emptyLexicon,
			preferredSymbolId: 'glyph-3' as const
		};
		const a = selectContextSymbol(input);
		const b = selectContextSymbol(input);
		expect(a).toEqual(b);
	});

	it('does not use independent multi-context weighted sampling as learned path', () => {
		// Even if water is assigned, food learned path only looks at food assignment.
		const result = selectContextSymbol({
			simulationSeed: 'seed-x',
			creatureId: 'creature-0',
			emissionCount: 0,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			lexicon: { food: 'glyph-3', water: 'glyph-1' },
			preferredSymbolId: 'glyph-0'
		});
		expect(result.symbolId).toBe('glyph-3');
		expect(result.evidence.mode).toBe('learned_lexicon');
		expect(result.evidence.reason).toBe('learned_lexicon');
		expect(result.evidence.reason).not.toContain('weighted');
	});

	it('throws on empty inventory', () => {
		expect(() =>
			selectContextSymbol({
				simulationSeed: 'seed',
				creatureId: 'c',
				emissionCount: 0,
				contextDetail: 'food',
				inventory: [],
				lexicon: emptyLexicon,
				preferredSymbolId: 'glyph-0'
			})
		).toThrow(/inventory/);
	});

	it('falls back to full inventory exploratory pool when all symbols are assigned', () => {
		// With only two meanings both assigned, remaining inventory symbols stay eligible;
		// when food is unassigned but water takes one, food explores the rest.
		// Force "all assigned" by assigning food and water; exploring food uses learned path.
		// When food unassigned and every inventory symbol is water-assigned is impossible
		// with one water slot — use learned assignment covering one, explore others.
		const result = selectContextSymbol({
			simulationSeed: 'seed-all',
			creatureId: 'creature-9',
			emissionCount: 1,
			contextDetail: 'water',
			inventory: ['glyph-0'] as const,
			lexicon: { food: 'glyph-0', water: null },
			preferredSymbolId: 'glyph-0'
		});
		// Only one symbol, already assigned to food → exploratory pool falls back to inventory.
		expect(result.evidence.mode).toBe('exploratory');
		expect(result.symbolId).toBe('glyph-0');
		expect(result.evidence.reason).toContain('all_assigned');
	});
});
