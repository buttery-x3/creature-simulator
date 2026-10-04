import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { restRecoveryMultiplier } from '../ecology/rest';
import { testCreature } from '../test-creature';
import { stepCreatureBehaviour } from './step-creature-behaviour';

function fixture() {
	const config = defaultSimulationConfig('outdoor-sleep');
	config.ecology.wildlifeCount = 0;
	const state = createSimulation(config);
	const habitat = {
		...state.habitat,
		home: { ...state.habitat.home, position: { x: 0, y: 0 }, size: { width: 2, height: 2 } },
		food: [],
		water: []
	};
	return { config, habitat, state };
}

describe('local rest execution and physiology', () => {
	it('starts local sleep through arbitration and recovers outdoors without moving', () => {
		const { config, habitat } = fixture();
		const creature = testCreature({ position: { x: 8, y: 0 }, energy: 0, nextReconsiderAt: 0 });
		const first = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			45,
			'rest',
			habitat,
			config
		).creature;
		expect(first.intention).toBe('rest');
		expect(first.action).toBe('sleep');
		expect(first.target).toEqual({ kind: 'point', position: creature.position });
		const second = stepCreatureBehaviour(
			first,
			config.fixedDt,
			45 + config.fixedDt,
			'rest',
			habitat,
			config
		).creature;
		expect(second.position).toEqual(first.position);
		expect(second.energy - first.energy).toBeCloseTo(
			config.sleepRecoveryPerSecond * config.fixedDt * 0.75
		);
	});

	it('applies recovery from location rather than trusting the selected target label', () => {
		const { config, habitat } = fixture();
		for (const [position, multiplier] of [
			[{ x: 0, y: 0 }, 1],
			[{ x: 8, y: 0 }, 0.75]
		] as const) {
			const creature = testCreature({
				position,
				action: 'sleep',
				intention: 'rest',
				target: { kind: 'point', position },
				energy: 0.3,
				nextReconsiderAt: 100
			});
			const next = stepCreatureBehaviour(
				creature,
				config.fixedDt,
				45,
				'rest',
				habitat,
				config
			).creature;
			expect(next.energy - creature.energy).toBeCloseTo(
				config.sleepRecoveryPerSecond * config.fixedDt * multiplier
			);
		}
		expect(
			restRecoveryMultiplier(
				{ x: 1 + config.arrivalDistance, y: 0 },
				habitat.home,
				config.arrivalDistance
			)
		).toBe(1);
	});

	it('does not use unseen wildlife coordinates to choose a resting site', () => {
		const { config, habitat, state } = fixture();
		const creature = testCreature({ position: { x: 8, y: 0 }, energy: 0, nextReconsiderAt: 0 });
		const far = {
			...state.wildlife[0],
			id: 'unseen',
			position: { x: -8, y: -5 },
			size: 2,
			physicality: 2,
			health: 1,
			energy: 1,
			foodAmount: 0,
			facing: 0,
			nextAttackAt: 0,
			patrolPhase: 0,
			mode: 'roam' as const
		};
		const withAnimal = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			45,
			'rest',
			habitat,
			config,
			{ food: 0, water: 0 },
			[far]
		).creature;
		const without = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			45,
			'rest',
			habitat,
			config
		).creature;
		expect(withAnimal).toEqual(without);
	});

	it('allows local sleep to reconsider acute thirst and stronger local danger', () => {
		const { config, habitat } = fixture();
		const sleeper = testCreature({
			verbosity: 0,
			position: { x: 8, y: 0 },
			action: 'sleep',
			intention: 'rest',
			target: { kind: 'point', position: { x: 8, y: 0 } },
			thirst: 1,
			energy: 0.5,
			nextReconsiderAt: 45
		});
		expect(
			stepCreatureBehaviour(sleeper, config.fixedDt, 45, 'rest', habitat, config).creature.intention
		).toBe('satisfy_thirst');
		const predator = {
			id: 'predator',
			position: { x: 7.5, y: 0 },
			size: 2,
			physicality: 2,
			health: 1,
			energy: 1,
			foodAmount: 0,
			facing: 0,
			nextAttackAt: 0,
			patrolPhase: 0,
			mode: 'approach' as const
		};
		expect(
			stepCreatureBehaviour(
				sleeper,
				config.fixedDt,
				45,
				'rest',
				habitat,
				config,
				{ food: 0, water: 0 },
				[predator]
			).creature.intention
		).toBe('flee');
	});
});
