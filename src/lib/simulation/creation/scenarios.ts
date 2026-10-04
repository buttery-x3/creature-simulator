/** Reproducible starting conditions; scenario identity never enters cognition. */
import type { SimulationConfig } from '../types';
import { defaultSimulationConfig } from './config';

export type SimulationScenarioId = 'baseline' | 'resource-rich' | 'crowded';

export const SIMULATION_SCENARIOS: readonly {
	readonly id: SimulationScenarioId;
	readonly label: string;
	readonly description: string;
}[] = [
	{
		id: 'baseline',
		label: 'Baseline',
		description: 'The default habitat, 12 founders and existing resource and wildlife settings.'
	},
	{
		id: 'resource-rich',
		label: 'More food, fewer predators',
		description:
			'12 founders, 8 initial food sources, a 12-source food cap, food attempts every 8 seconds and 2 wildlife animals. Survival remains an observed outcome.'
	},
	{
		id: 'crowded',
		label: 'Population stress (32)',
		description:
			'32 founders share the baseline habitat, resources and wildlife. The population cap remains 64.'
	}
];

/** Each call returns independent configuration with only the named fixed overrides. */
export function scenarioSimulationConfig(
	seed: string,
	scenario: SimulationScenarioId = 'baseline'
): SimulationConfig {
	const config = defaultSimulationConfig(seed);
	config.symbolInventory = [...config.symbolInventory];
	switch (scenario) {
		case 'baseline':
			return config;
		case 'resource-rich':
			return {
				...config,
				habitat: { ...config.habitat, foodCount: 8 },
				maxActiveFoodSources: 12,
				foodSpawnIntervalSeconds: 8,
				ecology: { ...config.ecology, wildlifeCount: 2 }
			};
		case 'crowded':
			return { ...config, creatureCount: 32 };
	}
}
