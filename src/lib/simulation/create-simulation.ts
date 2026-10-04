import { generateHabitat, type HabitatGenerationConfig } from '$lib/habitat';
import { createInitialEnvironment } from './resources';
import { createWildlife } from './ecology';
import { createCreatures } from './creation/creatures';
import { validateSimulationConfig } from './creation/validation';
import type { SimulationConfig, SimulationState } from './types';

export { DEFAULT_SIMULATION_CONFIG, defaultSimulationConfig } from './creation/config';
export { SimulationCreationError } from './creation/validation';
export {
	VERBOSITY_CHANNEL,
	CURIOSITY_CHANNEL,
	sampleVerbosity,
	sampleCuriosity
} from './creation/creatures';

/**
 * Create a full simulation: deterministic habitat (raw seed) and creatures
 * (derived 'creatures' stream). Same seed and config always match.
 */
export function createSimulation(config: SimulationConfig): SimulationState {
	validateSimulationConfig(config);

	const habitatConfig: HabitatGenerationConfig = {
		...config.habitat,
		seed: config.seed,
		homeSize: { ...config.habitat.homeSize },
		foodSize: { ...config.habitat.foodSize },
		waterSize: { ...config.habitat.waterSize }
	};

	const habitat = generateHabitat(habitatConfig);
	const creatures = createCreatures(config, habitat);
	const environment = createInitialEnvironment(config.seed, {
		rainIntervalMinSeconds: config.rainIntervalMinSeconds,
		rainIntervalMaxSeconds: config.rainIntervalMaxSeconds,
		rainDurationSeconds: config.rainDurationSeconds,
		foodSpawnIntervalSeconds: config.foodSpawnIntervalSeconds
	});

	return {
		seed: config.seed,
		timeSeconds: 0,
		habitat,
		environment,
		creatures,
		nextCreatureId: creatures.length,
		recentLifeEvents: [],
		wildlife: createWildlife(config.seed, habitat, config.ecology),
		recentEncounters: [],
		activeEmissions: [],
		recentEmissions: []
	};
}

/** Stable snapshot for equality checks. */
export function simulationSnapshot(state: SimulationState): string {
	return JSON.stringify(state);
}
