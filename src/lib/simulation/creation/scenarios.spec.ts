import { describe, expect, it } from 'vitest';
import { createSimulation } from '../create-simulation';
import { stepResources } from '../resources';
import { defaultSimulationConfig } from './config';
import { validateSimulationConfig } from './validation';
import { scenarioSimulationConfig, SIMULATION_SCENARIOS } from './scenarios';

const seeds = ['demo', 'overnight-river', 'overnight-drought'];
const expectedScenarios = {
	baseline: { founders: 12, food: 5, water: 2, wildlife: 6, cap: 64, interval: 18 },
	'resource-rich': { founders: 12, food: 8, water: 2, wildlife: 2, cap: 64, interval: 8 },
	crowded: { founders: 32, food: 5, water: 2, wildlife: 6, cap: 64, interval: 18 },
	'larger-world': { founders: 48, food: 32, water: 8, wildlife: 8, cap: 128, interval: 2 }
};

describe('deterministic scenario configuration', () => {
	it.each(seeds)('keeps baseline exactly equal to existing defaults for %s', (seed) => {
		expect(scenarioSimulationConfig(seed)).toEqual(defaultSimulationConfig(seed));
		expect(scenarioSimulationConfig(seed, 'baseline')).toEqual(defaultSimulationConfig(seed));
	});
	it('changes only the disclosed resource and wildlife values for resource-rich', () => {
		const baseline = defaultSimulationConfig('demo');
		expect(scenarioSimulationConfig('demo', 'resource-rich')).toEqual({
			...baseline,
			habitat: { ...baseline.habitat, foodCount: 8 },
			maxActiveFoodSources: 12,
			foodSpawnIntervalSeconds: 8,
			ecology: { ...baseline.ecology, wildlifeCount: 2 }
		});
	});
	it('changes only initial population for crowded', () => {
		expect(scenarioSimulationConfig('demo', 'crowded')).toEqual({
			...defaultSimulationConfig('demo'),
			creatureCount: 32
		});
	});
	it('scales the rich habitat and population without expanding personal knowledge or changing behavior', () => {
		const rich = scenarioSimulationConfig('demo', 'resource-rich');
		expect(scenarioSimulationConfig('demo', 'larger-world')).toEqual({
			...rich,
			creatureCount: rich.creatureCount * 4,
			habitat: {
				...rich.habitat,
				worldWidth: rich.habitat.worldWidth * 2,
				worldHeight: rich.habitat.worldHeight * 2,
				foodCount: rich.habitat.foodCount * 4,
				waterCount: rich.habitat.waterCount * 4,
				homeSize: {
					minWidth: rich.habitat.homeSize.minWidth * 2,
					maxWidth: rich.habitat.homeSize.maxWidth * 2,
					minHeight: rich.habitat.homeSize.minHeight * 2,
					maxHeight: rich.habitat.homeSize.maxHeight * 2
				}
			},
			maxActiveFoodSources: rich.maxActiveFoodSources * 4,
			foodSpawnIntervalSeconds: rich.foodSpawnIntervalSeconds / 4,
			ecology: { ...rich.ecology, wildlifeCount: rich.ecology.wildlifeCount * 4 },
			lifecycle: { ...rich.lifecycle, populationCap: 128 }
		});
	});
	it.each(SIMULATION_SCENARIOS)(
		'$id returns independent nested configurations without leaking edits',
		({ id }) => {
			const first = scenarioSimulationConfig('demo', id);
			const second = scenarioSimulationConfig('demo', id);
			const expected = structuredClone(second);
			for (const key of [
				'habitat',
				'ecology',
				'lifecycle',
				'movementSpeed',
				'memoryCapacityRange',
				'symbolInventory'
			] as const)
				expect(first[key]).not.toBe(second[key]);
			for (const key of ['homeSize', 'foodSize', 'waterSize'] as const)
				expect(first.habitat[key]).not.toBe(second.habitat[key]);
			first.habitat.foodCount = 0;
			first.habitat.foodSize.minWidth = 0.1;
			first.ecology.wildlifeCount = 0;
			first.lifecycle.populationCap = 1;
			first.memoryCapacityRange.max = 1;
			first.movementSpeed.max = 100;
			first.symbolInventory = ['glyph-3'];
			expect(second).toEqual(expected);
			expect(scenarioSimulationConfig('demo', id)).toEqual(expected);
			expect(scenarioSimulationConfig('demo')).toEqual(defaultSimulationConfig('demo'));
		}
	);
	it.each(SIMULATION_SCENARIOS)(
		'$id validates and creates expected populations and resources across seeds',
		({ id }) => {
			for (const seed of seeds) {
				const config = scenarioSimulationConfig(seed, id);
				expect(() => validateSimulationConfig(config)).not.toThrow();
				const state = createSimulation(config);
				const expected = expectedScenarios[id];
				expect(state.creatures).toHaveLength(expected.founders);
				expect(state.habitat.food).toHaveLength(expected.food);
				expect(state.habitat.water).toHaveLength(expected.water);
				expect(state.wildlife).toHaveLength(expected.wildlife);
				expect(config.lifecycle.populationCap).toBe(expected.cap);
				expect(createSimulation(scenarioSimulationConfig(seed, id))).toEqual(state);
			}
		}
	);
	it.each(SIMULATION_SCENARIOS)(
		'$id uses its fixed food attempt cadence without consulting population needs',
		({ id }) => {
			const config = scenarioSimulationConfig('demo', id);
			const state = createSimulation(config);
			const interval = expectedScenarios[id].interval;
			expect(state.environment.nextFoodSpawnAt).toBe(interval);
			const before = stepResources(
				{ ...state, creatures: [] },
				interval - 0.01,
				config.fixedDt,
				config
			);
			expect(before.environment.foodSpawnEventIndex).toBe(0);
			const due = stepResources({ ...state, creatures: [] }, interval, config.fixedDt, config);
			expect(due.environment.foodSpawnEventIndex).toBe(1);
			expect(due.environment.nextFoodSpawnAt).toBe(interval * 2);
			expect(due.habitat.food.length).toBeLessThanOrEqual(config.maxActiveFoodSources);
		}
	);
});
