/**
 * End-to-end scenarios: successful announcement → memory → rediscovery suppression.
 */

import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { hasResourceAnnouncementMemory } from './query';
import { rememberResourceAnnouncement } from './mutate';
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
		// Place creature on the food so perception + clarity can succeed quickly.
		state = {
			...state,
			creatures: state.creatures.map((c) => ({
				...c,
				position: { x: food.position.x, y: food.position.y },
				movementSpeed: 2,
				nextReconsiderAt: 999
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
				)!;
				expect(entry.opportunityId).toMatch(/^ann-creature-0-/);
				expect(entry.emissionId).toMatch(/^em-creature-0-/);
				expect(entry.resourceKind).toBe('food');
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
			existing: [],
			opportunityCounter: 1,
			memory,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		expect(result.opportunities).toHaveLength(0);
		expect(result.decisions[0]!.reason).toBe('announcement_remembered');
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
			existing: [],
			opportunityCounter: 0,
			memory,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		expect(result.opportunities).toHaveLength(1);
		expect(result.decisions[0]!.reason).toBe('created');
	});
});
