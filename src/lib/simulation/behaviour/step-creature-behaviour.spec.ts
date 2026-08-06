import { describe, expect, it } from 'vitest';
import {
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot,
	stepSimulation
} from '../index';
import { testCreature } from '../test-creature';
import { appendTransition } from './actions';
import { emptyPerception } from './perception';
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

	it('hungry creature searches when no food is perceived', () => {
		const config = {
			...defaultSimulationConfig('search-hungry'),
			sensingRadius: 0.5,
			perceptionIntervalSeconds: 0.01
		};
		const base = createSimulation(config);
		const creature = testCreature({
			position: { x: 9, y: 9 },
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			goal: 'seek_food',
			action: 'search',
			target: { kind: 'point', position: { x: 8, y: 8 } },
			searchTarget: { x: 8, y: 8 },
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
		expect(next.goal).toBe('seek_food');
		expect(next.action).toBe('search');
		expect(next.target?.kind).toBe('point');
	});

	it('transitions from search to move when food is perceived', () => {
		const config = {
			...defaultSimulationConfig('search-to-move'),
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			// Stay off the footprint so we do not immediately enter eat on the same step.
			arrivalDistance: 0.1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			// Within sensing radius of food centre, outside tight arrival footprint
			position: { x: food.position.x + 1.5, y: food.position.y },
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			goal: 'seek_food',
			action: 'search',
			target: { kind: 'point', position: { x: food.position.x + 2, y: food.position.y } },
			searchTarget: { x: food.position.x + 2, y: food.position.y },
			movementSpeed: 0.01,
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
		expect(next.goal).toBe('seek_food');
		expect(next.action).toBe('move');
		expect(next.target).toEqual({
			kind: 'feature',
			featureId: food.id,
			featureKind: 'food'
		});
		expect(next.perception.tracked?.featureId).toBe(food.id);
		expect(next.recentTransitions.some((t) => t.reason.includes('food perceived'))).toBe(true);
	});

	it('returns to search when tracked observation expires without reacquisition', () => {
		const config = {
			...defaultSimulationConfig('track-expire'),
			sensingRadius: 0.5,
			perceptionIntervalSeconds: 0.01,
			trackedObservationDurationSeconds: 0.5
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			// Far from food so it is not re-perceived
			position: { x: 9, y: 9 },
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			goal: 'seek_food',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			perception: {
				lastUpdatedAt: 0,
				perceivedFoodIds: [],
				perceivedWaterIds: [],
				observations: [],
				tracked: {
					featureId: food.id,
					featureKind: 'food',
					position: { ...food.position },
					observedAt: 0
				}
			},
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
		expect(next.goal).toBe('seek_food');
		expect(next.action).toBe('search');
		expect(next.perception.tracked).toBeNull();
		expect(
			next.recentTransitions.some((t) => t.reason.includes('tracked food observation expired'))
		).toBe(true);
	});

	it('search destinations are deterministic and within bounds', () => {
		const config = defaultSimulationConfig('search-det');
		const base = createSimulation(config);
		const creature = testCreature({
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			goal: 'seek_food',
			action: 'search',
			target: { kind: 'point', position: { x: 0, y: 0 } },
			searchTarget: { x: 0, y: 0 },
			searchDecisionIndex: 0,
			position: { x: 0, y: 0 },
			movementSpeed: 100,
			nextReconsiderAt: 999,
			perception: emptyPerception()
		});
		// Force arrival-style retarget by placing on search point with large dt movement
		const a = stepCreatureBehaviour(creature, 0.01, 1, config.seed, base.habitat, config);
		const b = stepCreatureBehaviour(creature, 0.01, 1, config.seed, base.habitat, config);
		expect(a.searchTarget).toEqual(b.searchTarget);
		const halfW = base.habitat.bounds.width / 2 - config.creatureRadius;
		const halfH = base.habitat.bounds.height / 2 - config.creatureRadius;
		expect(a.searchTarget.x).toBeGreaterThanOrEqual(-halfW);
		expect(a.searchTarget.x).toBeLessThanOrEqual(halfW);
		expect(a.searchTarget.y).toBeGreaterThanOrEqual(-halfH);
		expect(a.searchTarget.y).toBeLessThanOrEqual(halfH);
	});
});
