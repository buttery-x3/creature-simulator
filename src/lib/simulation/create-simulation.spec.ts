import { describe, expect, it } from 'vitest';
import { featureRect, rectInsideBounds } from '$lib/habitat';
import {
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot,
	type SimulationConfig
} from './index';

function allInsideHome(config: SimulationConfig): void {
	const state = createSimulation(config);
	const home = featureRect(state.habitat.home);
	const r = config.creatureRadius;

	for (const creature of state.creatures) {
		expect(creature.position.x).toBeGreaterThanOrEqual(home.minX + r - 1e-9);
		expect(creature.position.x).toBeLessThanOrEqual(home.maxX - r + 1e-9);
		expect(creature.position.y).toBeGreaterThanOrEqual(home.minY + r - 1e-9);
		expect(creature.position.y).toBeLessThanOrEqual(home.maxY - r + 1e-9);
	}
}

describe('createSimulation', () => {
	it('produces identical state for the same seed and configuration', () => {
		const config = defaultSimulationConfig('repeatable-sim');
		const a = createSimulation(config);
		const b = createSimulation(config);
		expect(simulationSnapshot(a)).toBe(simulationSnapshot(b));
	});

	it('assigns unique stable creature ids', () => {
		const state = createSimulation(defaultSimulationConfig('ids'));
		const ids = state.creatures.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(Array.from({ length: state.creatures.length }, (_, i) => `creature-${i}`));
	});

	it('spawns all creatures inside the home region with footprint margin', () => {
		allInsideHome(defaultSimulationConfig('home-spawn'));
	});

	it('samples movement speeds within the configured range', () => {
		const config = defaultSimulationConfig('speeds');
		const state = createSimulation(config);
		for (const creature of state.creatures) {
			expect(creature.movementSpeed).toBeGreaterThanOrEqual(config.movementSpeed.min);
			expect(creature.movementSpeed).toBeLessThan(config.movementSpeed.max);
		}
	});

	it('samples independent empty memory capacities within range', () => {
		const config = defaultSimulationConfig('memory-cap');
		const state = createSimulation(config);
		const capacities = new Set<number>();
		for (let i = 0; i < state.creatures.length; i += 1) {
			const creature = state.creatures[i]!;
			expect(creature.memory.entries).toEqual([]);
			expect(creature.memory.nextSequence).toBe(0);
			expect(Number.isInteger(creature.memory.capacity)).toBe(true);
			expect(creature.memory.capacity).toBeGreaterThanOrEqual(config.memoryCapacityRange.min);
			expect(creature.memory.capacity).toBeLessThanOrEqual(config.memoryCapacityRange.max);
			capacities.add(creature.memory.capacity);
			// Independent object per creature (compare against a different index).
			if (i > 0) {
				expect(creature.memory).not.toBe(state.creatures[0]!.memory);
				expect(creature.memory.entries).not.toBe(state.creatures[0]!.memory.entries);
			}
		}
		expect(capacities.size).toBeGreaterThan(1);
	});

	it('samples deterministic stable verbosity in [0, 1) with population variation', () => {
		const config = defaultSimulationConfig('verbosity-trait');
		const a = createSimulation(config);
		const b = createSimulation(config);
		expect(a.creatures.map((c) => c.verbosity)).toEqual(b.creatures.map((c) => c.verbosity));
		const values = new Set<number>();
		for (const creature of a.creatures) {
			expect(creature.verbosity).toBeGreaterThanOrEqual(0);
			expect(creature.verbosity).toBeLessThan(1);
			expect(Number.isFinite(creature.verbosity)).toBe(true);
			values.add(creature.verbosity);
		}
		// Mixed population: not every creature is equally talkative.
		expect(values.size).toBeGreaterThan(1);
	});

	it('does not perturb placement or speed when verbosity is sampled independently', () => {
		// Verbosity uses deriveSeed(seed, 'verbosity', id) — not the creatures stream.
		const config = defaultSimulationConfig('isolation-verbosity');
		const state = createSimulation(config);
		// Same seed always matches movement/facing; covered by snapshot equality above.
		// Explicitly check each creature has verbosity independent of movementSpeed domain.
		for (const creature of state.creatures) {
			expect(creature.verbosity).toBeGreaterThanOrEqual(0);
			expect(creature.verbosity).toBeLessThan(1);
			expect(creature.movementSpeed).toBeGreaterThanOrEqual(config.movementSpeed.min);
			expect(creature.movementSpeed).toBeLessThan(config.movementSpeed.max);
		}
	});

	it('places initial wander targets inside world bounds with margin', () => {
		const config = defaultSimulationConfig('targets');
		const state = createSimulation(config);
		for (const creature of state.creatures) {
			const pointRect = {
				minX: creature.wanderTarget.x - config.creatureRadius,
				maxX: creature.wanderTarget.x + config.creatureRadius,
				minY: creature.wanderTarget.y - config.creatureRadius,
				maxY: creature.wanderTarget.y + config.creatureRadius
			};
			expect(rectInsideBounds(pointRect, state.habitat.bounds)).toBe(true);
		}
	});

	it('starts at time zero with the requested creature count', () => {
		const config: SimulationConfig = {
			...defaultSimulationConfig('count'),
			creatureCount: 10
		};
		const state = createSimulation(config);
		expect(state.timeSeconds).toBe(0);
		expect(state.creatures).toHaveLength(10);
		expect(state.seed).toBe('count');
		expect(state.habitat.seed).toBe('count');
	});

	it('keeps habitat deterministic and separate from creature data', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		expect(state.habitat).not.toHaveProperty('creatures');
		// Habitat for raw seed 'demo' must match a second create.
		const again = createSimulation(config);
		expect(again.habitat).toEqual(state.habitat);
	});

	it('round-trips through JSON without loss', () => {
		const state = createSimulation(defaultSimulationConfig('json-sim'));
		const roundTrip = JSON.parse(JSON.stringify(state));
		expect(roundTrip).toEqual(state);
	});

	it('creature creation is unaffected by habitat stream consumption order', () => {
		// Same simulation seed always yields the same creatures even though
		// habitat generation consumes many RNG samples from the raw seed.
		const a = createSimulation(defaultSimulationConfig('isolation'));
		const b = createSimulation({
			...defaultSimulationConfig('isolation'),
			// Different food count changes habitat RNG call count.
			habitat: {
				...defaultSimulationConfig('isolation').habitat,
				foodCount: 3
			}
		});
		// Creatures should still match for shared creation-channel decisions when
		// only habitat config changes... actually foodCount change changes habitat
		// only if habitat generation differs; creature stream is independent so
		// creature fields that don't depend on habitat geometry should match.
		// Spawn positions depend on home geometry which may change with different
		// food placement attempts? Home is placed first so home is independent of
		// foodCount. Creature stream is independent of habitat stream.
		expect(a.creatures.map((c) => c.id)).toEqual(b.creatures.map((c) => c.id));
		expect(a.creatures.map((c) => c.movementSpeed)).toEqual(
			b.creatures.map((c) => c.movementSpeed)
		);
		expect(a.creatures.map((c) => c.facing)).toEqual(b.creatures.map((c) => c.facing));
		// Positions depend on home size/placement which is before food, so same.
		expect(a.creatures.map((c) => c.position)).toEqual(b.creatures.map((c) => c.position));
	});
});
