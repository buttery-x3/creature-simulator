import { describe, expect, it } from 'vitest';
import { createEmptyMemory } from '../memory/create-memory';
import { rememberResourceAnnouncement } from '../memory/mutate';
import { createOpportunitiesFromDiscoveries, getActiveOpportunity } from './opportunity-lifecycle';
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
		activeOpportunity: null,
		opportunityCounter: 0,
		memory: emptyMemory(),
		...partial
	});
}

describe('createOpportunitiesFromDiscoveries', () => {
	it('selects one opportunity for simultaneous discoveries in feature-id order', () => {
		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-b' }), discovery({ featureId: 'food-a' })]
		});
		expect(result.activeOpportunity).not.toBeNull();
		expect(result.activeOpportunity!.triggerFeatureId).toBe('food-a');
		expect(result.activeOpportunity!.state).toBe('ready');
		expect(result.decisions).toEqual([
			expect.objectContaining({ featureId: 'food-a', reason: 'created' }),
			expect.objectContaining({
				featureId: 'food-b',
				reason: 'not_selected_same_perception_pass'
			})
		]);
	});

	it('does not create a second opportunity while one is already active', () => {
		const first = createOpts({ newlyPerceived: [discovery({ featureId: 'food-1' })] });
		const result = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-2' })],
			activeOpportunity: first.activeOpportunity,
			opportunityCounter: first.opportunityCounter
		});
		expect(result.activeOpportunity!.triggerFeatureId).toBe('food-1');
		expect(result.decisions[0]!.reason).toBe('announcement_busy');
	});

	it('records already_active when the same feature rediscovers while open', () => {
		const d = discovery({ featureId: 'food-1', perceptionEpisodeId: 'ep-1' });
		const first = createOpts({ newlyPerceived: [d] });
		const second = createOpts({
			newlyPerceived: [d],
			activeOpportunity: first.activeOpportunity,
			opportunityCounter: first.opportunityCounter
		});
		expect(second.activeOpportunity!.id).toBe(first.activeOpportunity!.id);
		expect(second.decisions[0]!.reason).toBe('already_active');
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
		expect(result.activeOpportunity).toBeNull();
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
		expect(result.activeOpportunity!.triggerFeatureId).toBe('food-2');
		expect(result.decisions[0]!.reason).toBe('created');
	});

	it('does not promote a prior simultaneous discovery after the active one is cleared', () => {
		const created = createOpts({
			newlyPerceived: [discovery({ featureId: 'food-1' }), discovery({ featureId: 'food-2' })]
		});
		expect(created.activeOpportunity!.triggerFeatureId).toBe('food-1');
		// Completing the active opportunity leaves null — no deferred food-2 task.
		const afterClear = getActiveOpportunity(null);
		expect(afterClear).toBeNull();
		const later = createOpts({
			newlyPerceived: [],
			activeOpportunity: null,
			opportunityCounter: created.opportunityCounter
		});
		expect(later.activeOpportunity).toBeNull();
	});
});
