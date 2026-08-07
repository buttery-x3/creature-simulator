/**
 * Minimal deterministic rain schedule and basin refill.
 * clear → rain (refill all basins to capacity) → clear.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Habitat, ResourceFeature } from '$lib/habitat';
import type { EnvironmentState } from './types';

export type WeatherConfig = {
	rainIntervalMinSeconds: number;
	rainIntervalMaxSeconds: number;
	rainDurationSeconds: number;
};

function sampleRainInterval(
	simulationSeed: string,
	rainEventIndex: number,
	config: WeatherConfig
): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, 'rain-schedule', rainEventIndex));
	return rng.nextRange(config.rainIntervalMinSeconds, config.rainIntervalMaxSeconds);
}

/** Initial clear weather with first rain scheduled from event index 0. */
export function createInitialEnvironment(
	simulationSeed: string,
	config: WeatherConfig & { foodSpawnIntervalSeconds: number }
): EnvironmentState {
	const firstRainDelay = sampleRainInterval(simulationSeed, 0, config);
	return {
		weather: 'clear',
		weatherPhaseEndsAt: 0,
		nextRainAt: firstRainDelay,
		rainEventIndex: 0,
		nextFoodSpawnAt: config.foodSpawnIntervalSeconds,
		foodSpawnEventIndex: 0,
		nextFoodSerial: 0,
		lastFoodSpawnOutcome: null,
		lastFoodSpawnAt: null
	};
}

function refillBasins(water: readonly ResourceFeature[]): ResourceFeature[] {
	return water.map((basin) => ({
		...basin,
		position: { ...basin.position },
		size: { ...basin.size },
		amount: basin.capacity
	}));
}

/**
 * Advance weather to `timeSeconds`. On rain start, refill all water basins.
 * Returns updated habitat water (may be same reference if no refill) and environment.
 */
export function advanceWeather(input: {
	habitat: Habitat;
	environment: EnvironmentState;
	timeSeconds: number;
	simulationSeed: string;
	config: WeatherConfig;
}): { habitat: Habitat; environment: EnvironmentState } {
	let { weather, weatherPhaseEndsAt, nextRainAt, rainEventIndex } = input.environment;
	let water = input.habitat.water;
	let changed = false;

	// Rain end
	if (weather === 'rain' && input.timeSeconds >= weatherPhaseEndsAt) {
		weather = 'clear';
		// Schedule next rain from current event index + 1.
		rainEventIndex += 1;
		const interval = sampleRainInterval(input.simulationSeed, rainEventIndex, input.config);
		nextRainAt = input.timeSeconds + interval;
		changed = true;
	}

	// Rain start (only while clear)
	if (weather === 'clear' && input.timeSeconds >= nextRainAt) {
		weather = 'rain';
		weatherPhaseEndsAt = input.timeSeconds + input.config.rainDurationSeconds;
		water = refillBasins(water);
		changed = true;
	}

	if (!changed) {
		return { habitat: input.habitat, environment: input.environment };
	}

	return {
		habitat: water === input.habitat.water ? input.habitat : { ...input.habitat, water },
		environment: {
			...input.environment,
			weather,
			weatherPhaseEndsAt,
			nextRainAt,
			rainEventIndex
		}
	};
}
