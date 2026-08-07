/**
 * One fixed-step resource/world advance:
 * weather → food spawn → eat/drink consumption grants.
 */

import type { Habitat } from '$lib/habitat';
import type { Creature, SimulationConfig, SimulationState } from '../types';
import { resolveConsumption } from './consumption';
import { advanceFoodSpawn } from './food-spawn';
import type { ConsumptionGrant, EnvironmentState } from './types';
import { advanceWeather } from './weather';

export type ResourcesStepConfig = Pick<
	SimulationConfig,
	| 'eatRecoveryPerSecond'
	| 'drinkRecoveryPerSecond'
	| 'maxActiveFoodSources'
	| 'foodSpawnIntervalSeconds'
	| 'rainIntervalMinSeconds'
	| 'rainIntervalMaxSeconds'
	| 'rainDurationSeconds'
	| 'habitat'
>;

export type ResourcesStepResult = {
	habitat: Habitat;
	environment: EnvironmentState;
	grantsByCreatureId: Map<string, ConsumptionGrant>;
};

/**
 * Advance runtime world resources to `timeSeconds` and resolve consumption
 * for creatures already on eat/drink at the start of the step.
 */
export function stepResources(
	state: Pick<SimulationState, 'habitat' | 'environment' | 'seed' | 'creatures'>,
	timeSeconds: number,
	dt: number,
	config: ResourcesStepConfig
): ResourcesStepResult {
	const weatherConfig = {
		rainIntervalMinSeconds: config.rainIntervalMinSeconds,
		rainIntervalMaxSeconds: config.rainIntervalMaxSeconds,
		rainDurationSeconds: config.rainDurationSeconds
	};

	const afterWeather = advanceWeather({
		habitat: state.habitat,
		environment: state.environment,
		timeSeconds,
		simulationSeed: state.seed,
		config: weatherConfig
	});

	const afterSpawn = advanceFoodSpawn({
		habitat: afterWeather.habitat,
		environment: afterWeather.environment,
		timeSeconds,
		simulationSeed: state.seed,
		config: {
			maxActiveFoodSources: config.maxActiveFoodSources,
			foodSpawnIntervalSeconds: config.foodSpawnIntervalSeconds,
			foodCapacity: config.habitat.foodCapacity,
			foodSize: config.habitat.foodSize,
			minSpacing: config.habitat.minSpacing,
			maxPlacementAttempts: config.habitat.maxPlacementAttempts
		}
	});

	const afterConsumption = resolveConsumption({
		habitat: afterSpawn.habitat,
		creatures: state.creatures as readonly Creature[],
		dt,
		rates: {
			eatRecoveryPerSecond: config.eatRecoveryPerSecond,
			drinkRecoveryPerSecond: config.drinkRecoveryPerSecond
		}
	});

	return {
		habitat: afterConsumption.habitat,
		environment: afterSpawn.environment,
		grantsByCreatureId: afterConsumption.grantsByCreatureId
	};
}
