import { describe, expect, it } from 'vitest';
import {
	advanceSimulation,
	clampToInterior,
	createSimulation,
	defaultSimulationConfig,
	distanceSquared,
	normalizeAngle,
	sampleWanderTarget,
	shortestAngleDelta,
	simulationSnapshot,
	stepCreature,
	stepSimulation,
	type SimulationConfig
} from './index';
import { testCreature } from './test-creature';

function longRunConfig(seed: string): SimulationConfig {
	return defaultSimulationConfig(seed);
}

describe('stepSimulation', () => {
	it('is deterministic across identical step sequences', () => {
		const config = defaultSimulationConfig('step-det');
		let a = createSimulation(config);
		let b = createSimulation(config);
		for (let i = 0; i < 90; i += 1) {
			a = stepSimulation(a, config);
			b = stepSimulation(b, config);
		}
		expect(simulationSnapshot(a)).toBe(simulationSnapshot(b));
		expect(a.timeSeconds).toBeCloseTo(90 * config.fixedDt, 10);
	});

	it('keeps creatures inside world bounds over a long run', () => {
		const config = longRunConfig('long-bounds');
		let state = createSimulation(config);
		for (let i = 0; i < 1800; i += 1) {
			state = stepSimulation(state, config);
		}
		for (const creature of state.creatures) {
			const clamped = clampToInterior(
				creature.position,
				state.habitat.bounds,
				config.creatureRadius
			);
			expect(creature.position.x).toBeCloseTo(clamped.x, 9);
			expect(creature.position.y).toBeCloseTo(clamped.y, 9);
			expect(Number.isFinite(creature.facing)).toBe(true);
			expect(Number.isFinite(creature.position.x)).toBe(true);
			expect(Number.isFinite(creature.position.y)).toBe(true);
		}
	});

	it('does not exceed max turn rate in a single step', () => {
		const config = defaultSimulationConfig('turn-rate');
		const creature = testCreature({
			position: { x: 0, y: 0 },
			facing: 0,
			movementSpeed: 1,
			wanderTarget: { x: 0, y: 5 }
		});
		const next = stepCreature(
			creature,
			config.fixedDt,
			'turn-rate',
			{ width: 20, height: 14 },
			config
		);
		const delta = Math.abs(shortestAngleDelta(creature.facing, next.facing));
		expect(delta).toBeLessThanOrEqual(config.maxTurnRate * config.fixedDt + 1e-9);
	});

	it('turns gradually toward the target rather than snapping facing', () => {
		const config = {
			...defaultSimulationConfig('gradual'),
			maxTurnRate: 0.5
		};
		const creature = testCreature({
			position: { x: 0, y: 0 },
			facing: 0,
			movementSpeed: 0.01,
			wanderTarget: { x: 0, y: 4 }
		});
		const next = stepCreature(
			creature,
			config.fixedDt,
			'gradual',
			{ width: 20, height: 14 },
			config
		);
		const desired = Math.atan2(4, 0);
		expect(Math.abs(shortestAngleDelta(next.facing, desired))).toBeGreaterThan(0.1);
		expect(next.facing).not.toBeCloseTo(desired, 3);
	});

	it('chooses the expected next deterministic target after arrival', () => {
		const config = {
			...defaultSimulationConfig('retarget'),
			arrivalDistance: 0.5,
			creatureRadius: 0.25
		};
		const bounds = { width: 20, height: 14 };
		const startTarget = sampleWanderTarget(
			'retarget',
			'creature-0',
			0,
			bounds,
			config.creatureRadius
		);
		const creature = testCreature({
			position: { ...startTarget },
			facing: 0,
			movementSpeed: 0.01,
			wanderTarget: { ...startTarget },
			wanderDecisionIndex: 0
		});

		const next = stepCreature(creature, config.fixedDt, 'retarget', bounds, config);
		expect(next.wanderDecisionIndex).toBe(1);
		const expected = sampleWanderTarget('retarget', 'creature-0', 1, bounds, config.creatureRadius);
		expect(next.wanderTarget).toEqual(expected);
	});

	it('advances time by fixedDt each step', () => {
		const config = defaultSimulationConfig('time');
		let state = createSimulation(config);
		state = stepSimulation(state, config);
		expect(state.timeSeconds).toBeCloseTo(config.fixedDt, 12);
	});
});

describe('advanceSimulation', () => {
	it('applies multiple fixed steps from elapsed wall time', () => {
		const config = defaultSimulationConfig('catchup');
		const state = createSimulation(config);
		const result = advanceSimulation(state, config.fixedDt * 3, 0, config);
		expect(result.stepsTaken).toBe(3);
		expect(result.state.timeSeconds).toBeCloseTo(config.fixedDt * 3, 10);
		expect(result.accumulator).toBeLessThan(config.fixedDt);
	});

	it('respects maxCatchUpSteps', () => {
		const config = {
			...defaultSimulationConfig('cap'),
			maxCatchUpSteps: 2
		};
		const state = createSimulation(config);
		const result = advanceSimulation(state, config.fixedDt * 20, 0, config);
		expect(result.stepsTaken).toBe(2);
		expect(result.state.timeSeconds).toBeCloseTo(config.fixedDt * 2, 10);
	});
});

describe('angle helpers', () => {
	it('shortestAngleDelta wraps correctly', () => {
		// From 3 rad to -3 rad the short way is ≈ +0.283 (2π − 6), not −6.
		expect(shortestAngleDelta(3, -3)).toBeCloseTo(Math.PI * 2 - 6, 10);
		expect(Math.abs(shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1))).toBeLessThan(0.3);
	});

	it('normalizeAngle keeps values in (-π, π]', () => {
		expect(normalizeAngle(0)).toBe(0);
		expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10);
	});
});

describe('distanceSquared', () => {
	it('matches Euclidean distance squared', () => {
		expect(distanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
	});
});
