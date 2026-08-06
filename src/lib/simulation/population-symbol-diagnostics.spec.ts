import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from './create-simulation';
import {
	buildPopulationSymbolDiagnostics,
	formatPopulationSymbolDiagnostics
} from './population-symbol-diagnostics';
import { testCreature } from './test-creature';
import type { SignalEmission } from './communication/types';
import type { SymbolAssociation } from './learning/types';
import { DEFAULT_SYMBOL_INVENTORY } from './communication/types';

function emptySelectionEvidence(
	symbolId: SignalEmission['symbolId'],
	context: 'food' | 'water'
): SignalEmission['selectionEvidence'] {
	return {
		emissionContext: context,
		selectedSymbolId: symbolId,
		candidates: DEFAULT_SYMBOL_INVENTORY.map((id) => ({
			symbolId: id,
			learnedStrength: 0,
			explorationFloor: 0.15,
			effectiveWeight: 0.15
		})),
		sample: 0.5,
		usedFallback: false,
		reason: 'weighted_association'
	};
}

function emission(
	partial: Pick<SignalEmission, 'id' | 'symbolId' | 'contextDetail' | 'emittedAt'>
): SignalEmission {
	return {
		id: partial.id,
		symbolId: partial.symbolId,
		senderId: 'creature-0',
		origin: { x: 0, y: 0 },
		emittedAt: partial.emittedAt,
		expiresAt: partial.emittedAt + 1,
		context: 'resource_discovered',
		contextDetail: partial.contextDetail,
		symbolSelectionReason: 'test',
		selectionEvidence: emptySelectionEvidence(partial.symbolId, partial.contextDetail)
	};
}

function assoc(
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

describe('buildPopulationSymbolDiagnostics', () => {
	it('matches known fixture populations for mean and evidence counts', () => {
		const inventory = DEFAULT_SYMBOL_INVENTORY;
		const creatures = [
			testCreature({
				id: 'a',
				symbolAssociations: inventory.map((id) =>
					id === 'glyph-1' ? assoc(id, 0.8, 0) : assoc(id, 0, 0)
				)
			}),
			testCreature({
				id: 'b',
				symbolAssociations: inventory.map((id) =>
					id === 'glyph-1' ? assoc(id, 0.4, 0) : assoc(id, 0, 0)
				)
			}),
			testCreature({
				id: 'c',
				symbolAssociations: inventory.map((id) => assoc(id, 0, 0))
			})
		];
		const base = createSimulation({ ...defaultSimulationConfig('pop-fix'), creatureCount: 0 });
		const state = {
			...base,
			timeSeconds: 10,
			creatures,
			recentEmissions: []
		};
		const diag = buildPopulationSymbolDiagnostics(state, {
			symbolInventory: inventory,
			recentEmissionDiagnosticsWindowSeconds: 30
		});

		const g1 = diag.food.associations.find((a) => a.symbolId === 'glyph-1')!;
		expect(g1.meanStrength).toBeCloseTo((0.8 + 0.4 + 0) / 3);
		expect(g1.creaturesWithEvidence).toBe(2);
		expect(g1.proportionWithEvidence).toBeCloseTo(2 / 3);
		expect(g1.creaturesStrongest).toBe(2);
		expect(diag.food.highestMeanAssociationSymbolId).toBe('glyph-1');
		expect(diag.food.creaturesContributingEvidence).toBe(2);
	});

	it('separates recent emission counts by context and symbol', () => {
		const base = createSimulation({ ...defaultSimulationConfig('pop-emit'), creatureCount: 0 });
		const state = {
			...base,
			timeSeconds: 20,
			creatures: [testCreature({ id: 'a' })],
			recentEmissions: [
				emission({ id: 'e1', symbolId: 'glyph-0', contextDetail: 'food', emittedAt: 15 }),
				emission({ id: 'e2', symbolId: 'glyph-0', contextDetail: 'food', emittedAt: 16 }),
				emission({ id: 'e3', symbolId: 'glyph-1', contextDetail: 'food', emittedAt: 17 }),
				emission({ id: 'e4', symbolId: 'glyph-0', contextDetail: 'water', emittedAt: 18 }),
				// Outside window
				emission({ id: 'e5', symbolId: 'glyph-2', contextDetail: 'food', emittedAt: 0 })
			]
		};
		const diag = buildPopulationSymbolDiagnostics(state, {
			symbolInventory: DEFAULT_SYMBOL_INVENTORY,
			recentEmissionDiagnosticsWindowSeconds: 10
		});

		const food0 = diag.food.emissions.find((e) => e.symbolId === 'glyph-0')!;
		const food1 = diag.food.emissions.find((e) => e.symbolId === 'glyph-1')!;
		const food2 = diag.food.emissions.find((e) => e.symbolId === 'glyph-2')!;
		const water0 = diag.water.emissions.find((e) => e.symbolId === 'glyph-0')!;
		expect(food0.recentCount).toBe(2);
		expect(food1.recentCount).toBe(1);
		expect(food2.recentCount).toBe(0);
		expect(food0.recentShare).toBeCloseTo(2 / 3);
		expect(water0.recentCount).toBe(1);
		expect(diag.food.mostEmittedSymbolId).toBe('glyph-0');
		expect(diag.water.mostEmittedSymbolId).toBe('glyph-0');
	});

	it('reports high concentration for single-symbol emissions and lower for uniform', () => {
		const base = createSimulation({ ...defaultSimulationConfig('pop-entropy'), creatureCount: 0 });
		const concentrated = {
			...base,
			timeSeconds: 10,
			creatures: [testCreature({ id: 'a' })],
			recentEmissions: [
				emission({ id: 'c1', symbolId: 'glyph-1', contextDetail: 'food', emittedAt: 9 }),
				emission({ id: 'c2', symbolId: 'glyph-1', contextDetail: 'food', emittedAt: 9.5 }),
				emission({ id: 'c3', symbolId: 'glyph-1', contextDetail: 'food', emittedAt: 9.8 })
			]
		};
		const uniform = {
			...base,
			timeSeconds: 10,
			creatures: [testCreature({ id: 'a' })],
			recentEmissions: DEFAULT_SYMBOL_INVENTORY.map((symbolId, i) =>
				emission({
					id: `u${i}`,
					symbolId,
					contextDetail: 'food',
					emittedAt: 9
				})
			)
		};
		const conc = buildPopulationSymbolDiagnostics(concentrated, {
			symbolInventory: DEFAULT_SYMBOL_INVENTORY,
			recentEmissionDiagnosticsWindowSeconds: 30
		});
		const uni = buildPopulationSymbolDiagnostics(uniform, {
			symbolInventory: DEFAULT_SYMBOL_INVENTORY,
			recentEmissionDiagnosticsWindowSeconds: 30
		});

		expect(conc.food.emissionConcentrationMaxShare).toBe(1);
		expect(conc.food.emissionEntropyNormalised).toBeCloseTo(0);
		expect(uni.food.emissionConcentrationMaxShare).toBeCloseTo(0.25);
		expect(uni.food.emissionEntropyNormalised).toBeCloseTo(1);
	});

	it('does not mutate simulation state', () => {
		const config = defaultSimulationConfig('pop-pure');
		const state = createSimulation({ ...config, creatureCount: 2 });
		const before = JSON.stringify(state);
		buildPopulationSymbolDiagnostics(state, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		});
		expect(JSON.stringify(state)).toBe(before);
	});

	it('format uses observational language without canonical food/water labels', () => {
		const config = defaultSimulationConfig('pop-fmt');
		const state = createSimulation({ ...config, creatureCount: 1 });
		const diag = buildPopulationSymbolDiagnostics(state, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		});
		const text = formatPopulationSymbolDiagnostics(diag);
		expect(text).toContain('observational');
		expect(text).toContain('highest mean association');
		expect(text).not.toMatch(/the food symbol/i);
		expect(text).not.toMatch(/the water symbol/i);
	});
});
