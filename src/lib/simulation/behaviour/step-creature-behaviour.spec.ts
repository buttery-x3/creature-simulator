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

		const next = stepCreatureBehaviour(creature, 1, 1, config.seed, base.habitat, config, {
			food: config.eatRecoveryPerSecond,
			water: 0
		}).creature;
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
		).creature;
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
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		expect(result.creature.goal).toBe('seek_food');
		expect(result.creature.action).toBe('search');
		expect(result.creature.target?.kind).toBe('point');
		expect(result.emissionRequest).toBeNull();
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
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		);
		const next = result.creature;
		expect(next.goal).toBe('seek_food');
		expect(next.action).toBe('move');
		expect(next.target).toEqual({
			kind: 'feature',
			featureId: food.id,
			featureKind: 'food'
		});
		expect(next.perception.tracked?.featureId).toBe(food.id);
		expect(next.recentTransitions.some((t) => t.reason.includes('food perceived'))).toBe(true);
		expect(result.emissionRequest).toMatchObject({
			senderId: creature.id,
			origin: { x: creature.position.x, y: creature.position.y },
			context: 'resource_discovered',
			contextDetail: 'food',
			triggerFeatureId: food.id
		});
		expect(result.emissionRequest?.opportunityId).toBeTruthy();
		expect(result.emissionRequest?.perceptionEpisodeId).toBeTruthy();
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
				},
				activeEpisodes: [],
				episodeCounter: 0
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
		).creature;
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

describe('announcement preparation lock and exit replan', () => {
	const speakingTarget = { x: 1, y: 1 };

	function preparingCreature(
		overrides: Parameters<typeof testCreature>[0] = {}
	): ReturnType<typeof testCreature> {
		return testCreature({
			id: 'creature-0',
			goal: 'prepare_announcement',
			action: 'move',
			target: { kind: 'point', position: { ...speakingTarget } },
			position: { x: 0, y: 0 },
			movementSpeed: 0,
			goalStartedAt: 0,
			actionStartedAt: 0,
			// Ordinary reconsider is due — lock must still hold.
			nextReconsiderAt: 0,
			hunger: 0.1,
			thirst: 0.1,
			energy: 0.95,
			activeAnnouncementOpportunity: {
				id: 'ann-creature-0-0',
				creatureId: 'creature-0',
				triggerFeatureId: 'food-0',
				resourceKind: 'food',
				triggerFeaturePosition: { x: 2, y: 0 },
				perceptionEpisodeId: 'ep-food-0-0',
				discoveredAt: 0,
				discoveryCreaturePosition: { x: 0, y: 0 },
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
			announcementOpportunityCounter: 1,
			activeAnnouncementCue: {
				opportunityId: 'ann-creature-0-0',
				triggerFeatureId: 'food-0',
				triggerFeaturePosition: { x: 2, y: 0 },
				fadeStartedAt: null
			},
			...overrides
		});
	}

	it('stays committed to prepare_announcement when ordinary reconsider is due', () => {
		const config = {
			...defaultSimulationConfig('ann-lock-due'),
			resourceAnnouncementClarityMargin: 0.75,
			sensingRadius: 8,
			speakingPositionSearchRadius: 4,
			emissionCooldownSeconds: 0
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const water = base.habitat.water[0]!;
		// Midpoint: food and water both in scope → unclear; stay put (speed 0) so we do not emit.
		const mid = {
			x: (food.position.x + water.position.x) / 2,
			y: (food.position.y + water.position.y) / 2
		};
		const creature = preparingCreature({
			position: mid,
			target: { kind: 'point', position: mid },
			movementSpeed: 0,
			activeAnnouncementOpportunity: {
				...preparingCreature().activeAnnouncementOpportunity!,
				triggerFeatureId: food.id,
				triggerFeaturePosition: { ...food.position },
				speakingTarget: mid
			},
			activeAnnouncementCue: {
				opportunityId: 'ann-creature-0-0',
				triggerFeatureId: food.id,
				triggerFeaturePosition: { ...food.position },
				fadeStartedAt: null
			}
		});
		const next = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			base.habitat,
			config
		).creature;
		expect(next.goal).toBe('prepare_announcement');
		// No ordinary replan while locked (lastDecision stays null).
		expect(next.lastDecision).toBeNull();
	});

	it('restores normal nextReconsiderAt after emission ends preparation', () => {
		const config = {
			...defaultSimulationConfig('ann-emit-replan'),
			resourceAnnouncementClarityMargin: 0,
			emissionCooldownSeconds: 0,
			reconsiderIntervalSeconds: 1.5
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		// Clear food context: stand on food, no competing water nearby required when margin is 0.
		const creature = preparingCreature({
			position: { ...food.position },
			target: { kind: 'point', position: { ...food.position } },
			// Stale far-future timer that must not survive exit.
			nextReconsiderAt: 9999,
			activeAnnouncementOpportunity: {
				...preparingCreature().activeAnnouncementOpportunity!,
				triggerFeatureId: food.id,
				triggerFeaturePosition: { ...food.position },
				state: 'repositioning',
				speakingTarget: { ...food.position }
			},
			activeAnnouncementCue: {
				opportunityId: 'ann-creature-0-0',
				triggerFeatureId: food.id,
				triggerFeaturePosition: { ...food.position },
				fadeStartedAt: null
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
		const next = result.creature;
		expect(result.emissionRequest).not.toBeNull();
		expect(next.goal).not.toBe('prepare_announcement');
		expect(next.lastDecision).not.toBeNull();
		expect(next.lastDecision?.trigger).toBe('action_complete');
		expect(next.nextReconsiderAt).toBeCloseTo(timeSeconds + config.reconsiderIntervalSeconds);
		expect(next.nextReconsiderAt).toBeLessThan(100);
	});

	it('restores normal decision-making after invalidating an announcement', () => {
		const config = {
			...defaultSimulationConfig('ann-invalidate-replan'),
			reconsiderIntervalSeconds: 1.25
		};
		const base = createSimulation(config);
		// Trigger feature id does not exist → invalidate.
		const creature = preparingCreature({
			nextReconsiderAt: 8888,
			activeAnnouncementOpportunity: {
				...preparingCreature().activeAnnouncementOpportunity!,
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
		expect(next.goal).not.toBe('prepare_announcement');
		expect(
			next.recentAnnouncementOutcomes.some((o) => o.reason === 'invalid_trigger_feature')
		).toBe(true);
		// The invalidated opportunity must not remain open.
		expect(next.activeAnnouncementOpportunity).toBeNull();
		expect(next.lastDecision).not.toBeNull();
		expect(next.lastDecision?.trigger).toBe('action_complete');
		expect(next.nextReconsiderAt).toBeCloseTo(timeSeconds + config.reconsiderIntervalSeconds);
		expect(next.nextReconsiderAt).toBeLessThan(100);
	});

	it('runs the decision system again after preparation ends without asserting a winner', () => {
		const config = {
			...defaultSimulationConfig('ann-eligible-again'),
			reconsiderIntervalSeconds: 1.5,
			// Make need goals valid candidates without asserting they win.
			seekFoodThreshold: 0.1,
			seekWaterThreshold: 0.1
		};
		const base = createSimulation(config);
		const creature = preparingCreature({
			nextReconsiderAt: 7777,
			hunger: 0.9,
			thirst: 0.2,
			energy: 0.95,
			// Pending investigation is present — eligibility only, not winner policy.
			pendingSignals: [
				{
					emissionId: 'em-pending',
					symbolId: 'glyph-1',
					senderId: 'creature-9',
					origin: { x: 0.5, y: 0.5 },
					heardAt: 0,
					expiresAt: 100,
					curiosityDecision: 'accepted',
					curiosityEvidence: { curiosity: 0.5, deterministicSample: 0.1 }
				}
			],
			activeAnnouncementOpportunity: {
				...preparingCreature().activeAnnouncementOpportunity!,
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
		expect(next.goal).not.toBe('prepare_announcement');
		expect(next.lastDecision).not.toBeNull();
		expect(next.lastDecision?.trigger).toBe('action_complete');
		expect(next.lastDecision?.candidates.length).toBeGreaterThan(0);
		// Decision system ran; do not assert which goal won.
		expect(typeof next.lastDecision?.selectedGoal).toBe('string');
		expect(next.nextReconsiderAt).toBeCloseTo(timeSeconds + config.reconsiderIntervalSeconds);
	});
});
