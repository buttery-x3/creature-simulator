import { describe, expect, it } from 'vitest';
import { createEmptyMemory } from '../memory/create-memory';
import { rememberResourceAnnouncement } from '../memory/mutate';
import {
	createOpportunitiesFromDiscoveries,
	getActiveOpportunity,
	removeOpportunityAndPromote
} from './opportunity-lifecycle';
import type { NewlyPerceivedResource } from './types';

function discovery(
	partial: Partial<NewlyPerceivedResource> & Pick<NewlyPerceivedResource, 'featureId'>
): NewlyPerceivedResource {
	return {
		featureId: partial.featureId,
		resourceKind: partial.resourceKind ?? 'food',
		position: partial.position ?? { x: 1, y: 2 },
		perceptionEpisodeId: partial.perceptionEpisodeId ?? `ep-${partial.featureId}-0`,
		discoveredAt: partial.discoveredAt ?? 1
	};
}

const emptyMemory = () => createEmptyMemory(10);

function createOpts(
	partial: Partial<Parameters<typeof createOpportunitiesFromDiscoveries>[0]> &
		Pick<Parameters<typeof createOpportunitiesFromDiscoveries>[0], 'newlyPerceived'>
) {
	return createOpportunitiesFromDiscoveries({
		creatureId: 'creature-0',
		creaturePosition: { x: 0, y: 0 },
		existing: [],
		opportunityCounter: 0,
		memory: emptyMemory(),
		config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 },
		...partial
	});
}

describe('createOpportunitiesFromDiscoveries', () => {
	it('creates independent opportunities for distinct features in feature-id order', () => {
		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-b' }), discovery({ featureId: 'food-a' })]
		});
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]!.triggerFeatureId).toBe('food-a');
		expect(result.opportunities[0]!.state).toBe('ready');
		expect(result.opportunities[1]!.triggerFeatureId).toBe('food-b');
		expect(result.opportunities[1]!.state).toBe('queued');
		expect(result.opportunities[0]!.id).not.toBe(result.opportunities[1]!.id);
		expect(result.decisions.every((d) => d.reason === 'created')).toBe(true);
	});

	it('does not duplicate the same perception episode', () => {
		const d = discovery({ featureId: 'food-1', perceptionEpisodeId: 'ep-1' });
		const first = createOpts({ newlyPerceived: [d] });
		const second = createOpts({
			newlyPerceived: [d],
			existing: first.opportunities,
			opportunityCounter: first.opportunityCounter
		});
		expect(second.opportunities).toHaveLength(1);
		// Open feature check fires before same_episode when opportunity still open.
		expect(second.decisions[0]!.reason).toBe('open_or_queued');
	});

	it('suppresses rediscovery when announcement memory is retained', () => {
		const memory = rememberResourceAnnouncement(emptyMemory(), {
			rememberedAt: 5,
			featureId: 'food-1',
			resourceKind: 'food',
			opportunityId: 'ann-creature-0-0',
			emissionId: 'em-creature-0-0'
		});
		const result = createOpts({
			newlyPerceived: [
				discovery({ featureId: 'food-1', perceptionEpisodeId: 'ep-food-1-reenter' })
			],
			memory
		});
		expect(result.opportunities).toHaveLength(0);
		expect(result.decisions).toEqual([
			expect.objectContaining({
				featureId: 'food-1',
				reason: 'announcement_remembered'
			})
		]);
	});

	it('does not let food-1 memory suppress food-2', () => {
		const memory = rememberResourceAnnouncement(emptyMemory(), {
			rememberedAt: 5,
			featureId: 'food-1',
			resourceKind: 'food',
			opportunityId: 'ann-0',
			emissionId: 'em-0'
		});
		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-2' })],
			memory
		});
		expect(result.opportunities).toHaveLength(1);
		expect(result.opportunities[0]!.triggerFeatureId).toBe('food-2');
		expect(result.decisions[0]!.reason).toBe('created');
	});

	it('does not create a second open opportunity for the same feature', () => {
		const first = createOpts({ newlyPerceived: [discovery({ featureId: 'food-1' })] });
		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-1', perceptionEpisodeId: 'ep-food-1-new' })],
			existing: first.opportunities,
			opportunityCounter: first.opportunityCounter
		});
		expect(result.opportunities).toHaveLength(1);
		expect(result.decisions[0]!.reason).toBe('open_or_queued');
	});

	it('records overflow outcomes without merging kinds', () => {
		const existing = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-1' }), discovery({ featureId: 'food-2' })],
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 2 }
		}).opportunities;

		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-3', perceptionEpisodeId: 'ep-food-3' })],
			existing,
			opportunityCounter: 2,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 2 }
		});
		expect(result.opportunities).toHaveLength(2);
		expect(result.overflowOutcomes).toHaveLength(1);
		expect(result.overflowOutcomes[0]!.reason).toBe('queue_overflow');
		expect(result.overflowOutcomes[0]!.triggerFeatureId).toBe('food-3');
		expect(result.decisions[0]!.reason).toBe('queue_overflow');
	});

	it('promotes the next queued opportunity after removal', () => {
		const created = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-1' }), discovery({ featureId: 'food-2' })]
		});
		const active = getActiveOpportunity(created.opportunities)!;
		const remaining = removeOpportunityAndPromote(created.opportunities, active.id);
		expect(getActiveOpportunity(remaining)?.triggerFeatureId).toBe('food-2');
		expect(getActiveOpportunity(remaining)?.state).toBe('ready');
	});
});
