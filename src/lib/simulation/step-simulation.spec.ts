import { describe, expect, it } from 'vitest';
import {
	advanceSimulation,
	arbitrate,
	clampToInterior,
	createSimulation,
	DEFAULT_COGNITION_CONFIG,
	defaultSimulationConfig,
	distanceSquared,
	hasResourceAnnouncementMemory,
	normalizeAngle,
	sampleWanderTarget,
	shortestAngleDelta,
	simulationSnapshot,
	stepCreature,
	stepSimulation,
	type SimulationConfig,
	type SimulationState
} from './index';
import { cognitionConfigFromSimulation } from './behaviour/build-arbitration-input';
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

describe('session apply keeps stepped habitat resource amounts', () => {
	/**
	 * Regression: the page used to freeze habitat object identity when seed matched
	 * so presentation would not rebuild. That discarded eat/drink amount updates and
	 * fed the next step a full habitat again. Session apply must keep result.state.
	 */
	it('must not reattach the previous habitat when seed is unchanged', () => {
		const config = defaultSimulationConfig('session-habitat-apply');
		const food = createSimulation(config).habitat.food[0]!;
		const eater = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			hunger: 0.9,
			thirst: 0.1,
			energy: 0.9,
			intention: 'satisfy_hunger',
			action: 'eat',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			intentionStartedAt: 0
		});
		const prev = {
			...createSimulation(config),
			creatures: [eater]
		};
		const amountBefore = prev.habitat.food.find((f) => f.id === food.id)!.amount;
		const next = stepSimulation(prev, config);
		const amountAfter = next.habitat.food.find((f) => f.id === food.id)?.amount ?? 0;
		expect(amountAfter).toBeLessThan(amountBefore);

		// Historical page bug: freeze habitat when seed matches.
		const buggySession = {
			...next,
			habitat: prev.habitat.seed === next.habitat.seed ? prev.habitat : next.habitat
		};
		expect(buggySession.habitat).toBe(prev.habitat);
		expect(buggySession.habitat.food.find((f) => f.id === food.id)!.amount).toBe(amountBefore);

		// Correct apply: full stepped state (as +page.svelte now does).
		const applied = next;
		expect(applied.habitat).not.toBe(prev.habitat);
		const appliedAmount = applied.habitat.food.find((f) => f.id === food.id)?.amount ?? 0;
		expect(appliedAmount).toBe(amountAfter);
		expect(appliedAmount).toBeLessThan(amountBefore);
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

describe('announce_resource same-step race (successful emit)', () => {
	it('produces one emission and does not re-execute announce for the same feature in one step', () => {
		const config: SimulationConfig = {
			...defaultSimulationConfig('announce-race-once'),
			creatureCount: 1,
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0,
			initialHunger: 0.1,
			initialThirst: 0.1,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			habitat: {
				...defaultSimulationConfig('announce-race-once').habitat,
				foodCount: 1,
				waterCount: 0
			}
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { x: food.position.x, y: food.position.y },
			hunger: 0.1,
			thirst: 0.1,
			energy: 1,
			intention: 'announce_resource',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			movementSpeed: 0,
			nextReconsiderAt: 999,
			preferredSymbolId: 'glyph-0',
			lexicon: { food: 'glyph-0', water: null }
		});
		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};

		const beforeCounter = state.creatures[0]!.announcementOpportunityCounter;
		state = stepSimulation(state, config);
		const c = state.creatures[0]!;

		expect(c.emissionCount).toBe(1);
		const emittedOutcomes = c.recentAnnouncementOutcomes.filter(
			(o) => o.reason === 'emitted' && o.triggerFeatureId === food.id
		);
		expect(emittedOutcomes).toHaveLength(1);
		expect(hasResourceAnnouncementMemory(c.memory, food.id)).toBe(true);
		// No second executor creation for the same feature mid/post emit same step.
		expect(c.announcementOpportunityCounter).toBeLessThanOrEqual(beforeCounter + 1);
		expect(c.activeAnnouncementOpportunity).toBeNull();
		// Deferred replan pending so next step sees committed memory.
		expect(c.pendingArbitrationTrigger).toBe('action_complete');

		// Next step: memory suppresses re-announce of food-X.
		const emissionsBefore = c.emissionCount;
		state = stepSimulation(state, config);
		const after = state.creatures[0]!;
		expect(after.emissionCount).toBe(emissionsBefore);
		expect(
			after.recentAnnouncementOutcomes.filter(
				(o) => o.reason === 'emitted' && o.triggerFeatureId === food.id
			)
		).toHaveLength(1);
		expect(hasResourceAnnouncementMemory(after.memory, food.id)).toBe(true);
		expect(after.intention).not.toBe('announce_resource');
	});
});

describe('announce_resource end-to-end (unified intentions)', () => {
	function idleAnnounceConfig(seed: string): SimulationConfig {
		return {
			...defaultSimulationConfig(seed),
			creatureCount: 1,
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0,
			initialHunger: 0.1,
			initialThirst: 0.1,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			// Align simulation config with cognition defaults under test.
			wanderBaseline: DEFAULT_COGNITION_CONFIG.wanderBaseline,
			announceBaseline: DEFAULT_COGNITION_CONFIG.announceBaseline,
			signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
			continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus
		};
	}

	it('wander → perceive unannounced resource → announce → emit → memory suppresses re-announce', () => {
		const config = idleAnnounceConfig('e2e-announce-once');
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { x: food.position.x, y: food.position.y },
			hunger: 0.1,
			thirst: 0.1,
			energy: 1,
			intention: 'wander',
			action: 'wander',
			target: { kind: 'point', position: { x: food.position.x + 0.5, y: food.position.y } },
			movementSpeed: 0,
			nextReconsiderAt: 0,
			pendingArbitrationTrigger: 'relevant_resource_perception_change',
			preferredSymbolId: 'glyph-0',
			lexicon: { food: 'glyph-0', water: null }
		});

		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};

		// After perception, idle arbitration must prefer announce over wander.
		let selectedAnnounce = false;
		for (let i = 0; i < 5; i += 1) {
			state = stepSimulation(state, config);
			const c = state.creatures[0]!;
			if (c.intention === 'announce_resource') {
				selectedAnnounce = true;
			}
			if (c.emissionCount > 0) {
				break;
			}
		}
		expect(selectedAnnounce).toBe(true);
		expect(state.creatures[0]!.emissionCount).toBeGreaterThanOrEqual(1);
		const announcedCreature = state.creatures[0]!;
		expect(hasResourceAnnouncementMemory(announcedCreature.memory, food.id)).toBe(true);

		// Same resource no longer produces a valid announce candidate (other features ignored).
		const post = arbitrate({
			timeSeconds: state.timeSeconds,
			trigger: 'periodic',
			position: announcedCreature.position,
			hunger: announcedCreature.hunger,
			thirst: announcedCreature.thirst,
			energy: announcedCreature.energy,
			availableFood: [
				{
					featureId: food.id,
					resourceKind: 'food',
					position: { x: food.position.x, y: food.position.y }
				}
			],
			availableWater: [],
			memory: announcedCreature.memory,
			currentIntention: announcedCreature.intention,
			currentTarget: announcedCreature.target,
			homeFeatureId: state.habitat.home.id,
			config: cognitionConfigFromSimulation(config)
		});
		const announce = post.candidates.find((c) => c.intention === 'announce_resource');
		expect(announce?.valid).toBe(false);
		expect(announce?.rejectionReason).toBe('no_unannounced_resource');
		expect(post.selectedIntention).not.toBe('announce_resource');
	});

	it('strong hunger beats announcement when both compete for a newly seen resource', () => {
		const config = {
			...idleAnnounceConfig('e2e-hunger-beats-announce'),
			seekFoodThreshold: DEFAULT_COGNITION_CONFIG.seekFoodThreshold
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { x: food.position.x, y: food.position.y },
			hunger: 0.9,
			thirst: 0.1,
			energy: 1,
			intention: 'wander',
			action: 'wander',
			movementSpeed: 0,
			nextReconsiderAt: 0,
			pendingArbitrationTrigger: 'relevant_resource_perception_change'
		});
		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};
		state = stepSimulation(state, config);
		const c = state.creatures[0]!;
		// Need path wins; may be satisfy_hunger eating/moving, not announce.
		expect(c.intention).toBe('satisfy_hunger');
		expect(c.emissionCount).toBe(0);
		expect(hasResourceAnnouncementMemory(c.memory, food.id)).toBe(false);
	});
});
