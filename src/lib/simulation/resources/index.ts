/**
 * Runtime resource lifecycle and minimal rain weather.
 * Not creature cognition — world state only.
 */

export { filterAvailableResources, isResourceAvailable } from './availability';

export { resolveConsumption, type ConsumptionRates } from './consumption';

export { advanceFoodSpawn, type FoodSpawnConfig } from './food-spawn';

export { createInitialEnvironment, advanceWeather, type WeatherConfig } from './weather';

export {
	stepResources,
	type ResourcesStepConfig,
	type ResourcesStepResult
} from './step-resources';

export {
	emptyGrant,
	type ConsumptionGrant,
	type EnvironmentState,
	type FoodSpawnOutcome,
	type WeatherPhase
} from './types';
