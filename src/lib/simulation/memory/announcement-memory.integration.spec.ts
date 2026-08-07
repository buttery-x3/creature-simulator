/**
 * End-to-end scenarios: successful announcement → memory → rediscovery suppression.
 */

import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepCommunication } from '../communication/step-communication';
import type { EmissionRequest } from '../communication/types';
import { stepSimulation } from '../step-simulation';
import { testCreature } from '../test-creature';
import { hasResourceAnnouncementMemory } from './query';
import { rememberResourceAnnouncement } from './mutate';
import { applySuccessfulAnnouncementMemories } from './apply-announcement-memory';
import { createEmptyMemory } from './create-memory';
import { createOpportunitiesFromDiscoveries } from '../announcement/opportunity-lifecycle';

describe('announcement memory integration', () => {
	it('writes memory after a successful resource announcement emission', () => {
		const config = {
			...defaultSimulationConfig('mem-emit'),
			creatureCount: 1,
			sensingRadius: 8,
			perceptionIntervalSeconds: 0.01,
			emissionCooldownSeconds: 0,
			resourceAnnouncementClarityMargin: 0.25,
			speakingPositionSearchRadius: 4,
			// Keep needs low so behaviour stays free to announce.
			initialHunger: 0,
			initialThirst: 0,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0
		};
		let state = createSimulation(config);
		const food = state.habitat.food[0]!;
		// Intention-driven announcement: place on food with announce_resource + feature target.
		state = {
			...state,
			creatures: state.creatures.map((c) => ({
				...c,
				position: { x: food.position.x, y: food.position.y },
				movementSpeed: 2,
				nextReconsiderAt: 999,
				intention: 'announce_resource' as const,
				action: 'move' as const,
				target: {
					kind: 'feature' as const,
					featureId: food.id,
					featureKind: 'food' as const
				},
				// Keep needs low so arbitration does not immediately replace announce.
				hunger: 0,
				thirst: 0,
				energy: 1
			}))
		};

		let remembered = false;
		for (let i = 0; i < 400; i += 1) {
			state = stepSimulation(state, config);
			const c = state.creatures[0]!;
			if (hasResourceAnnouncementMemory(c.memory, food.id)) {
				remembered = true;
				const entry = c.memory.entries.find(
					(e) => e.kind === 'resource_announcement' && e.featureId === food.id
				);
				expect(entry?.kind).toBe('resource_announcement');
				if (entry?.kind === 'resource_announcement') {
					expect(entry.opportunityId).toMatch(/^ann-creature-0-/);
					expect(entry.emissionId).toMatch(/^em-creature-0-/);
					expect(entry.resourceKind).toBe('food');
				}
				// Same feature is not remembered twice after further steps.
				const sameFeatureBefore = c.memory.entries.filter(
					(e) => e.kind === 'resource_announcement' && e.featureId === food.id
				).length;
				state = stepSimulation(state, config);
				const sameFeatureAfter = state.creatures[0]!.memory.entries.filter(
					(e) => e.kind === 'resource_announcement' && e.featureId === food.id
				).length;
				expect(sameFeatureAfter).toBe(sameFeatureBefore);
				break;
			}
		}
		expect(remembered).toBe(true);
	});

	it('suppresses opportunity on rediscovery while memory is retained', () => {
		const memory = rememberResourceAnnouncement(createEmptyMemory(4), {
			rememberedAt: 2,
			featureId: 'food-1',
			resourceKind: 'food',
			opportunityId: 'ann-creature-0-0',
			emissionId: 'em-creature-0-0'
		});
		const result = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [
				{
					featureId: 'food-1',
					resourceKind: 'food',
					position: { x: 1, y: 1 },
					perceptionEpisodeId: 'ep-reenter',
					discoveredAt: 10
				}
			],
			activeOpportunity: null,
			opportunityCounter: 1,
			memory
		});
		expect(result.activeOpportunity).toBeNull();
		expect(result.decisions[0]!.reason).toBe('announcement_remembered');
	});

	it('writes memory for every same-step emission even when history limit is smaller', () => {
		const historyLimit = 2;
		const emitterCount = 5;
		const config = {
			...defaultSimulationConfig('mem-hist-decouple'),
			recentSimulationEmissionHistoryLimit: historyLimit,
			recentEmittedHistoryLimit: historyLimit,
			emissionCooldownSeconds: 0
		};

		const creatures = Array.from({ length: emitterCount }, (_, i) =>
			testCreature({
				id: `creature-${i}`,
				position: { x: i, y: 0 },
				lastEmissionAt: -1,
				emissionCount: 0
			})
		);

		const requests: EmissionRequest[] = creatures.map((c, i) => ({
			senderId: c.id,
			origin: { ...c.position },
			context: 'resource_discovered',
			contextDetail: 'food',
			opportunityId: `ann-${c.id}-0`,
			perceptionEpisodeId: `ep-${c.id}-0`,
			triggerFeatureId: `food-${i}`,
			triggerFeaturePosition: { x: i + 10, y: 0 },
			discoveredAt: 1
		}));

		const bare = createSimulation({ ...config, creatureCount: 0 });
		const before = {
			...bare,
			creatures,
			activeEmissions: [],
			recentEmissions: [],
			timeSeconds: 1
		};

		const { state: afterComm, emittedThisStep } = stepCommunication(before, requests, 1, config);

		expect(emittedThisStep).toHaveLength(emitterCount);
		expect(afterComm.recentEmissions.length).toBeLessThanOrEqual(historyLimit);
		expect(afterComm.recentEmissions.length).toBe(historyLimit);

		const afterMemory = {
			...afterComm,
			creatures: applySuccessfulAnnouncementMemories(afterComm.creatures, emittedThisStep, 1)
		};

		for (let i = 0; i < emitterCount; i += 1) {
			const creature = afterMemory.creatures.find((c) => c.id === `creature-${i}`)!;
			const featureId = `food-${i}`;
			expect(hasResourceAnnouncementMemory(creature.memory, featureId)).toBe(true);
			const entry = creature.memory.entries.find(
				(e) => e.kind === 'resource_announcement' && e.featureId === featureId
			);
			expect(entry?.kind).toBe('resource_announcement');
			if (entry?.kind === 'resource_announcement') {
				expect(entry.opportunityId).toBe(`ann-creature-${i}-0`);
				expect(entry.emissionId).toBe(`em-creature-${i}-0`);
			}
		}

		// Same authoritative memories if history limit is large enough to retain all.
		const wideConfig = { ...config, recentSimulationEmissionHistoryLimit: 24 };
		const wide = stepCommunication(before, requests, 1, wideConfig);
		const afterWide = applySuccessfulAnnouncementMemories(
			wide.state.creatures,
			wide.emittedThisStep,
			1
		);
		for (let i = 0; i < emitterCount; i += 1) {
			const a = afterMemory.creatures.find((c) => c.id === `creature-${i}`)!;
			const b = afterWide.find((c) => c.id === `creature-${i}`)!;
			expect(a.memory.entries).toEqual(b.memory.entries);
		}
	});

	it('allows rediscovery after the announcement memory is evicted', () => {
		let memory = createEmptyMemory(1);
		memory = rememberResourceAnnouncement(memory, {
			rememberedAt: 1,
			featureId: 'food-old',
			resourceKind: 'food',
			opportunityId: 'ann-old',
			emissionId: 'em-old'
		});
		// Evict food-old by inserting another entry.
		memory = rememberResourceAnnouncement(memory, {
			rememberedAt: 2,
			featureId: 'food-new',
			resourceKind: 'food',
			opportunityId: 'ann-new',
			emissionId: 'em-new'
		});
		expect(hasResourceAnnouncementMemory(memory, 'food-old')).toBe(false);

		const result = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [
				{
					featureId: 'food-old',
					resourceKind: 'food',
					position: { x: 1, y: 1 },
					perceptionEpisodeId: 'ep-after-evict',
					discoveredAt: 20
				}
			],
			activeOpportunity: null,
			opportunityCounter: 0,
			memory
		});
		expect(result.activeOpportunity).not.toBeNull();
		expect(result.decisions[0]!.reason).toBe('created');
	});
});
