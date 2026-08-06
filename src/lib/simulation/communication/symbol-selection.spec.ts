import { describe, expect, it } from 'vitest';
import { buildEmissionWeights, selectContextSymbol } from './symbol-selection';
import { DEFAULT_SYMBOL_INVENTORY } from './types';
import type { AssociationStrengthRow } from './symbol-selection';

const baseConfig = {
	emissionExplorationFloor: 0.15,
	emissionAssociationWeightMultiplier: 1
};

const zeroAssociations: AssociationStrengthRow[] = DEFAULT_SYMBOL_INVENTORY.map((symbolId) => ({
	symbolId,
	foodStrength: 0,
	waterStrength: 0
}));

function associationsWith(
	overrides: Partial<
		Record<(typeof DEFAULT_SYMBOL_INVENTORY)[number], { food?: number; water?: number }>
	>
): AssociationStrengthRow[] {
	return DEFAULT_SYMBOL_INVENTORY.map((symbolId) => ({
		symbolId,
		foodStrength: overrides[symbolId]?.food ?? 0,
		waterStrength: overrides[symbolId]?.water ?? 0
	}));
}

describe('buildEmissionWeights', () => {
	it('uses only food associations for food context', () => {
		const associations = associationsWith({
			'glyph-1': { food: 0.5, water: 0.9 },
			'glyph-2': { food: 0.1, water: 0.8 }
		});
		const weights = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			associations,
			'food',
			baseConfig
		);
		const byId = Object.fromEntries(weights.map((w) => [w.symbolId, w]));
		expect(byId['glyph-1']!.learnedStrength).toBe(0.5);
		expect(byId['glyph-1']!.effectiveWeight).toBeCloseTo(0.65);
		expect(byId['glyph-2']!.learnedStrength).toBe(0.1);
		// Water strengths must not appear as food learned strengths
		expect(byId['glyph-1']!.learnedStrength).not.toBe(0.9);
	});

	it('uses only water associations for water context', () => {
		const associations = associationsWith({
			'glyph-1': { food: 0.5, water: 0.9 },
			'glyph-2': { food: 0.1, water: 0.2 }
		});
		const weights = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			associations,
			'water',
			baseConfig
		);
		const byId = Object.fromEntries(weights.map((w) => [w.symbolId, w]));
		expect(byId['glyph-1']!.learnedStrength).toBe(0.9);
		expect(byId['glyph-1']!.effectiveWeight).toBeCloseTo(1.05);
		expect(byId['glyph-2']!.learnedStrength).toBe(0.2);
	});

	it('reuses association values directly (effective = floor + mult * strength)', () => {
		const associations = associationsWith({ 'glyph-0': { food: 0.4 } });
		const weights = buildEmissionWeights(DEFAULT_SYMBOL_INVENTORY, associations, 'food', {
			emissionExplorationFloor: 0.1,
			emissionAssociationWeightMultiplier: 2
		});
		const g0 = weights.find((w) => w.symbolId === 'glyph-0')!;
		expect(g0.learnedStrength).toBe(0.4);
		expect(g0.explorationFloor).toBe(0.1);
		expect(g0.effectiveWeight).toBeCloseTo(0.1 + 2 * 0.4);
	});

	it('gives every symbol non-zero exploratory weight when floor > 0', () => {
		const weights = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			zeroAssociations,
			'food',
			baseConfig
		);
		for (const w of weights) {
			expect(w.effectiveWeight).toBeGreaterThan(0);
			expect(w.effectiveWeight).toBe(baseConfig.emissionExplorationFloor);
		}
	});

	it('increases effective weight when learned strength increases', () => {
		const weak = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			associationsWith({ 'glyph-2': { food: 0.2 } }),
			'food',
			baseConfig
		);
		const strong = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			associationsWith({ 'glyph-2': { food: 0.8 } }),
			'food',
			baseConfig
		);
		const weakW = weak.find((w) => w.symbolId === 'glyph-2')!.effectiveWeight;
		const strongW = strong.find((w) => w.symbolId === 'glyph-2')!.effectiveWeight;
		expect(strongW).toBeGreaterThan(weakW);
	});

	it('food learning does not alter water emission weights', () => {
		const base = associationsWith({});
		const foodLearned = associationsWith({ 'glyph-3': { food: 0.7 } });
		const baseWater = buildEmissionWeights(DEFAULT_SYMBOL_INVENTORY, base, 'water', baseConfig);
		const learnedWater = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			foodLearned,
			'water',
			baseConfig
		);
		expect(learnedWater.map((w) => w.effectiveWeight)).toEqual(
			baseWater.map((w) => w.effectiveWeight)
		);
	});

	it('water learning does not alter food emission weights', () => {
		const base = associationsWith({});
		const waterLearned = associationsWith({ 'glyph-3': { water: 0.7 } });
		const baseFood = buildEmissionWeights(DEFAULT_SYMBOL_INVENTORY, base, 'food', baseConfig);
		const learnedFood = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			waterLearned,
			'food',
			baseConfig
		);
		expect(learnedFood.map((w) => w.effectiveWeight)).toEqual(
			baseFood.map((w) => w.effectiveWeight)
		);
	});

	it('iterates candidates in stable inventory order', () => {
		const weights = buildEmissionWeights(
			DEFAULT_SYMBOL_INVENTORY,
			zeroAssociations,
			'food',
			baseConfig
		);
		expect(weights.map((w) => w.symbolId)).toEqual([...DEFAULT_SYMBOL_INVENTORY]);
	});
});

describe('selectContextSymbol', () => {
	it('selects identically for identical associations and deterministic inputs', () => {
		const associations = associationsWith({ 'glyph-1': { food: 0.6 } });
		const input = {
			simulationSeed: 'sel-det',
			creatureId: 'creature-0',
			emissionCount: 3,
			contextDetail: 'food' as const,
			inventory: DEFAULT_SYMBOL_INVENTORY,
			associations,
			preferredSymbolId: 'glyph-0' as const,
			config: baseConfig
		};
		const a = selectContextSymbol(input);
		const b = selectContextSymbol(input);
		expect(a.symbolId).toBe(b.symbolId);
		expect(a.evidence.sample).toBe(b.evidence.sample);
		expect(a.evidence.usedFallback).toBe(false);
		expect(a.evidence.reason).toBe('weighted_association');
	});

	it('allows zero-association creatures to emit through exploration floor', () => {
		const result = selectContextSymbol({
			simulationSeed: 'cold-start',
			creatureId: 'creature-1',
			emissionCount: 0,
			contextDetail: 'water',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			associations: zeroAssociations,
			preferredSymbolId: 'glyph-0',
			config: baseConfig
		});
		expect(DEFAULT_SYMBOL_INVENTORY).toContain(result.symbolId);
		expect(result.evidence.usedFallback).toBe(false);
		expect(result.evidence.candidates.every((c) => c.effectiveWeight > 0)).toBe(true);
	});

	it('falls back to preferred when all effective weights are zero', () => {
		const result = selectContextSymbol({
			simulationSeed: 'fallback',
			creatureId: 'creature-2',
			emissionCount: 0,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			associations: zeroAssociations,
			preferredSymbolId: 'glyph-2',
			config: {
				emissionExplorationFloor: 0,
				emissionAssociationWeightMultiplier: 0
			}
		});
		expect(result.symbolId).toBe('glyph-2');
		expect(result.evidence.usedFallback).toBe(true);
		expect(result.evidence.reason).toBe('fallback_preferred');
		expect(result.evidence.sample).toBeNull();
	});

	it('different learned strengths alter selection across emission sequences', () => {
		const weak = associationsWith({ 'glyph-2': { food: 0.05 } });
		const strong = associationsWith({ 'glyph-2': { food: 5 } }); // very strong bias
		const picksWeak = new Set<string>();
		const picksStrong = new Set<string>();
		for (let emissionCount = 0; emissionCount < 40; emissionCount += 1) {
			picksWeak.add(
				selectContextSymbol({
					simulationSeed: 'seq-bias',
					creatureId: 'creature-0',
					emissionCount,
					contextDetail: 'food',
					inventory: DEFAULT_SYMBOL_INVENTORY,
					associations: weak,
					preferredSymbolId: 'glyph-0',
					config: baseConfig
				}).symbolId
			);
			picksStrong.add(
				selectContextSymbol({
					simulationSeed: 'seq-bias',
					creatureId: 'creature-0',
					emissionCount,
					contextDetail: 'food',
					inventory: DEFAULT_SYMBOL_INVENTORY,
					associations: strong,
					preferredSymbolId: 'glyph-0',
					config: baseConfig
				}).symbolId
			);
		}
		// Strong food association should produce more glyph-2 selections than weak.
		let weakGlyph2 = 0;
		let strongGlyph2 = 0;
		for (let emissionCount = 0; emissionCount < 40; emissionCount += 1) {
			if (
				selectContextSymbol({
					simulationSeed: 'seq-bias',
					creatureId: 'creature-0',
					emissionCount,
					contextDetail: 'food',
					inventory: DEFAULT_SYMBOL_INVENTORY,
					associations: weak,
					preferredSymbolId: 'glyph-0',
					config: baseConfig
				}).symbolId === 'glyph-2'
			) {
				weakGlyph2 += 1;
			}
			if (
				selectContextSymbol({
					simulationSeed: 'seq-bias',
					creatureId: 'creature-0',
					emissionCount,
					contextDetail: 'food',
					inventory: DEFAULT_SYMBOL_INVENTORY,
					associations: strong,
					preferredSymbolId: 'glyph-0',
					config: baseConfig
				}).symbolId === 'glyph-2'
			) {
				strongGlyph2 += 1;
			}
		}
		expect(strongGlyph2).toBeGreaterThan(weakGlyph2);
		expect(picksWeak.size).toBeGreaterThan(0);
		expect(picksStrong.size).toBeGreaterThan(0);
	});

	it('food and water contexts may select differently with divergent associations', () => {
		const associations = associationsWith({
			'glyph-0': { food: 10, water: 0 },
			'glyph-3': { food: 0, water: 10 }
		});
		const foodPicks = new Map<string, number>();
		const waterPicks = new Map<string, number>();
		for (let emissionCount = 0; emissionCount < 30; emissionCount += 1) {
			const food = selectContextSymbol({
				simulationSeed: 'ctx-div',
				creatureId: 'creature-0',
				emissionCount,
				contextDetail: 'food',
				inventory: DEFAULT_SYMBOL_INVENTORY,
				associations,
				preferredSymbolId: 'glyph-1',
				config: baseConfig
			}).symbolId;
			const water = selectContextSymbol({
				simulationSeed: 'ctx-div',
				creatureId: 'creature-0',
				emissionCount,
				contextDetail: 'water',
				inventory: DEFAULT_SYMBOL_INVENTORY,
				associations,
				preferredSymbolId: 'glyph-1',
				config: baseConfig
			}).symbolId;
			foodPicks.set(food, (foodPicks.get(food) ?? 0) + 1);
			waterPicks.set(water, (waterPicks.get(water) ?? 0) + 1);
		}
		expect(foodPicks.get('glyph-0') ?? 0).toBeGreaterThan(foodPicks.get('glyph-3') ?? 0);
		expect(waterPicks.get('glyph-3') ?? 0).toBeGreaterThan(waterPicks.get('glyph-0') ?? 0);
	});

	it('includes full selection evidence for diagnostics', () => {
		const result = selectContextSymbol({
			simulationSeed: 'evidence',
			creatureId: 'creature-0',
			emissionCount: 1,
			contextDetail: 'food',
			inventory: DEFAULT_SYMBOL_INVENTORY,
			associations: associationsWith({ 'glyph-1': { food: 0.3 } }),
			preferredSymbolId: 'glyph-0',
			config: baseConfig
		});
		expect(result.evidence.emissionContext).toBe('food');
		expect(result.evidence.selectedSymbolId).toBe(result.symbolId);
		expect(result.evidence.candidates).toHaveLength(DEFAULT_SYMBOL_INVENTORY.length);
		expect(result.evidence.candidates[0]!.symbolId).toBe(DEFAULT_SYMBOL_INVENTORY[0]);
		expect(typeof result.reasonText).toBe('string');
	});
});
