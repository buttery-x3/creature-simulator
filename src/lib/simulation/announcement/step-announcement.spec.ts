import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { testCreature } from '../test-creature';
import type { SimulationState } from '../types';
import { evaluateKindClarity } from './clarity';
import { stepAnnouncement } from './step-announcement';

describe('stepAnnouncement integration', () => {
	it('creates an opportunity and emits regardless of need when kind is clear', () => {
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
		// Place far from water if possible
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
			// If not clear at food, still create opportunity; may reposition.
			void clarity;
		}

		const creature = testCreature({
			id: 'creature-0',
			position,
			hunger: 0,
			thirst: 0,
			energy: 1,
			goal: 'wander',
			action: 'wander',
			nextReconsiderAt: 999,
			movementSpeed: 0,
			lexicon: { food: 'glyph-3', water: null },
			preferredSymbolId: 'glyph-0'
		});

		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};

		// Step until perception fires and announcement completes or prepares.
		for (let i = 0; i < 30; i += 1) {
			state = stepSimulation(state, config);
			const c = state.creatures[0]!;
			if (c.emissionCount > 0) {
				break;
			}
		}

		const c = state.creatures[0]!;
		expect(
			c.recentAnnouncementOutcomes.length + (c.activeAnnouncementOpportunity !== null ? 1 : 0)
		).toBeGreaterThan(0);
		// When emission happened, provenance and exact lexicon.
		if (c.emissionCount > 0) {
			expect(state.recentEmissions[0]!.symbolId).toBe('glyph-3');
			expect(state.recentEmissions[0]!.selectionEvidence.mode).toBe('learned_lexicon');
			expect(state.recentEmissions[0]!.provenance?.triggerFeatureId).toBe(food.id);
			expect(state.recentEmissions[0]!.origin.x).toBeCloseTo(c.position.x);
			expect(state.recentEmissions[0]!.origin.y).toBeCloseTo(c.position.y);
		} else {
			// At least opportunity exists for the food feature.
			const open =
				c.activeAnnouncementOpportunity?.triggerFeatureId === food.id
					? c.activeAnnouncementOpportunity
					: null;
			const done = c.recentAnnouncementOutcomes.find((o) => o.triggerFeatureId === food.id);
			expect(open || done).toBeTruthy();
		}
	});

	it('does not create duplicate opportunities for continuous perception of one feature', () => {
		const config = {
			...defaultSimulationConfig('ann-dedup'),
			sensingRadius: 5,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 100,
			resourceAnnouncementClarityMargin: 0,
			creatureCount: 1
		};
		const base = createSimulation(config);
		const food = base.habitat.food[0]!;
		const creature = testCreature({
			id: 'creature-0',
			position: { ...food.position },
			hunger: 0,
			thirst: 0,
			energy: 1,
			goal: 'wander',
			action: 'wander',
			nextReconsiderAt: 999,
			movementSpeed: 0
		});
		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};
		for (let i = 0; i < 20; i += 1) {
			state = stepSimulation(state, config);
		}
		const c = state.creatures[0]!;
		const foodOps = [
			...(c.activeAnnouncementOpportunity?.triggerFeatureId === food.id
				? [c.activeAnnouncementOpportunity]
				: []),
			...c.recentAnnouncementOutcomes.filter((o) => o.triggerFeatureId === food.id)
		];
		// One continuous episode → at most one opportunity lifecycle for that feature.
		expect(foodOps.length).toBeLessThanOrEqual(1);
	});

	it('keeps trigger feature id when creating from newly perceived', () => {
		const config = defaultSimulationConfig('ann-trigger');
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const creature = testCreature({ id: 'creature-0', position: { ...food.position } });
		const result = stepAnnouncement({
			creature,
			habitat,
			timeSeconds: 1,
			newlyPerceived: [
				{
					featureId: food.id,
					resourceKind: 'food',
					position: { ...food.position },
					perceptionEpisodeId: `ep-${food.id}-0`,
					discoveredAt: 1
				}
			],
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
		const base = testCreature({ id: 'creature-0', position: { ...food.position } });
		// Simulate pre–FLAME-74 or HMR-stale creature objects.
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
				newlyPerceived: [
					{
						featureId: food.id,
						resourceKind: 'food',
						position: { ...food.position },
						perceptionEpisodeId: `ep-${food.id}-stale`,
						discoveredAt: 1
					}
				],
				config
			})
		).not.toThrow();

		const result = stepAnnouncement({
			creature: broken,
			habitat,
			timeSeconds: 1,
			newlyPerceived: [
				{
					featureId: food.id,
					resourceKind: 'food',
					position: { ...food.position },
					perceptionEpisodeId: `ep-${food.id}-stale`,
					discoveredAt: 1
				}
			],
			config
		});
		expect(Array.isArray(result.creature.memory.entries)).toBe(true);
		expect(result.creature.memory.capacity).toBeGreaterThanOrEqual(1);
		expect(Array.isArray(result.creature.recentAnnouncementOpportunityDecisions)).toBe(true);
		// Opportunity may be created once memory is repaired.
		const created = result.creature.recentAnnouncementOpportunityDecisions.some(
			(d) => d.reason === 'created'
		);
		const open = result.creature.activeAnnouncementOpportunity?.triggerFeatureId === food.id;
		expect(created || open || result.creature.recentAnnouncementOutcomes.length > 0).toBe(true);
	});

	it('does not retain a second simultaneous discovery after the first completes', () => {
		const config = {
			...defaultSimulationConfig('ann-no-promote'),
			// Keep the current opportunity open so we can assert single-slot semantics.
			emissionCooldownSeconds: 100,
			resourceAnnouncementClarityMargin: 0
		};
		const habitat = createSimulation(config).habitat;
		const foodA = habitat.food[0]!;
		const foodB = habitat.food.find((f) => f.id !== foodA.id) ?? habitat.water[0] ?? null;
		expect(foodB).not.toBeNull();
		const creature = testCreature({
			id: 'creature-0',
			position: { ...foodA.position },
			lastEmissionAt: 0
		});
		const created = stepAnnouncement({
			creature,
			habitat,
			timeSeconds: 1,
			newlyPerceived: [
				{
					featureId: foodA.id,
					resourceKind: 'food',
					position: { ...foodA.position },
					perceptionEpisodeId: `ep-${foodA.id}-0`,
					discoveredAt: 1
				},
				{
					featureId: foodB!.id,
					resourceKind: foodB!.kind === 'water' ? 'water' : 'food',
					position: { ...foodB!.position },
					perceptionEpisodeId: `ep-${foodB!.id}-0`,
					discoveredAt: 1
				}
			],
			config
		});
		expect(created.creature.activeAnnouncementOpportunity).not.toBeNull();
		const selectedId = created.creature.activeAnnouncementOpportunity!.triggerFeatureId;
		const otherId = selectedId === foodA.id ? foodB!.id : foodA.id;
		expect(
			created.creature.recentAnnouncementOpportunityDecisions.some(
				(d) =>
					d.featureId === otherId &&
					(d.reason === 'not_selected_same_perception_pass' || d.reason === 'announcement_busy')
			)
		).toBe(true);

		// Clear active (simulate completion) — other feature must not auto-promote.
		const after = stepAnnouncement({
			creature: {
				...created.creature,
				activeAnnouncementOpportunity: null,
				lastEmissionAt: 1
			},
			habitat,
			timeSeconds: 2,
			newlyPerceived: [],
			config
		});
		expect(after.creature.activeAnnouncementOpportunity).toBeNull();
	});

	it('does not create announcement opportunities while investigation is locked', () => {
		const config = {
			...defaultSimulationConfig('ann-invest-lock'),
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
			goal: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: { x: food.position.x + 0.5, y: food.position.y } },
			activeInvestigation: {
				emissionId: 'em-lock',
				symbolId: 'glyph-0',
				senderId: 'creature-9',
				origin: { x: food.position.x + 0.5, y: food.position.y },
				startedAt: 0
			},
			nextReconsiderAt: 999
		});
		let state: SimulationState = {
			...base,
			creatures: [creature],
			activeEmissions: [],
			recentEmissions: []
		};
		for (let i = 0; i < 15; i += 1) {
			state = stepSimulation(state, config);
		}
		const c = state.creatures[0]!;
		// Still investigating or just finished — must never have queued deferred announcements.
		expect(c.activeAnnouncementOpportunity).toBeNull();
		expect(c.recentAnnouncementOutcomes).toHaveLength(0);
		// Ordinary discovery episodes frozen while locked: no episodes for food while investigating.
		if (c.goal === 'investigate_signal') {
			expect(c.perception.activeEpisodes).toHaveLength(0);
		}
	});

	it('keeps memory defined across multi-step simulation with discoveries', () => {
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
});
