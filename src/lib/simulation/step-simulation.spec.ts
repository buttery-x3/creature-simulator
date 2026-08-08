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
	rememberHeardSignal,
	sampleWanderTarget,
	shortestAngleDelta,
	simulationSnapshot,
	stepCreature,
	stepSimulation,
	type SimulationConfig,
	type SimulationState
} from './index';
import { cognitionConfigFromSimulation } from './behaviour/build-arbitration-input';
import { emptyPerception } from './behaviour/perception';
import { createEmptyMemory } from './memory/create-memory';
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

	it('does not mutate lifetime verbosity under ordinary stepping', () => {
		const config = defaultSimulationConfig('verbosity-stable');
		const initial = createSimulation(config);
		const before = initial.creatures.map((c) => ({ id: c.id, verbosity: c.verbosity }));
		let state = initial;
		for (let i = 0; i < 120; i += 1) {
			state = stepSimulation(state, config);
		}
		expect(state.creatures.map((c) => ({ id: c.id, verbosity: c.verbosity }))).toEqual(before);
	});

	it('does not mutate lifetime curiosity under ordinary stepping', () => {
		const config = defaultSimulationConfig('curiosity-stable');
		const initial = createSimulation(config);
		const before = initial.creatures.map((c) => ({ id: c.id, curiosity: c.curiosity }));
		let state = initial;
		for (let i = 0; i < 120; i += 1) {
			state = stepSimulation(state, config);
		}
		expect(state.creatures.map((c) => ({ id: c.id, curiosity: c.curiosity }))).toEqual(before);
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

		const beforeCounter = state.creatures[0]!.announcementExecutionCounter;
		state = stepSimulation(state, config);
		const c = state.creatures[0]!;

		expect(c.emissionCount).toBe(1);
		const emittedOutcomes = c.recentAnnouncementOutcomes.filter(
			(o) => o.reason === 'emission_requested' && o.triggerFeatureId === food.id
		);
		expect(emittedOutcomes).toHaveLength(1);
		expect(hasResourceAnnouncementMemory(c.memory, food.id)).toBe(true);
		// No second executor creation for the same feature mid/post emit same step.
		expect(c.announcementExecutionCounter).toBeLessThanOrEqual(beforeCounter + 1);
		expect(c.activeAnnouncementExecution).toBeNull();
		// Deferred replan pending so next step sees committed memory.
		expect(c.pendingArbitrationTrigger).toBe('action_complete');

		// Next step: memory suppresses re-announce of food-X.
		const emissionsBefore = c.emissionCount;
		state = stepSimulation(state, config);
		const after = state.creatures[0]!;
		expect(after.emissionCount).toBe(emissionsBefore);
		expect(
			after.recentAnnouncementOutcomes.filter(
				(o) => o.reason === 'emission_requested' && o.triggerFeatureId === food.id
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
			verbosity: announcedCreature.verbosity,
			curiosity: announcedCreature.curiosity,
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

describe('mixed verbosity population (FLAME-84)', () => {
	it('mixes announce with investigate/wander under signal traffic', () => {
		const config: SimulationConfig = {
			...defaultSimulationConfig('mixed-verbosity-pop'),
			creatureCount: 12,
			sensingRadius: 6,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0,
			initialHunger: 0.1,
			initialThirst: 0.1,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			wanderBaseline: DEFAULT_COGNITION_CONFIG.wanderBaseline,
			announceBaseline: DEFAULT_COGNITION_CONFIG.announceBaseline,
			signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
			signalRecencyBoostMax: DEFAULT_COGNITION_CONFIG.signalRecencyBoostMax,
			continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		// Shared unannounced resource + generic heard_signal noise (the real ecology).
		const creatures = base.creatures.map((c, i) => {
			const withoutAnnounce = {
				...c.memory,
				entries: c.memory.entries.filter((e) => e.kind !== 'resource_announcement')
			};
			const memory = rememberHeardSignal(withoutAnnounce, {
				rememberedAt: 0,
				emissionId: `em-noise-${i}`,
				symbolId: 'glyph-0',
				origin: { x: food.position.x + 3, y: food.position.y + 2 }
			});
			return {
				...c,
				// Hold curiosity mid so optional investigation does not dominate the
				// announce-vs-signal split this test attributes to verbosity.
				curiosity: 0.5,
				position: { x: food.position.x, y: food.position.y },
				hunger: 0.1,
				thirst: 0.1,
				energy: 1,
				intention: 'wander' as const,
				action: 'wander' as const,
				movementSpeed: 0,
				nextReconsiderAt: 0,
				pendingArbitrationTrigger: 'relevant_resource_perception_change' as const,
				memory
			};
		});
		const verbosityValues = new Set(creatures.map((c) => c.verbosity));
		expect(verbosityValues.size).toBeGreaterThan(1);

		let state: SimulationState = {
			...base,
			creatures,
			activeEmissions: [],
			recentEmissions: []
		};

		state = stepSimulation(state, config);

		const announcers = state.creatures.filter((c) => c.intention === 'announce_resource');
		const investigators = state.creatures.filter((c) => c.intention === 'investigate_signal');
		const wanderers = state.creatures.filter((c) => c.intention === 'wander');
		const nonAnnouncers = state.creatures.filter((c) => c.intention !== 'announce_resource');

		// Not everyone announces; some still speak; others investigate or wander.
		expect(announcers.length).toBeGreaterThan(0);
		expect(nonAnnouncers.length).toBeGreaterThan(0);
		expect(investigators.length + wanderers.length).toBeGreaterThan(0);

		// Preference-only: every creature still had a valid announce candidate with mapped factors.
		for (const c of state.creatures) {
			const announce = c.lastArbitration?.candidates.find(
				(cand) => cand.intention === 'announce_resource'
			);
			expect(announce?.valid).toBe(true);
			expect(announce?.factors.some((f) => f.code === 'verbosity')).toBe(true);
			expect(announce?.factors.some((f) => f.code === 'speech_weight')).toBe(true);
		}

		// High-verbosity announcers are at least as talkative as non-announcers.
		const maxNonAnnounce = Math.max(...nonAnnouncers.map((c) => c.verbosity));
		const minAnnounce = Math.min(...announcers.map((c) => c.verbosity));
		expect(minAnnounce).toBeGreaterThanOrEqual(maxNonAnnounce);
	});
});

describe('mixed curiosity population (FLAME-85)', () => {
	it('mixes investigate and wander under a shared low-need signal', () => {
		const config: SimulationConfig = {
			...defaultSimulationConfig('mixed-curiosity-pop'),
			creatureCount: 14,
			sensingRadius: 6,
			perceptionIntervalSeconds: 0.01,
			initialHunger: 0.1,
			initialThirst: 0.1,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			wanderBaseline: DEFAULT_COGNITION_CONFIG.wanderBaseline,
			signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
			signalRecencyBoostMax: DEFAULT_COGNITION_CONFIG.signalRecencyBoostMax,
			continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus
		};
		const base = createSimulation(config);
		const origin = { x: base.habitat.home.position.x + 4, y: base.habitat.home.position.y + 2 };
		const creatures = base.creatures.map((c, i) => {
			const memory = rememberHeardSignal(c.memory, {
				rememberedAt: 0,
				emissionId: 'em-shared-ping',
				symbolId: 'glyph-0',
				origin
			});
			return {
				...c,
				// Spread curiosity so optional investigation splits the population.
				curiosity: i / Math.max(1, base.creatures.length - 1),
				position: { x: origin.x - 1, y: origin.y },
				hunger: 0.1,
				thirst: 0.1,
				energy: 1,
				intention: 'wander' as const,
				action: 'wander' as const,
				movementSpeed: 0,
				nextReconsiderAt: 0,
				pendingArbitrationTrigger: 'new_heard_signal_memory' as const,
				memory
			};
		});
		const curiosityValues = new Set(creatures.map((c) => c.curiosity));
		expect(curiosityValues.size).toBeGreaterThan(1);

		let state: SimulationState = {
			...base,
			creatures,
			activeEmissions: [],
			recentEmissions: []
		};
		state = stepSimulation(state, config);

		const investigators = state.creatures.filter((c) => c.intention === 'investigate_signal');
		const wanderers = state.creatures.filter((c) => c.intention === 'wander');
		expect(investigators.length).toBeGreaterThan(0);
		expect(wanderers.length).toBeGreaterThan(0);

		// Preference-only: every creature retained a valid investigate candidate with curiosity factors.
		for (const c of state.creatures) {
			const inv = c.lastArbitration?.candidates.find(
				(cand) => cand.intention === 'investigate_signal'
			);
			expect(inv?.valid).toBe(true);
			expect(inv?.factors.some((f) => f.code === 'curiosity')).toBe(true);
			expect(inv?.factors.some((f) => f.code === 'curiosity_weight')).toBe(true);
			expect(inv?.factors.some((f) => f.code === 'optional_signal_score')).toBe(true);
		}

		// More-curious investigators are at least as curious as non-investigators.
		const maxWanderCuriosity = Math.max(...wanderers.map((c) => c.curiosity));
		const minInvestigateCuriosity = Math.min(...investigators.map((c) => c.curiosity));
		expect(minInvestigateCuriosity).toBeGreaterThanOrEqual(maxWanderCuriosity);
	});

	it('keeps low-curiosity hungry creatures investigating when only search_fallback knowledge exists', () => {
		const config: SimulationConfig = {
			...defaultSimulationConfig('need-driven-curiosity-pop'),
			creatureCount: 8,
			sensingRadius: 0.25,
			perceptionIntervalSeconds: 100,
			initialHunger: 0.9,
			initialThirst: 0.1,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0,
			wanderBaseline: DEFAULT_COGNITION_CONFIG.wanderBaseline,
			signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
			signalRecencyBoostMax: DEFAULT_COGNITION_CONFIG.signalRecencyBoostMax,
			continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus
		};
		const base = createSimulation(config);
		const origin = { x: 2, y: 2 };
		const creatures = base.creatures.map((c) => {
			const memory = rememberHeardSignal(createEmptyMemory(c.memory.capacity), {
				rememberedAt: 0,
				emissionId: 'em-need-ping',
				symbolId: 'glyph-0',
				origin
			});
			return {
				...c,
				curiosity: 0.05,
				position: { x: 0, y: 0 },
				hunger: 0.9,
				thirst: 0.1,
				energy: 1,
				intention: 'wander' as const,
				action: 'wander' as const,
				movementSpeed: 0,
				nextReconsiderAt: 0,
				pendingArbitrationTrigger: 'new_heard_signal_memory' as const,
				memory,
				// Empty recent sense so food knowledge is search_fallback only.
				perception: emptyPerception(0)
			};
		});

		// Remove resources so sensing cannot invent visible targets if it runs.
		const habitat = {
			...base.habitat,
			food: [],
			water: []
		};

		let state: SimulationState = {
			...base,
			habitat,
			creatures,
			activeEmissions: [],
			recentEmissions: []
		};
		state = stepSimulation(state, config);

		const investigators = state.creatures.filter((c) => c.intention === 'investigate_signal');
		// Rational need-driven use: low curiosity must not dump everyone into blind search/wander.
		expect(investigators.length).toBe(state.creatures.length);
		for (const c of state.creatures) {
			const inv = c.lastArbitration?.candidates.find(
				(cand) => cand.intention === 'investigate_signal'
			);
			expect(inv?.factors.some((f) => f.code === 'need_information_value')).toBe(true);
		}
	});
});
