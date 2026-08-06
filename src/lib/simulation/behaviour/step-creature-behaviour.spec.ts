import { describe, expect, it } from 'vitest';
import {
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot,
	stepSimulation
} from '../index';
import { testCreature } from '../test-creature';
import { appendTransition } from './actions';
import { isAtFeature, isTargetValid } from './resource-awareness';
import { stepCreatureBehaviour } from './step-creature-behaviour';

describe('stepCreatureBehaviour integration', () => {
	it('produces identical decisions for identical seeds', () => {
		const config = defaultSimulationConfig('behaviour-det');
		let a = createSimulation(config);
		let b = createSimulation(config);
		for (let i = 0; i < 120; i += 1) {
			a = stepSimulation(a, config);
			b = stepSimulation(b, config);
		}
		expect(simulationSnapshot(a)).toBe(simulationSnapshot(b));
	});

	it('keeps recent transition history bounded', () => {
		const config = {
			...defaultSimulationConfig('history-bound'),
			decisionHistoryLimit: 3,
			reconsiderIntervalSeconds: 0.05,
			minGoalCommitmentSeconds: 0,
			goalSwitchMargin: 0,
			hungerRisePerSecond: 0.5,
			initialHunger: 0.1
		};
		let state = createSimulation(config);
		for (let i = 0; i < 400; i += 1) {
			state = stepSimulation(state, config);
		}
		for (const creature of state.creatures) {
			expect(creature.recentTransitions.length).toBeLessThanOrEqual(config.decisionHistoryLimit);
		}
	});

	it('eating at a food footprint reduces hunger over steps', () => {
		const config = defaultSimulationConfig('eat-at-food');
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			hunger: 0.8,
			thirst: 0.1,
			energy: 0.9,
			goal: 'seek_food',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			goalStartedAt: 0
		});
		expect(isAtFeature(creature.position, food, config.arrivalDistance)).toBe(true);

		const next = stepCreatureBehaviour(creature, 1, 1, config.seed, base.habitat, config);
		expect(next.hunger).toBeLessThan(0.8);
	});

	it('sleeping restores energy and stops movement', () => {
		const config = defaultSimulationConfig('sleep-energy');
		const base = createSimulation(config);
		const home = base.habitat.home;
		const creature = testCreature({
			position: { ...home.position },
			hunger: 0.1,
			thirst: 0.1,
			energy: 0.2,
			goal: 'rest',
			action: 'sleep',
			target: { kind: 'feature', featureId: home.id, featureKind: 'home' },
			nextReconsiderAt: 999,
			movementSpeed: 5
		});
		const next = stepCreatureBehaviour(creature, 1, 1, config.seed, base.habitat, config);
		expect(next.energy).toBeGreaterThan(creature.energy);
		expect(next.position).toEqual(creature.position);
	});

	it('invalid targets cause replanning', () => {
		const config = defaultSimulationConfig('invalid-target');
		const base = createSimulation(config);
		const creature = testCreature({
			hunger: 0.1,
			thirst: 0.1,
			energy: 0.95,
			goal: 'seek_food',
			action: 'move',
			target: { kind: 'feature', featureId: 'does-not-exist', featureKind: 'food' },
			nextReconsiderAt: 999
		});
		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		expect(next.lastDecision?.trigger).toBe('invalid_target');
		expect(next.goal).toBe('wander');
		expect(isTargetValid(base.habitat, next.target)).toBe(true);
	});

	it('appendTransition drops oldest entries beyond the limit', () => {
		const history = appendTransition(
			[
				{
					timeSeconds: 1,
					fromGoal: 'wander',
					toGoal: 'seek_food',
					fromAction: 'wander',
					toAction: 'move',
					reason: 'a'
				},
				{
					timeSeconds: 2,
					fromGoal: 'seek_food',
					toGoal: 'wander',
					fromAction: 'eat',
					toAction: 'wander',
					reason: 'b'
				}
			],
			{
				timeSeconds: 3,
				fromGoal: 'wander',
				toGoal: 'rest',
				fromAction: 'wander',
				toAction: 'move',
				reason: 'c'
			},
			2
		);
		expect(history).toHaveLength(2);
		expect(history[0]?.reason).toBe('b');
		expect(history[1]?.reason).toBe('c');
	});
});
