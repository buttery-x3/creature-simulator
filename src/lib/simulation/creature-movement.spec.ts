import { describe, expect, it } from 'vitest';
import type { WorldBounds } from '$lib/habitat';
import { DEFAULT_SIMULATION_CONFIG } from './create-simulation';
import { distanceSquared, moveToward, shortestAngleDelta } from './creature-movement';
import { stepCreatureBehaviour } from './behaviour/step-creature-behaviour';
import { createSimulation, defaultSimulationConfig } from './create-simulation';
import { testCreature } from './test-creature';
import { beginInvestigation } from './learning/signal-investigation';

const bounds: WorldBounds = { width: 20, height: 20 };

const defaultMoveConfig = {
	maxTurnRate: DEFAULT_SIMULATION_CONFIG.maxTurnRate,
	creatureRadius: DEFAULT_SIMULATION_CONFIG.creatureRadius
};

const dt = DEFAULT_SIMULATION_CONFIG.fixedDt;
const arrivalDistance = DEFAULT_SIMULATION_CONFIG.arrivalDistance;

function runUntilArrived(input: {
	position: { x: number; y: number };
	facing: number;
	movementSpeed: number;
	destination: { x: number; y: number };
	maxSteps: number;
	maxTurnRate?: number;
}): { arrived: boolean; steps: number; position: { x: number; y: number }; facing: number } {
	let position = { ...input.position };
	let facing = input.facing;
	const arrivalSq = arrivalDistance * arrivalDistance;
	const config = {
		...defaultMoveConfig,
		maxTurnRate: input.maxTurnRate ?? defaultMoveConfig.maxTurnRate
	};

	for (let step = 0; step < input.maxSteps; step += 1) {
		if (distanceSquared(position, input.destination) <= arrivalSq) {
			return { arrived: true, steps: step, position, facing };
		}
		const moved = moveToward(
			{ position, facing, movementSpeed: input.movementSpeed },
			input.destination,
			dt,
			bounds,
			config
		);
		position = moved.position;
		facing = moved.facing;
	}
	return {
		arrived: distanceSquared(position, input.destination) <= arrivalSq,
		steps: input.maxSteps,
		position,
		facing
	};
}

describe('moveToward liveness', () => {
	it('converges when nearby target is sharply off-heading at max default speed', () => {
		// Hostile geometry similar to the investigation orbit bug:
		// close target (~0.37), heading ~180° off, speed 1.35, turn π, arrival 0.35.
		const position = { x: 0, y: 0 };
		const destination = { x: 0.37, y: 0 };
		const facing = Math.PI; // facing away from +x target
		const result = runUntilArrived({
			position,
			facing,
			movementSpeed: 1.35,
			destination,
			maxSteps: 300
		});
		expect(result.arrived).toBe(true);
		expect(result.steps).toBeLessThan(300);
		expect(Math.sqrt(distanceSquared(result.position, destination))).toBeLessThanOrEqual(
			arrivalDistance + 1e-9
		);
	});

	it('converges for ~90° off-heading nearby targets', () => {
		const position = { x: -5.98, y: 3.88 };
		const destination = { x: -6.072, y: 3.523 };
		const desired = Math.atan2(destination.y - position.y, destination.x - position.x);
		const facing = desired + Math.PI / 2;
		const result = runUntilArrived({
			position,
			facing,
			movementSpeed: 1.35,
			destination,
			maxSteps: 300
		});
		expect(result.arrived).toBe(true);
	});

	it('still progresses on long-distance aligned travel', () => {
		const position = { x: 0, y: 0 };
		const destination = { x: 8, y: 0 };
		const facing = 0;
		let pos = { ...position };
		let face = facing;
		const dist0 = Math.hypot(destination.x - pos.x, destination.y - pos.y);
		for (let i = 0; i < 10; i += 1) {
			const moved = moveToward(
				{ position: pos, facing: face, movementSpeed: 1.35 },
				destination,
				dt,
				bounds,
				defaultMoveConfig
			);
			pos = moved.position;
			face = moved.facing;
		}
		const dist10 = Math.hypot(destination.x - pos.x, destination.y - pos.y);
		expect(dist10).toBeLessThan(dist0 - 0.3);

		const result = runUntilArrived({
			position,
			facing,
			movementSpeed: 1.35,
			destination,
			maxSteps: 600
		});
		expect(result.arrived).toBe(true);
	});

	it('is deterministic for identical inputs', () => {
		const seedState = {
			position: { x: 1.2, y: -0.8 },
			facing: 1.1,
			movementSpeed: 1.35,
			destination: { x: 1.5, y: -0.5 }
		};
		const a = runUntilArrived({ ...seedState, maxSteps: 120 });
		const b = runUntilArrived({ ...seedState, maxSteps: 120 });
		expect(a).toEqual(b);
	});

	it('reduces forward motion while residual heading error is large', () => {
		const position = { x: 0, y: 0 };
		const destination = { x: 1, y: 0 };
		// Facing nearly opposite; after one limited turn residual still large.
		const facing = Math.PI * 0.95;
		const before = moveToward(
			{ position, facing, movementSpeed: 1.35 },
			destination,
			dt,
			bounds,
			defaultMoveConfig
		);
		const stepLen = Math.hypot(before.position.x - position.x, before.position.y - position.y);
		const fullStep = 1.35 * dt;
		expect(stepLen).toBeLessThan(fullStep * 0.5);
	});
});

describe('investigation travel uses live moveToward', () => {
	it('eventually reaches investigate action for a nearby off-heading origin', () => {
		const config = {
			...defaultSimulationConfig('invest-arrive'),
			fixedDt: 1 / 30,
			maxTurnRate: Math.PI,
			arrivalDistance: 0.35,
			creatureCount: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			initialHunger: 0,
			initialThirst: 0,
			initialEnergy: 1
		};
		const base = createSimulation(config);
		const origin = { x: 0.37, y: 0 };
		const opportunity = {
			emissionId: 'em-test-0',
			symbolId: 'glyph-0' as const,
			senderId: 'creature-1',
			origin: { ...origin },
			heardAt: 0,
			expiresAt: 999,
			curiosityDecision: 'accepted' as const,
			curiosityEvidence: { curiosity: 1, deterministicSample: 0 }
		};
		const creature = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			facing: Math.PI,
			movementSpeed: 1.35,
			goal: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: { ...origin } },
			goalStartedAt: 0,
			actionStartedAt: 0,
			nextReconsiderAt: 999,
			activeInvestigation: beginInvestigation(opportunity, 0),
			pendingSignals: [],
			hunger: 0,
			thirst: 0,
			energy: 1
		});

		let next = creature;
		let time = 0;
		let resolved = false;
		for (let i = 0; i < 400; i += 1) {
			time += config.fixedDt;
			const result = stepCreatureBehaviour(
				next,
				config.fixedDt,
				time,
				config.seed,
				base.habitat,
				config
			);
			next = result.creature;
			if (next.action === 'investigate' || next.goal !== 'investigate_signal') {
				resolved = true;
				break;
			}
			// Still committed and moving — distance should not be stuck forever.
			expect(next.action).toBe('move');
		}
		expect(resolved).toBe(true);
		// Either finished investigation replan or at least entered investigate action.
		expect(
			next.action === 'investigate' ||
				next.goal !== 'investigate_signal' ||
				next.activeInvestigation === null
		).toBe(true);
	});
});

describe('shortestAngleDelta', () => {
	it('returns values in (-π, π]', () => {
		expect(shortestAngleDelta(0, Math.PI)).toBeCloseTo(Math.PI);
		expect(Math.abs(shortestAngleDelta(0, -Math.PI))).toBeCloseTo(Math.PI);
		expect(shortestAngleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
	});
});
