/**
 * Deterministic runtime food spawning at valid positions.
 * Time-driven and capped — never hunger-driven rescue.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Habitat, ResourceFeature, SizeRange } from '$lib/habitat';
import { tryPlaceFeature } from '$lib/habitat';
import type { EnvironmentState, FoodSpawnOutcome } from './types';

export type FoodSpawnConfig = {
	maxActiveFoodSources: number;
	foodSpawnIntervalSeconds: number;
	foodCapacity: number;
	foodSize: SizeRange;
	minSpacing: number;
	maxPlacementAttempts: number;
};

/**
 * When nextFoodSpawnAt is reached, attempt one spawn if under cap.
 * Advances nextFoodSpawnAt by interval regardless of success (bounded skip).
 */
export function advanceFoodSpawn(input: {
	habitat: Habitat;
	environment: EnvironmentState;
	timeSeconds: number;
	simulationSeed: string;
	config: FoodSpawnConfig;
}): { habitat: Habitat; environment: EnvironmentState } {
	const env = input.environment;
	if (input.timeSeconds < env.nextFoodSpawnAt) {
		return { habitat: input.habitat, environment: env };
	}

	const eventIndex = env.foodSpawnEventIndex;
	const nextFoodSpawnAt = input.timeSeconds + input.config.foodSpawnIntervalSeconds;
	let outcome: FoodSpawnOutcome = 'skipped_at_cap';
	let food = input.habitat.food;
	let nextFoodSerial = env.nextFoodSerial;

	if (food.length < input.config.maxActiveFoodSources) {
		const rng = createSeededRng(deriveSeed(input.simulationSeed, 'food-spawn', eventIndex));
		const placed = [input.habitat.home, ...input.habitat.water, ...food];
		const placement = tryPlaceFeature({
			sizeRange: input.config.foodSize,
			bounds: input.habitat.bounds,
			minSpacing: input.config.minSpacing,
			maxPlacementAttempts: input.config.maxPlacementAttempts,
			placed,
			rng
		});

		if (placement.ok) {
			const id = `food-runtime-${nextFoodSerial}`;
			nextFoodSerial += 1;
			const capacity = input.config.foodCapacity;
			const feature: ResourceFeature = {
				id,
				kind: 'food',
				position: placement.position,
				size: placement.size,
				amount: capacity,
				capacity
			};
			food = [...food, feature].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
			outcome = 'spawned';
		} else {
			outcome = 'placement_failed';
		}
	}

	return {
		habitat: food === input.habitat.food ? input.habitat : { ...input.habitat, food },
		environment: {
			...env,
			nextFoodSpawnAt,
			foodSpawnEventIndex: eventIndex + 1,
			nextFoodSerial,
			lastFoodSpawnOutcome: outcome,
			lastFoodSpawnAt: input.timeSeconds
		}
	};
}
