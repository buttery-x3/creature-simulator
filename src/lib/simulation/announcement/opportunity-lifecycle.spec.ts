import { describe, expect, it } from 'vitest';
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

describe('createOpportunitiesFromDiscoveries', () => {
	it('creates independent opportunities for distinct features in feature-id order', () => {
		const result = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [discovery({ featureId: 'food-b' }), discovery({ featureId: 'food-a' })],
			existing: [],
			opportunityCounter: 0,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		expect(result.opportunities).toHaveLength(2);
		expect(result.opportunities[0]!.triggerFeatureId).toBe('food-a');
		expect(result.opportunities[0]!.state).toBe('ready');
		expect(result.opportunities[1]!.triggerFeatureId).toBe('food-b');
		expect(result.opportunities[1]!.state).toBe('queued');
		expect(result.opportunities[0]!.id).not.toBe(result.opportunities[1]!.id);
	});

	it('does not duplicate the same perception episode', () => {
		const d = discovery({ featureId: 'food-1', perceptionEpisodeId: 'ep-1' });
		const first = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [d],
			existing: [],
			opportunityCounter: 0,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		const second = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [d],
			existing: first.opportunities,
			opportunityCounter: first.opportunityCounter,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		expect(second.opportunities).toHaveLength(1);
	});

	it('records overflow outcomes without merging kinds', () => {
		const existing = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [discovery({ featureId: 'food-1' }), discovery({ featureId: 'food-2' })],
			existing: [],
			opportunityCounter: 0,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 2 }
		}).opportunities;

		const result = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [discovery({ featureId: 'food-3', perceptionEpisodeId: 'ep-food-3' })],
			existing,
			opportunityCounter: 2,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 2 }
		});
		expect(result.opportunities).toHaveLength(2);
		expect(result.overflowOutcomes).toHaveLength(1);
		expect(result.overflowOutcomes[0]!.reason).toBe('queue_overflow');
		expect(result.overflowOutcomes[0]!.triggerFeatureId).toBe('food-3');
	});

	it('promotes the next queued opportunity after removal', () => {
		const created = createOpportunitiesFromDiscoveries({
			creatureId: 'creature-0',
			creaturePosition: { x: 0, y: 0 },
			newlyPerceived: [discovery({ featureId: 'food-1' }), discovery({ featureId: 'food-2' })],
			existing: [],
			opportunityCounter: 0,
			config: { maxQueuedAnnouncementOpportunitiesPerCreature: 4 }
		});
		const active = getActiveOpportunity(created.opportunities)!;
		const remaining = removeOpportunityAndPromote(created.opportunities, active.id);
		expect(getActiveOpportunity(remaining)?.triggerFeatureId).toBe('food-2');
		expect(getActiveOpportunity(remaining)?.state).toBe('ready');
	});
});
