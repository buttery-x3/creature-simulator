import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { testCreature } from '../test-creature';
import type { SimulationState } from '../types';
import { evaluateKindClarity } from './clarity';
import { stepAnnouncement } from './step-announcement';

describe('stepAnnouncement integration', () => {
	it('creates execution state and can emit when intention is announce_resource', () => {
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
				(c.activeAnnouncementExecution !== null ? 1 : 0) +
				(result.emissionRequest !== null ? 1 : 0)
		).toBeGreaterThan(0);
		if (result.emissionRequest) {
			expect(result.emissionRequest.triggerFeatureId).toBe(food.id);
			expect(result.emissionRequest.contextDetail).toBe('food');
		}
	});

	it('does not create execution state when intention is not announce_resource', () => {
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
			intention: 'explore',
			action: 'explore',
			target: { kind: 'point', position: { x: 1, y: 0 } }
		});
		const result = stepAnnouncement({
			creature,
			habitat,
			timeSeconds: 1,
			config
		});
		expect(result.creature.activeAnnouncementExecution).toBeNull();
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
		const open = result.creature.activeAnnouncementExecution;
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
			memory: undefined
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
		// Direct executor call: non-announce intention never opens execution.
		const direct = stepAnnouncement({
			creature,
			habitat: base.habitat,
			timeSeconds: 1,
			config
		});
		expect(direct.creature.activeAnnouncementExecution).toBeNull();
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
				expect(c.activeAnnouncementExecution).toBeNull();
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
			}
		}
	});

	describe('active execution availability gate (featureStillAvailable)', () => {
		function openFoodExecution(
			creatureId: string,
			food: { id: string; position: { x: number; y: number } }
		) {
			return {
				id: `exec-${creatureId}-food`,
				creatureId,
				triggerFeatureId: food.id,
				resourceKind: 'food' as const,
				triggerFeaturePosition: { ...food.position },
				state: 'evaluating' as const,
				speakingTarget: null,
				initialClarity: null
			};
		}

		function openWaterExecution(
			creatureId: string,
			water: { id: string; position: { x: number; y: number } }
		) {
			return {
				id: `exec-${creatureId}-water`,
				creatureId,
				triggerFeatureId: water.id,
				resourceKind: 'water' as const,
				triggerFeaturePosition: { ...water.position },
				state: 'evaluating' as const,
				speakingTarget: null,
				initialClarity: null
			};
		}

		it('does not throw when advancing an active execution with an available trigger', () => {
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
				activeAnnouncementExecution: openFoodExecution('creature-0', food)
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
			const stillOpen = result.creature.activeAnnouncementExecution?.triggerFeatureId === food.id;
			const completedOther =
				result.creature.recentAnnouncementOutcomes.length > 0 &&
				result.creature.recentAnnouncementOutcomes[0]!.reason !== 'invalid_trigger_feature';
			expect(
				stillOpen || completedOther || result.creature.activeAnnouncementExecution !== null
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
				activeAnnouncementExecution: openFoodExecution('creature-0', food)
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
			expect(result.creature.activeAnnouncementExecution).toBeNull();
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
				activeAnnouncementExecution: openWaterExecution('creature-0', water)
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
			expect(result.creature.activeAnnouncementExecution).toBeNull();
			expect(result.creature.recentAnnouncementOutcomes[0]?.reason).toBe('invalid_trigger_feature');
			expect(result.creature.recentAnnouncementOutcomes[0]?.triggerFeatureId).toBe(water.id);
		});
	});

	describe('multi-step repositioning execution survival', () => {
		/**
		 * Food and water far enough that food centre is clear, but the midpoint is not.
		 * Speaking-position search around food should find a clear point.
		 */
		function repositionHabitat() {
			const base = createSimulation(defaultSimulationConfig('ann-reposition-habitat')).habitat;
			return {
				...base,
				food: [
					{
						id: 'food-a',
						kind: 'food' as const,
						position: { x: -3, y: 0 },
						size: { width: 0.5, height: 0.5 },
						amount: 5,
						capacity: 5
					}
				],
				water: [
					{
						id: 'water-b',
						kind: 'water' as const,
						position: { x: 3, y: 0 },
						size: { width: 0.5, height: 0.5 },
						amount: 5,
						capacity: 5
					}
				]
			};
		}

		const repositionConfig = {
			...defaultSimulationConfig('ann-reposition-multi'),
			emissionCooldownSeconds: 0,
			// Midpoint: d_food=d_water=3 → difference 0 → unclear. Food centre: clear.
			resourceAnnouncementClarityMargin: 2,
			speakingPositionSearchRadius: 4,
			speakingPositionSearchResolution: 8,
			sensingRadius: 12,
			creatureRadius: 0.25
		};

		it('keeps the same active execution while moving toward a speaking position', () => {
			const habitat = repositionHabitat();
			const food = habitat.food[0]!;

			// Start equidistant — kind clarity is unclear at this margin.
			let creature = testCreature({
				id: 'creature-0',
				position: { x: 0, y: 0 },
				hunger: 0,
				thirst: 0,
				energy: 1,
				intention: 'announce_resource',
				action: 'move',
				target: { kind: 'feature', featureId: food.id, featureKind: 'food' },
				nextReconsiderAt: 999,
				movementSpeed: 0.5,
				lexicon: { food: 'glyph-0', water: null },
				preferredSymbolId: 'glyph-0'
			});

			const first = stepAnnouncement({
				creature,
				habitat,
				timeSeconds: 1,
				config: repositionConfig
			});
			creature = first.creature;
			const active = creature.activeAnnouncementExecution;
			expect(first.emissionRequest).toBeNull();
			expect(active).not.toBeNull();
			expect(active!.state).toBe('repositioning');
			expect(active!.triggerFeatureId).toBe(food.id);
			expect(active!.speakingTarget).not.toBeNull();
			expect(creature.target?.kind).toBe('point');
			const executionId = active!.id;
			const speakingTarget = active!.speakingTarget!;

			// Subsequent steps with a point target must retain the same execution.
			let sawReevaluation = false;
			let emitted = false;
			for (let step = 0; step < 40; step += 1) {
				// Advance toward the speaking point (physical move between executor ticks).
				const dx = speakingTarget.x - creature.position.x;
				const dy = speakingTarget.y - creature.position.y;
				const dist = Math.hypot(dx, dy);
				if (dist > 0.15) {
					const stepLen = Math.min(0.5, dist);
					creature = {
						...creature,
						position: {
							x: creature.position.x + (dx / dist) * stepLen,
							y: creature.position.y + (dy / dist) * stepLen
						}
					};
				}

				const result = stepAnnouncement({
					creature,
					habitat,
					timeSeconds: 2 + step * 0.1,
					config: repositionConfig
				});
				creature = result.creature;

				if (result.emissionRequest) {
					emitted = true;
					expect(result.emissionRequest.triggerFeatureId).toBe(food.id);
					expect(creature.activeAnnouncementExecution).toBeNull();
					expect(
						creature.recentAnnouncementOutcomes.some(
							(o) =>
								o.reason === 'emission_requested' &&
								o.executionId === executionId &&
								o.repositioningRequired
						)
					).toBe(true);
					break;
				}

				const still = creature.activeAnnouncementExecution;
				expect(still).not.toBeNull();
				expect(still!.id).toBe(executionId);
				expect(still!.triggerFeatureId).toBe(food.id);
				// Target remains a movement point while repositioning.
				if (still!.state === 'repositioning') {
					expect(creature.target?.kind).toBe('point');
					sawReevaluation = true;
				}
			}

			expect(sawReevaluation).toBe(true);
			expect(emitted).toBe(true);
		});

		it('does not treat a bare point target as a new execution without prior state', () => {
			const habitat = repositionHabitat();
			const creature = testCreature({
				id: 'creature-0',
				position: { x: 0, y: 0 },
				intention: 'announce_resource',
				action: 'move',
				// Point target without an existing execution is not a create path.
				target: { kind: 'point', position: { x: 1, y: 1 } },
				activeAnnouncementExecution: null
			});
			const result = stepAnnouncement({
				creature,
				habitat,
				timeSeconds: 1,
				config: repositionConfig
			});
			expect(result.creature.activeAnnouncementExecution).toBeNull();
			expect(result.emissionRequest).toBeNull();
			expect(result.endedPreparation).toBe(true);
		});
	});
});
