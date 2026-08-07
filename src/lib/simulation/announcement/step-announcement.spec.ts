import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { testCreature } from '../test-creature';
import type { SimulationState } from '../types';
import { evaluateKindClarity } from './clarity';
import { stepAnnouncement } from './step-announcement';

describe('stepAnnouncement integration', () => {
	it('creates an opportunity and can emit when intention is announce_resource', () => {
		const config = {
			...defaultSimulationConfig('ann-needless'),
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0.5,
			creatureCount: 1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const water = base.habitat.water[0];
		const position = { x: food.position.x, y: food.position.y };
		if (water) {
			const clarity = evaluateKindClarity({
				position,
				announcedKind: 'food',
				candidates: [
					{ featureId: food.id, resourceKind: 'food', position: food.position },
					{ featureId: water.id, resourceKind: 'water', position: water.position }
				],
				clarityMargin: config.resourceAnnouncementClarityMargin
			});
			void clarity;
		}

		const creature = testCreature({
			id: 'creature-0',
			position,
			hunger: 0,
			thirst: 0,
			energy: 1,
			intention: 'announce_resource',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
			nextReconsiderAt: 999,
			movementSpeed: 0,
			lexicon: { food: 'glyph-3', water: null },
			preferredSymbolId: 'glyph-0'
		});

		const result = stepAnnouncement({
			creature,
			habitat: base.habitat,
			timeSeconds: 1,
			config
		});
		const c = result.creature;
		expect(
			c.recentAnnouncementOutcomes.length +
				(c.activeAnnouncementOpportunity !== null ? 1 : 0) +
				(result.emissionRequest !== null ? 1 : 0)
		).toBeGreaterThan(0);
		if (result.emissionRequest) {
			expect(result.emissionRequest.triggerFeatureId).toBe(food.id);
			expect(result.emissionRequest.contextDetail).toBe('food');
		}
	});

	it('does not create opportunity when intention is not announce_resource', () => {
		const config = {
			...defaultSimulationConfig('ann-no-intent'),
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0
		};
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			intention: 'wander',
			action: 'wander',
			target: { kind: 'point', position: { x: 1, y: 0 } }
		});
		const result = stepAnnouncement({
			creature,
			habitat,
			timeSeconds: 1,
			config
		});
		expect(result.creature.activeAnnouncementOpportunity).toBeNull();
		expect(result.emissionRequest).toBeNull();
		expect(result.endedPreparation).toBe(false);
	});

	it('keeps trigger feature id from feature target', () => {
		const config = defaultSimulationConfig('ann-trigger');
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			intention: 'announce_resource',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
		});
		const result = stepAnnouncement({
			creature,
			habitat,
			timeSeconds: 1,
			config
		});
		const open = result.creature.activeAnnouncementOpportunity;
		const done = result.creature.recentAnnouncementOutcomes[0];
		const triggerId = open?.triggerFeatureId ?? done?.triggerFeatureId;
		expect(triggerId).toBe(food.id);
		expect(open?.resourceKind ?? done?.resourceKind).toBe('food');
	});

	it('does not throw when creature.memory is missing (regression for HMR/stale state)', () => {
		const config = defaultSimulationConfig('ann-missing-memory');
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const base = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			intention: 'announce_resource',
			action: 'move',
			target: { kind: 'feature', featureId: food.id, featureKind: 'food' }
		});
		const broken = {
			...base,
			memory: undefined,
			recentAnnouncementOpportunityDecisions: undefined
		} as unknown as typeof base;

		expect(() =>
			stepAnnouncement({
				creature: broken,
				habitat,
				timeSeconds: 1,
				config
			})
		).not.toThrow();

		const result = stepAnnouncement({
			creature: broken,
			habitat,
			timeSeconds: 1,
			config
		});
		expect(Array.isArray(result.creature.memory.entries)).toBe(true);
		expect(result.creature.memory.capacity).toBeGreaterThanOrEqual(1);
		expect(Array.isArray(result.creature.recentAnnouncementOpportunityDecisions)).toBe(true);
	});

	it('does not create announcement while investigating (intention is investigate_signal)', () => {
		const config = {
			...defaultSimulationConfig('ann-invest'),
			sensingRadius: 10,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			creatureCount: 1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			movementSpeed: 0,
			intention: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: { x: food.position.x + 0.5, y: food.position.y } },
			activeInvestigation: {
				emissionId: 'em-lock',
				symbolId: 'glyph-0',
				origin: { x: food.position.x + 0.5, y: food.position.y },
				startedAt: 0
			},
			nextReconsiderAt: 999
		});
		// Direct executor call: non-announce intention never opens opportunity.
		const direct = stepAnnouncement({
			creature,
			habitat: base.habitat,
			timeSeconds: 1,
			config
		});
		expect(direct.creature.activeAnnouncementOpportunity).toBeNull();
		expect(direct.emissionRequest).toBeNull();

		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};
		for (let i = 0; i < 15; i += 1) {
			state = stepSimulation(state, config);
			const c = state.creatures[0]!;
			// Only while still investigating should we assert no announce executor.
			if (c.intention === 'investigate_signal') {
				expect(c.activeAnnouncementOpportunity).toBeNull();
			}
		}
	});

	it('keeps memory defined across multi-step simulation', () => {
		const config = {
			...defaultSimulationConfig('ann-memory-stable'),
			creatureCount: 1,
			sensingRadius: 8,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			initialHunger: 0,
			initialThirst: 0,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0
		};
		let state = createSimulation(config);
		const food = state.habitat.food[0]!;
		state = {
			...state,
			creatures: state.creatures.map((c) => ({
				...c,
				position: { ...food.position },
				movementSpeed: 0
			}))
		};
		for (let i = 0; i < 60; i += 1) {
			state = stepSimulation(state, config);
			for (const c of state.creatures) {
				expect(c.memory).toBeDefined();
				expect(Array.isArray(c.memory.entries)).toBe(true);
				expect(Array.isArray(c.recentAnnouncementOpportunityDecisions)).toBe(true);
			}
		}
	});

	describe('active opportunity availability gate (featureStillAvailable)', () => {
		function openFoodOpportunity(
			creatureId: string,
			food: { id: string; position: { x: number; y: number } }
		) {
			return {
				id: `opp-${creatureId}-food`,
				creatureId,
				triggerFeatureId: food.id,
				resourceKind: 'food' as const,
				triggerFeaturePosition: { ...food.position },
				perceptionEpisodeId: `ep-${food.id}-reg`,
				discoveredAt: 1,
				discoveryCreaturePosition: { ...food.position },
				state: 'ready' as const,
				speakingTarget: null,
				initialClarity: null
			};
		}

		function openWaterOpportunity(
			creatureId: string,
			water: { id: string; position: { x: number; y: number } }
		) {
			return {
				id: `opp-${creatureId}-water`,
				creatureId,
				triggerFeatureId: water.id,
				resourceKind: 'water' as const,
				triggerFeaturePosition: { ...water.position },
				perceptionEpisodeId: `ep-${water.id}-reg`,
				discoveredAt: 1,
				discoveryCreaturePosition: { ...water.position },
				state: 'ready' as const,
				speakingTarget: null,
				initialClarity: null
			};
		}

		it('does not throw when advancing an active opportunity with an available trigger', () => {
			const config = {
				...defaultSimulationConfig('ann-avail-ok'),
				emissionCooldownSeconds: 100,
				resourceAnnouncementClarityMargin: 0
			};
			const habitat = createSimulation(config).habitat;
			const food = habitat.food[0]!;
			const creature = testCreature({
				id: 'creature-0',
				position: { ...food.position },
				intention: 'announce_resource',
				action: 'move',
				target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
				lastEmissionAt: 1.5,
				activeAnnouncementOpportunity: openFoodOpportunity('creature-0', food)
			});

			expect(() =>
				stepAnnouncement({
					creature,
					habitat,
					timeSeconds: 2,
					config
				})
			).not.toThrow();

			const result = stepAnnouncement({
				creature,
				habitat,
				timeSeconds: 2,
				config
			});
			expect(
				result.creature.recentAnnouncementOutcomes.some(
					(o) => o.reason === 'invalid_trigger_feature'
				)
			).toBe(false);
			const stillOpen = result.creature.activeAnnouncementOpportunity?.triggerFeatureId === food.id;
			const completedOther =
				result.creature.recentAnnouncementOutcomes.length > 0 &&
				result.creature.recentAnnouncementOutcomes[0]!.reason !== 'invalid_trigger_feature';
			expect(
				stillOpen || completedOther || result.creature.activeAnnouncementOpportunity !== null
			).toBe(true);
		});

		it('invalidates when the food trigger was removed (depleted), without throwing', () => {
			const config = defaultSimulationConfig('ann-avail-food-gone');
			const habitat = createSimulation(config).habitat;
			const food = habitat.food[0]!;
			const habitatWithoutFood = {
				...habitat,
				food: habitat.food.filter((f) => f.id !== food.id)
			};
			const creature = testCreature({
				id: 'creature-0',
				position: { ...food.position },
				intention: 'announce_resource',
				action: 'move',
				target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
				activeAnnouncementOpportunity: openFoodOpportunity('creature-0', food)
			});

			expect(() =>
				stepAnnouncement({
					creature,
					habitat: habitatWithoutFood,
					timeSeconds: 2,
					config
				})
			).not.toThrow();

			const result = stepAnnouncement({
				creature,
				habitat: habitatWithoutFood,
				timeSeconds: 2,
				config
			});
			expect(result.creature.activeAnnouncementOpportunity).toBeNull();
			expect(result.creature.recentAnnouncementOutcomes[0]?.reason).toBe('invalid_trigger_feature');
			expect(result.creature.recentAnnouncementOutcomes[0]?.triggerFeatureId).toBe(food.id);
			expect(result.endedPreparation).toBe(true);
		});

		it('invalidates empty water basins (amount 0) even though the feature still exists', () => {
			const config = defaultSimulationConfig('ann-avail-water-empty');
			const habitat = createSimulation(config).habitat;
			const water = habitat.water[0]!;
			const habitatEmptyBasin = {
				...habitat,
				water: habitat.water.map((w) => (w.id === water.id ? { ...w, amount: 0 } : { ...w }))
			};
			const creature = testCreature({
				id: 'creature-0',
				position: { ...water.position },
				intention: 'announce_resource',
				action: 'move',
				target: { kind: 'feature', featureId: water.id, featureKind: 'water' },
				activeAnnouncementOpportunity: openWaterOpportunity('creature-0', water)
			});

			expect(() =>
				stepAnnouncement({
					creature,
					habitat: habitatEmptyBasin,
					timeSeconds: 2,
					config
				})
			).not.toThrow();

			const result = stepAnnouncement({
				creature,
				habitat: habitatEmptyBasin,
				timeSeconds: 2,
				config
			});
			expect(habitatEmptyBasin.water.some((w) => w.id === water.id)).toBe(true);
			expect(result.creature.activeAnnouncementOpportunity).toBeNull();
			expect(result.creature.recentAnnouncementOutcomes[0]?.reason).toBe('invalid_trigger_feature');
			expect(result.creature.recentAnnouncementOutcomes[0]?.triggerFeatureId).toBe(water.id);
		});
	});
});
