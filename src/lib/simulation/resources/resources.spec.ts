import { describe, expect, it } from 'vitest';
import { generateHabitat, defaultHabitatConfig } from '$lib/habitat';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import type { Creature } from '../types';
import { isResourceAvailable } from './availability';
import { resolveConsumption } from './consumption';
import { advanceFoodSpawn } from './food-spawn';
import { createInitialEnvironment, advanceWeather } from './weather';
import { emptyGrant } from './types';

function baseCreature(overrides: Partial<Creature> & Pick<Creature, 'id'>): Creature {
	const state = createSimulation(defaultSimulationConfig('creature-fixture'));
	const template = state.creatures[0]!;
	return {
		...template,
		...overrides,
		id: overrides.id,
		perception: overrides.perception ?? {
			...template.perception,
			observations: [],
			perceivedFoodIds: [],
			perceivedWaterIds: [],
			tracked: null,
			activeEpisodes: []
		}
	};
}

describe('isResourceAvailable', () => {
	it('is true only when amount > 0 for food/water', () => {
		const habitat = generateHabitat(defaultHabitatConfig('avail'));
		const food = habitat.food[0]!;
		expect(isResourceAvailable(food)).toBe(true);
		expect(isResourceAvailable({ ...food, amount: 0 })).toBe(false);
		expect(isResourceAvailable(habitat.home)).toBe(false);
		expect(isResourceAvailable(null)).toBe(false);
	});
});

describe('resolveConsumption', () => {
	it('withdraws food and bounds grants; removes depleted food', () => {
		const habitat = generateHabitat(defaultHabitatConfig('consume-food'));
		const food = { ...habitat.food[0]!, amount: 0.1, capacity: 1 };
		const habitatWithOne = {
			...habitat,
			food: [food],
			water: habitat.water.map((w) => ({ ...w }))
		};
		const eater = baseCreature({
			id: 'creature-a',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
		});
		const result = resolveConsumption({
			habitat: habitatWithOne,
			creatures: [eater],
			dt: 1,
			rates: { eatRecoveryPerSecond: 0.25, drinkRecoveryPerSecond: 0.28 }
		});
		expect(result.grantsByCreatureId.get('creature-a')?.food).toBeCloseTo(0.1, 10);
		expect(result.habitat.food.find((f) => f.id === food.id)).toBeUndefined();
	});

	it('allocates shared food deterministically by creature id order', () => {
		const habitat = generateHabitat(defaultHabitatConfig('shared-food'));
		const food = { ...habitat.food[0]!, amount: 0.15, capacity: 1 };
		const habitatWithOne = {
			...habitat,
			food: [food],
			water: habitat.water.map((w) => ({ ...w }))
		};
		const late = baseCreature({
			id: 'creature-z',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
		});
		const early = baseCreature({
			id: 'creature-a',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
		});
		const result = resolveConsumption({
			habitat: habitatWithOne,
			creatures: [late, early],
			dt: 1,
			rates: { eatRecoveryPerSecond: 0.1, drinkRecoveryPerSecond: 0.28 }
		});
		// creature-a first: 0.1, creature-z gets remaining 0.05
		expect(result.grantsByCreatureId.get('creature-a')?.food).toBeCloseTo(0.1, 10);
		expect(result.grantsByCreatureId.get('creature-z')?.food).toBeCloseTo(0.05, 10);
		const total =
			(result.grantsByCreatureId.get('creature-a')?.food ?? 0) +
			(result.grantsByCreatureId.get('creature-z')?.food ?? 0);
		expect(total).toBeCloseTo(0.15, 10);
		expect(result.habitat.food.find((f) => f.id === food.id)).toBeUndefined();
	});

	it('drains water but keeps empty basins', () => {
		const habitat = generateHabitat(defaultHabitatConfig('consume-water'));
		const water = { ...habitat.water[0]!, amount: 0.05, capacity: 10 };
		const habitatWithWater = {
			...habitat,
			food: habitat.food.map((f) => ({ ...f })),
			water: [water, ...habitat.water.slice(1).map((w) => ({ ...w }))]
		};
		const drinker = baseCreature({
			id: 'creature-0',
			action: 'drink',
			target: { kind: 'feature', featureId: water.id, featureKind: 'water' }
		});
		const result = resolveConsumption({
			habitat: habitatWithWater,
			creatures: [drinker],
			dt: 1,
			rates: { eatRecoveryPerSecond: 0.25, drinkRecoveryPerSecond: 0.28 }
		});
		expect(result.grantsByCreatureId.get('creature-0')?.water).toBeCloseTo(0.05, 10);
		const basin = result.habitat.water.find((w) => w.id === water.id);
		expect(basin).toBeDefined();
		expect(basin!.amount).toBe(0);
		expect(isResourceAvailable(basin!)).toBe(false);
	});

	it('is deterministic for identical inputs', () => {
		const habitat = generateHabitat(defaultHabitatConfig('det-consume'));
		const food = habitat.food[0]!;
		const creatures = [
			baseCreature({
				id: 'creature-1',
				action: 'eat',
				target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
			}),
			baseCreature({
				id: 'creature-0',
				action: 'eat',
				target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
			})
		];
		const input = {
			habitat,
			creatures,
			dt: 1 / 30,
			rates: { eatRecoveryPerSecond: 0.25, drinkRecoveryPerSecond: 0.28 }
		};
		const a = resolveConsumption(input);
		const b = resolveConsumption(input);
		expect(a.habitat.food.map((f) => f.amount)).toEqual(b.habitat.food.map((f) => f.amount));
		expect(a.grantsByCreatureId.get('creature-0')).toEqual(b.grantsByCreatureId.get('creature-0'));
	});
});

describe('advanceWeather', () => {
	it('starts rain, refills basins, then returns to clear on the same schedule twice', () => {
		const config = {
			rainIntervalMinSeconds: 10,
			rainIntervalMaxSeconds: 10,
			rainDurationSeconds: 2
		};
		const seed = 'rain-seed';
		const habitat = generateHabitat({ ...defaultHabitatConfig(seed) });
		const drained = {
			...habitat,
			water: habitat.water.map((w) => ({ ...w, amount: 0 }))
		};
		const env = createInitialEnvironment(seed, { ...config, foodSpawnIntervalSeconds: 100 });
		expect(env.weather).toBe('clear');
		expect(env.nextRainAt).toBe(10);

		const raining = advanceWeather({
			habitat: drained,
			environment: env,
			timeSeconds: 10,
			simulationSeed: seed,
			config
		});
		expect(raining.environment.weather).toBe('rain');
		for (const basin of raining.habitat.water) {
			expect(basin.amount).toBe(basin.capacity);
		}

		const cleared = advanceWeather({
			habitat: raining.habitat,
			environment: raining.environment,
			timeSeconds: 12,
			simulationSeed: seed,
			config
		});
		expect(cleared.environment.weather).toBe('clear');
		expect(cleared.environment.nextRainAt).toBe(12 + 10);

		// Replay from start is identical
		const env2 = createInitialEnvironment(seed, { ...config, foodSpawnIntervalSeconds: 100 });
		const raining2 = advanceWeather({
			habitat: drained,
			environment: env2,
			timeSeconds: 10,
			simulationSeed: seed,
			config
		});
		expect(raining2.environment).toEqual(raining.environment);
		expect(raining2.habitat.water.map((w) => w.amount)).toEqual(
			raining.habitat.water.map((w) => w.amount)
		);
	});
});

describe('advanceFoodSpawn', () => {
	it('spawns a new food feature with a new id when under cap', () => {
		const seed = 'spawn-seed';
		const habitat = generateHabitat(defaultHabitatConfig(seed));
		const reduced = {
			...habitat,
			food: habitat.food.slice(0, 1).map((f) => ({ ...f }))
		};
		const env = {
			...createInitialEnvironment(seed, {
				rainIntervalMinSeconds: 100,
				rainIntervalMaxSeconds: 100,
				rainDurationSeconds: 2,
				foodSpawnIntervalSeconds: 5
			}),
			nextFoodSpawnAt: 5
		};
		const result = advanceFoodSpawn({
			habitat: reduced,
			environment: env,
			timeSeconds: 5,
			simulationSeed: seed,
			config: {
				maxActiveFoodSources: 5,
				foodSpawnIntervalSeconds: 5,
				foodCapacity: habitat.food[0]!.capacity,
				foodSize: defaultHabitatConfig(seed).foodSize,
				minSpacing: defaultHabitatConfig(seed).minSpacing,
				maxPlacementAttempts: defaultHabitatConfig(seed).maxPlacementAttempts
			}
		});
		expect(result.environment.lastFoodSpawnOutcome).toBe('spawned');
		expect(result.habitat.food.length).toBe(2);
		expect(result.habitat.food.some((f) => f.id.startsWith('food-runtime-'))).toBe(true);
		expect(result.habitat.food.every((f) => f.amount === f.capacity)).toBe(true);
	});

	it('skips when at cap and still advances the schedule', () => {
		const seed = 'spawn-cap';
		const habitat = generateHabitat(defaultHabitatConfig(seed));
		const env = {
			...createInitialEnvironment(seed, {
				rainIntervalMinSeconds: 100,
				rainIntervalMaxSeconds: 100,
				rainDurationSeconds: 2,
				foodSpawnIntervalSeconds: 5
			}),
			nextFoodSpawnAt: 5
		};
		const result = advanceFoodSpawn({
			habitat,
			environment: env,
			timeSeconds: 5,
			simulationSeed: seed,
			config: {
				maxActiveFoodSources: habitat.food.length,
				foodSpawnIntervalSeconds: 5,
				foodCapacity: 1.5,
				foodSize: defaultHabitatConfig(seed).foodSize,
				minSpacing: defaultHabitatConfig(seed).minSpacing,
				maxPlacementAttempts: defaultHabitatConfig(seed).maxPlacementAttempts
			}
		});
		expect(result.environment.lastFoodSpawnOutcome).toBe('skipped_at_cap');
		expect(result.habitat.food.length).toBe(habitat.food.length);
		expect(result.environment.nextFoodSpawnAt).toBe(10);
	});
});

describe('stepSimulation resource integration', () => {
	it('reproduces identical resource timelines for the same seed', () => {
		const config = defaultSimulationConfig('timeline-seed');
		// Faster events for short test
		const fast = {
			...config,
			foodSpawnIntervalSeconds: 2,
			rainIntervalMinSeconds: 3,
			rainIntervalMaxSeconds: 3,
			rainDurationSeconds: 1,
			maxActiveFoodSources: 6
		};
		let a = createSimulation(fast);
		let b = createSimulation(fast);
		for (let i = 0; i < 200; i += 1) {
			a = stepSimulation(a, fast);
			b = stepSimulation(b, fast);
		}
		expect(a.habitat.food.map((f) => ({ id: f.id, amount: f.amount }))).toEqual(
			b.habitat.food.map((f) => ({ id: f.id, amount: f.amount }))
		);
		expect(a.habitat.water.map((w) => ({ id: w.id, amount: w.amount }))).toEqual(
			b.habitat.water.map((w) => ({ id: w.id, amount: w.amount }))
		);
		expect(a.environment).toEqual(b.environment);
	});

	it('initial food and water are at full capacity', () => {
		const state = createSimulation(defaultSimulationConfig('full-cap'));
		for (const f of state.habitat.food) {
			expect(f.amount).toBe(f.capacity);
			expect(f.capacity).toBe(defaultSimulationConfig('full-cap').habitat.foodCapacity);
		}
		for (const w of state.habitat.water) {
			expect(w.amount).toBe(w.capacity);
			expect(w.capacity).toBe(defaultSimulationConfig('full-cap').habitat.waterCapacity);
		}
		expect(state.environment.weather).toBe('clear');
		expect(emptyGrant()).toEqual({ food: 0, water: 0 });
	});
});
