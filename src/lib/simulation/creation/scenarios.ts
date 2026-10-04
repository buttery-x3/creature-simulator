/** Reproducible starting conditions; scenario identity never enters cognition. */
import type { SimulationConfig } from '../types';
import { defaultSimulationConfig } from './config';

export type SimulationScenarioId = 'baseline' | 'resource-rich' | 'crowded' | 'larger-world';

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
	},
	{
		id: 'larger-world',
		label: 'Larger world (48)',
		description:
			'48 founders in one home on a 40×28 habitat, 32 food sources, 8 water sources and 8 wildlife. Food attempts every 2 seconds, food cap 48 and computational population cap 128. Personal memory and sensing ranges stay unchanged.'
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
		case 'larger-world':
			return {
				...config,
				creatureCount: 48,
				habitat: {
					...config.habitat,
					worldWidth: 40,
					worldHeight: 28,
					foodCount: 32,
					waterCount: 8,
					homeSize: {
						minWidth: config.habitat.homeSize.minWidth * 2,
						maxWidth: config.habitat.homeSize.maxWidth * 2,
						minHeight: config.habitat.homeSize.minHeight * 2,
						maxHeight: config.habitat.homeSize.maxHeight * 2
					}
				},
				maxActiveFoodSources: 48,
				foodSpawnIntervalSeconds: 2,
				ecology: { ...config.ecology, wildlifeCount: 8 },
				lifecycle: { ...config.lifecycle, populationCap: 128 }
			};
		case 'crowded':
			return { ...config, creatureCount: 32 };
	}
}
