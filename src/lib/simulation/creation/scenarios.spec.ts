import { describe, expect, it } from 'vitest';
import { createSimulation } from '../create-simulation';
import { stepResources } from '../resources';
import { defaultSimulationConfig } from './config';
import { validateSimulationConfig } from './validation';
import { scenarioSimulationConfig, SIMULATION_SCENARIOS } from './scenarios';

const seeds = ['demo', 'overnight-river', 'overnight-drought'];

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
				expect(state.creatures).toHaveLength(id === 'crowded' ? 32 : 12);
				expect(state.habitat.food).toHaveLength(
					id === 'resource-rich' ? 8 : defaultSimulationConfig(seed).habitat.foodCount
				);
				expect(state.wildlife).toHaveLength(
					id === 'resource-rich' ? 2 : defaultSimulationConfig(seed).ecology.wildlifeCount
				);
				expect(config.lifecycle.populationCap).toBe(64);
				expect(createSimulation(scenarioSimulationConfig(seed, id))).toEqual(state);
			}
		}
	);
	it.each(SIMULATION_SCENARIOS)(
		'$id uses its fixed food attempt cadence without consulting population needs',
		({ id }) => {
			const config = scenarioSimulationConfig('demo', id);
			const state = createSimulation(config);
			const interval = id === 'resource-rich' ? 8 : 18;
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
