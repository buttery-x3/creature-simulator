import { describe, expect, it } from 'vitest';
import {
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot,
	stepSimulation
} from '../index';
import { createEmptyMemory } from '../memory/create-memory';
import { rememberResourceObservation } from '../memory/mutate';
import { testCreature } from '../test-creature';
import { actionForIntention, appendTransition } from './actions';
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
			intention: 'satisfy_hunger',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			intentionStartedAt: 0
		});
		expect(isAtFeature(creature.position, food, config.arrivalDistance)).toBe(true);

		const next = stepCreatureBehaviour(creature, 1, 1, config.seed, base.habitat, config, {
			food: config.eatRecoveryPerSecond,
			water: 0
		}).creature;
		expect(next.hunger).toBeLessThan(0.8);
	});

	it('leaves eat when the food target is removed mid-meal (depleted)', () => {
		const config = defaultSimulationConfig('eat-depleted-replan');
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const habitatWithoutFood = {
			...base.habitat,
			food: base.habitat.food.filter((f) => f.id !== food.id)
		};
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			hunger: 0.8,
			thirst: 0.1,
			energy: 0.9,
			intention: 'satisfy_hunger',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			intentionStartedAt: 0
		});

		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			habitatWithoutFood,
			config,
			{ food: 0, water: 0 }
		).creature;

		expect(next.action).not.toBe('eat');
		expect(next.lastArbitration).not.toBeNull();
		// Invalid target and/or perception change both force replan off eat.
		expect(
			next.lastArbitration?.trigger === 'current_target_invalid' ||
				next.lastArbitration?.trigger === 'relevant_resource_perception_change' ||
				next.lastArbitration?.trigger === 'action_complete'
		).toBe(true);
	});

	it('leaves drink when the water basin is empty mid-drink', () => {
		const config = defaultSimulationConfig('drink-empty-replan');
		const base = createSimulation(config);
		const water = base.habitat.water[0]!;
		const habitatEmpty = {
			...base.habitat,
			water: base.habitat.water.map((w) => (w.id === water.id ? { ...w, amount: 0 } : { ...w }))
		};
		const creature = testCreature({
			id: 'creature-0',
			position: { ...water.position },
			hunger: 0.1,
			thirst: 0.9,
			energy: 0.9,
			intention: 'satisfy_thirst',
			action: 'drink',
			target: { kind: 'feature', featureId: water.id, featureKind: 'water' },
			nextReconsiderAt: 999,
			intentionStartedAt: 0
		});

		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			habitatEmpty,
			config,
			{ food: 0, water: 0 }
		).creature;

		expect(next.action).not.toBe('drink');
		expect(next.lastArbitration?.trigger).toBe('current_target_invalid');
		expect(habitatEmpty.water.some((w) => w.id === water.id && w.amount === 0)).toBe(true);
	});

	it('keeps eat while the food source is still available', () => {
		const config = defaultSimulationConfig('eat-still-available');
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		expect(food.amount).toBeGreaterThan(0);
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			hunger: 0.8,
			thirst: 0.1,
			energy: 0.9,
			intention: 'satisfy_hunger',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			intentionStartedAt: 0
		});

		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config,
			{ food: config.eatRecoveryPerSecond * config.fixedDt, water: 0 }
		).creature;

		expect(next.action).toBe('eat');
		expect(next.lastArbitration?.trigger).not.toBe('current_target_invalid');
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
			intention: 'rest',
			action: 'sleep',
			target: { kind: 'feature', featureId: home.id, featureKind: 'home' },
			nextReconsiderAt: 999,
			movementSpeed: 5
		});
		const next = stepCreatureBehaviour(creature, 1, 1, config.seed, base.habitat, config).creature;
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
			intention: 'satisfy_hunger',
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
		).creature;
		expect(next.lastArbitration).not.toBeNull();
		expect(isTargetValid(base.habitat, next.target)).toBe(true);
	});

	it('remembered missing food uses a point target and does not invalid-target loop', () => {
		const config = {
			...defaultSimulationConfig('mem-point-nav'),
			reconsiderIntervalSeconds: 10,
			seekFoodThreshold: 0.45,
			sensingRadius: 2,
			habitat: {
				...defaultSimulationConfig('mem-point-nav').habitat,
				foodCount: 0,
				waterCount: 0
			}
		};
		const base = createSimulation(config);
		const belief = { x: 8, y: 8 };
		let memory = createEmptyMemory(8);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 0,
			featureId: 'food-gone',
			resourceKind: 'food',
			position: belief,
			empty: false
		});
		expect(base.habitat.food).toHaveLength(0);

		const creature = testCreature({
			position: { x: 0, y: 0 },
			hunger: 0.9,
			thirst: 0.1,
			energy: 0.95,
			intention: 'wander',
			action: 'wander',
			memory,
			nextReconsiderAt: 0,
			movementSpeed: 1
		});

		const triggers: string[] = [];
		let next = creature;
		for (let i = 0; i < 5; i += 1) {
			const time = (i + 1) * config.fixedDt;
			next = stepCreatureBehaviour(
				next,
				config.fixedDt,
				time,
				config.seed,
				base.habitat,
				config
			).creature;
			if (next.lastArbitration) {
				triggers.push(next.lastArbitration.trigger);
			}
		}

		expect(next.intention).toBe('satisfy_hunger');
		expect(next.target).toEqual({ kind: 'point', position: belief });
		expect(next.action).toBe('move');
		expect(isTargetValid(base.habitat, next.target)).toBe(true);
		expect(triggers.filter((t) => t === 'current_target_invalid').length).toBe(0);
	});

	it('visible food feature target becomes invalid when the feature is removed', () => {
		const config = {
			...defaultSimulationConfig('visible-deplete'),
			reconsiderIntervalSeconds: 10,
			perceptionIntervalSeconds: 10
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			position: { x: food.position.x + 2, y: food.position.y },
			hunger: 0.9,
			intention: 'satisfy_hunger',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			// Perception already current so no perception-change replan masks invalid-target.
			perception: {
				lastUpdatedAt: 1,
				perceivedFoodIds: [],
				perceivedWaterIds: [],
				observations: []
			},
			nextReconsiderAt: 999,
			movementSpeed: 0
		});
		expect(isTargetValid(base.habitat, creature.target)).toBe(true);
		const habitatWithoutFood = {
			...base.habitat,
			food: base.habitat.food.filter((f) => f.id !== food.id)
		};
		expect(isTargetValid(habitatWithoutFood, creature.target)).toBe(false);
		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			habitatWithoutFood,
			config
		).creature;
		expect(next.lastArbitration?.trigger).toBe('current_target_invalid');
	});

	it('maps need + remembered point to move (not search)', () => {
		expect(actionForIntention('satisfy_hunger', false, false, true)).toBe('move');
		expect(actionForIntention('satisfy_hunger', false, false, false)).toBe('search');
		expect(actionForIntention('satisfy_hunger', true, true, true)).toBe('eat');
		expect(actionForIntention('satisfy_hunger', true, false, true)).toBe('move');
	});

	it('appendTransition drops oldest entries beyond the limit', () => {
		const history = appendTransition(
			[
				{
					timeSeconds: 1,
					fromIntention: 'wander',
					toIntention: 'satisfy_hunger',
					fromAction: 'wander',
					toAction: 'move',
					reason: 'a'
				},
				{
					timeSeconds: 2,
					fromIntention: 'satisfy_hunger',
					toIntention: 'wander',
					fromAction: 'eat',
					toAction: 'wander',
					reason: 'b'
				}
			],
			{
				timeSeconds: 3,
				fromIntention: 'wander',
				toIntention: 'rest',
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

	it('hungry creature searches when no food is known', () => {
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
			intention: 'satisfy_hunger',
			action: 'search',
			target: { kind: 'point', position: { x: 8, y: 8 } },
			searchTarget: { x: 8, y: 8 },
			nextReconsiderAt: 999,
			perception: emptyPerception()
		});
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		// May replan on perception or stay searching; hunger still drives food need.
		expect(
			result.creature.intention === 'satisfy_hunger' || result.creature.intention === 'wander'
		).toBe(true);
		if (result.creature.intention === 'satisfy_hunger' && !result.creature.target) {
			expect(result.creature.action).toBe('search');
		}
		if (result.creature.action === 'search') {
			expect(result.creature.target?.kind).toBe('point');
		}
		expect(result.emissionRequest).toBeNull();
	});

	it('perceiving food can replan toward a feature target', () => {
		const config = {
			...defaultSimulationConfig('search-to-move'),
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			arrivalDistance: 0.1,
			seekFoodThreshold: 0.1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			position: { x: food.position.x + 1.5, y: food.position.y },
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			intention: 'satisfy_hunger',
			action: 'search',
			target: { kind: 'point', position: { x: food.position.x + 2, y: food.position.y } },
			searchTarget: { x: food.position.x + 2, y: food.position.y },
			movementSpeed: 0.01,
			nextReconsiderAt: 999,
			perception: emptyPerception()
		});
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		const next = result.creature;
		expect(next.perception.perceivedFoodIds).toContain(food.id);
		// Perception change triggers arbitration; hungry creature should pursue food.
		if (next.intention === 'satisfy_hunger' && next.target?.kind === 'feature') {
			expect(next.target.featureId).toBe(food.id);
			expect(next.action === 'move' || next.action === 'eat').toBe(true);
		}
		// Discovery no longer auto-starts announcement executor.
		expect(result.emissionRequest).toBeNull();
	});

	it('search destinations are deterministic and within bounds', () => {
		const config = defaultSimulationConfig('search-det');
		const base = createSimulation(config);
		const creature = testCreature({
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			intention: 'satisfy_hunger',
			action: 'search',
			target: { kind: 'point', position: { x: 0, y: 0 } },
			searchTarget: { x: 0, y: 0 },
			searchDecisionIndex: 0,
			position: { x: 0, y: 0 },
			movementSpeed: 100,
			nextReconsiderAt: 999,
			perception: emptyPerception()
		});
		const a = stepCreatureBehaviour(creature, 0.01, 1, config.seed, base.habitat, config).creature;
		const b = stepCreatureBehaviour(creature, 0.01, 1, config.seed, base.habitat, config).creature;
		expect(a.searchTarget).toEqual(b.searchTarget);
		const halfW = base.habitat.bounds.width / 2 - config.creatureRadius;
		const halfH = base.habitat.bounds.height / 2 - config.creatureRadius;
		expect(a.searchTarget.x).toBeGreaterThanOrEqual(-halfW);
		expect(a.searchTarget.x).toBeLessThanOrEqual(halfW);
		expect(a.searchTarget.y).toBeGreaterThanOrEqual(-halfH);
		expect(a.searchTarget.y).toBeLessThanOrEqual(halfH);
	});
});

describe('announce_resource executor (no behaviour lock)', () => {
	function announcingCreature(
		overrides: Parameters<typeof testCreature>[0] = {}
	): ReturnType<typeof testCreature> {
		const speakingTarget = { x: 1, y: 1 };
		return testCreature({
			id: 'creature-0',
			intention: 'announce_resource',
			action: 'move',
			target: { kind: 'feature', featureId: 'food-0', featureKind: 'food' },
			position: { x: 0, y: 0 },
			movementSpeed: 0,
			intentionStartedAt: 0,
			actionStartedAt: 0,
			nextReconsiderAt: 0,
			hunger: 0.1,
			thirst: 0.1,
			energy: 0.95,
			activeAnnouncementExecution: {
				id: 'ann-creature-0-0',
				creatureId: 'creature-0',
				triggerFeatureId: 'food-0',
				resourceKind: 'food',
				triggerFeaturePosition: { x: 2, y: 0 },
				state: 'repositioning',
				speakingTarget: { ...speakingTarget },
				initialClarity: {
					announcedKind: 'food',
					nearestAnnouncedKindDistance: 2,
					nearestOppositeKindDistance: 2.1,
					clarityMargin: 0.75,
					clear: false,
					reason: 'unclear_margin'
				}
			},
			announcementExecutionCounter: 1,
			...overrides
		});
	}

	it('advances announce_resource executor when intention is announce_resource', () => {
		const config = {
			...defaultSimulationConfig('ann-exec'),
			resourceAnnouncementClarityMargin: 0,
			emissionCooldownSeconds: 0,
			reconsiderIntervalSeconds: 1.5
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = announcingCreature({
			position: { ...food.position },
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 9999,
			activeAnnouncementExecution: {
				...announcingCreature().activeAnnouncementExecution!,
				triggerFeatureId: food.id,
				triggerFeaturePosition: { ...food.position },
				state: 'evaluating',
				speakingTarget: { ...food.position }
			}
		});
		const timeSeconds = 10;
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			timeSeconds,
			config.seed,
			base.habitat,
			config
		);
		// Clear at food should emit or complete; either way executor advanced.
		const next = result.creature;
		expect(
			result.emissionRequest !== null ||
				next.recentAnnouncementOutcomes.length > 0 ||
				next.activeAnnouncementExecution !== null ||
				next.intention !== 'announce_resource'
		).toBe(true);
	});

	it('restores normal decision-making after invalidating an announcement', () => {
		const config = {
			...defaultSimulationConfig('ann-invalidate-replan'),
			reconsiderIntervalSeconds: 1.25
		};
		const base = createSimulation(config);
		const creature = announcingCreature({
			nextReconsiderAt: 8888,
			target: { kind: 'feature', featureId: 'missing-food-feature', featureKind: 'food' },
			activeAnnouncementExecution: {
				...announcingCreature().activeAnnouncementExecution!,
				triggerFeatureId: 'missing-food-feature',
				state: 'repositioning'
			}
		});
		const timeSeconds = 5;
		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			timeSeconds,
			config.seed,
			base.habitat,
			config
		).creature;
		expect(
			next.recentAnnouncementOutcomes.some((o) => o.reason === 'invalid_trigger_feature')
		).toBe(true);
		expect(next.activeAnnouncementExecution).toBeNull();
		// Invalid end triggers ordinary arbitration (no lock); winner is unconstrained.
		expect(next.lastArbitration).not.toBeNull();
		expect(next.lastArbitration?.candidates.length).toBeGreaterThan(0);
	});

	it('runs arbitration after announcement ends without asserting a winner', () => {
		const config = {
			...defaultSimulationConfig('ann-eligible-again'),
			reconsiderIntervalSeconds: 1.5,
			seekFoodThreshold: 0.1,
			seekWaterThreshold: 0.1
		};
		const base = createSimulation(config);
		const creature = announcingCreature({
			nextReconsiderAt: 7777,
			hunger: 0.9,
			thirst: 0.2,
			energy: 0.95,
			target: { kind: 'feature', featureId: 'gone-feature', featureKind: 'food' },
			activeAnnouncementExecution: {
				...announcingCreature().activeAnnouncementExecution!,
				triggerFeatureId: 'gone-feature',
				state: 'repositioning'
			}
		});
		const timeSeconds = 3;
		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			timeSeconds,
			config.seed,
			base.habitat,
			config
		).creature;
		expect(next.lastArbitration).not.toBeNull();
		expect(next.lastArbitration?.candidates.length).toBeGreaterThan(0);
		expect(typeof next.lastArbitration?.selectedIntention).toBe('string');
	});

	it('does not advance announcement executor when intention is not announce_resource', () => {
		const config = {
			...defaultSimulationConfig('ann-not-intent'),
			perceptionIntervalSeconds: 1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			intention: 'wander',
			action: 'wander',
			target: { kind: 'point', position: { x: 1, y: 0 } },
			// Already sensed this tick so perception does not force replan → announce.
			perception: {
				lastUpdatedAt: 1,
				perceivedFoodIds: [food.id],
				perceivedWaterIds: [],
				observations: [
					{
						featureId: food.id,
						featureKind: 'food',
						position: { ...food.position },
						observedAt: 1
					}
				]
			},
			nextReconsiderAt: 999,
			movementSpeed: 0
		});
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		expect(result.creature.intention).toBe('wander');
		expect(result.emissionRequest).toBeNull();
		expect(result.creature.activeAnnouncementExecution).toBeNull();
	});
});
