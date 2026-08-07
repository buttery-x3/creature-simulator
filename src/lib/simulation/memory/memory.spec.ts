import { describe, expect, it } from 'vitest';
import {
	createEmptyMemory,
	ensureCreatureMemory,
	isValidCreatureMemory,
	sampleMemoryCapacity
} from './create-memory';
import { countMemoryEntries, hasResourceAnnouncementMemory, memoryUsage } from './query';
import { evictToCapacity, rememberResourceAnnouncement } from './mutate';
import { applySuccessfulAnnouncementMemories } from './apply-announcement-memory';
import { testCreature } from '../test-creature';
import type { SignalEmission } from '../communication/types';
import type { Creature, CreatureMemory } from '../types';

function draft(featureId: string, sequenceHint = 0) {
	return {
		rememberedAt: 10 + sequenceHint,
		featureId,
		resourceKind: 'food' as const,
		opportunityId: `ann-${featureId}`,
		emissionId: `em-${featureId}`
	};
}

describe('ensureCreatureMemory', () => {
	it('returns the same creature when memory and decisions are valid', () => {
		const creature = testCreature();
		expect(ensureCreatureMemory(creature)).toBe(creature);
		expect(isValidCreatureMemory(creature.memory)).toBe(true);
	});

	it('repairs missing memory without throwing', () => {
		const creature = {
			...testCreature(),
			memory: undefined as unknown as CreatureMemory
		} as Creature;
		const fixed = ensureCreatureMemory(creature);
		expect(fixed).not.toBe(creature);
		expect(isValidCreatureMemory(fixed.memory)).toBe(true);
		expect(Array.isArray(fixed.memory.entries)).toBe(true);
		expect(fixed.memory.capacity).toBeGreaterThanOrEqual(1);
	});

	it('repairs missing recentAnnouncementOpportunityDecisions', () => {
		const creature = {
			...testCreature(),
			recentAnnouncementOpportunityDecisions: undefined as unknown as []
		} as Creature;
		const fixed = ensureCreatureMemory(creature);
		expect(Array.isArray(fixed.recentAnnouncementOpportunityDecisions)).toBe(true);
		expect(fixed.recentAnnouncementOpportunityDecisions).toEqual([]);
	});
});

describe('createEmptyMemory / sampleMemoryCapacity', () => {
	it('starts empty with the given capacity', () => {
		const memory = createEmptyMemory(8);
		expect(memory.capacity).toBe(8);
		expect(memory.nextSequence).toBe(0);
		expect(memory.entries).toEqual([]);
		expect(memoryUsage(memory)).toEqual({ used: 0, capacity: 8 });
	});

	it('samples deterministic integer capacities within range', () => {
		const a = sampleMemoryCapacity('demo-seed', 'creature-0', { min: 8, max: 16 });
		const b = sampleMemoryCapacity('demo-seed', 'creature-0', { min: 8, max: 16 });
		expect(a).toBe(b);
		expect(Number.isInteger(a)).toBe(true);
		expect(a).toBeGreaterThanOrEqual(8);
		expect(a).toBeLessThanOrEqual(16);
	});

	it('may vary capacity across creature ids under a non-degenerate range', () => {
		const capacities = new Set(
			Array.from({ length: 12 }, (_, i) =>
				sampleMemoryCapacity('demo-seed', `creature-${i}`, { min: 8, max: 16 })
			)
		);
		// With 12 samples in a 9-value range it is extremely likely to see more than one value.
		expect(capacities.size).toBeGreaterThan(1);
	});
});

describe('rememberResourceAnnouncement', () => {
	it('writes one entry with feature, opportunity and emission ids', () => {
		const memory = rememberResourceAnnouncement(createEmptyMemory(4), draft('food-1'));
		expect(memory.entries).toHaveLength(1);
		expect(memory.entries[0]).toMatchObject({
			kind: 'resource_announcement',
			sequence: 0,
			featureId: 'food-1',
			opportunityId: 'ann-food-1',
			emissionId: 'em-food-1'
		});
		expect(memory.nextSequence).toBe(1);
		expect(hasResourceAnnouncementMemory(memory, 'food-1')).toBe(true);
	});

	it('does not duplicate memory for the same feature', () => {
		let memory = rememberResourceAnnouncement(createEmptyMemory(4), draft('food-1'));
		memory = rememberResourceAnnouncement(memory, {
			...draft('food-1'),
			rememberedAt: 99,
			emissionId: 'em-other'
		});
		expect(memory.entries).toHaveLength(1);
		expect(memory.entries[0]!.emissionId).toBe('em-food-1');
		expect(memory.nextSequence).toBe(1);
	});

	it('evicts oldest first when capacity is exceeded', () => {
		let memory = createEmptyMemory(2);
		memory = rememberResourceAnnouncement(memory, draft('food-1', 0));
		memory = rememberResourceAnnouncement(memory, draft('food-2', 1));
		memory = rememberResourceAnnouncement(memory, draft('food-3', 2));
		expect(memory.entries).toHaveLength(2);
		expect(memory.entries.map((e) => e.featureId)).toEqual(['food-2', 'food-3']);
		expect(hasResourceAnnouncementMemory(memory, 'food-1')).toBe(false);
		expect(hasResourceAnnouncementMemory(memory, 'food-3')).toBe(true);
	});

	it('keeps independent objects across creatures', () => {
		const a = rememberResourceAnnouncement(createEmptyMemory(4), draft('food-1'));
		const b = createEmptyMemory(4);
		expect(a.entries).not.toBe(b.entries);
		expect(countMemoryEntries(b)).toBe(0);
	});

	it('JSON-serialises cleanly', () => {
		const memory = rememberResourceAnnouncement(createEmptyMemory(4), draft('water-1'));
		const roundTrip = JSON.parse(JSON.stringify(memory));
		expect(roundTrip).toEqual(memory);
	});

	it('evictToCapacity is a no-op when already within capacity', () => {
		const memory = rememberResourceAnnouncement(createEmptyMemory(4), draft('food-1'));
		expect(evictToCapacity(memory)).toBe(memory);
	});
});

describe('applySuccessfulAnnouncementMemories', () => {
	function emission(
		partial: Partial<SignalEmission> & Pick<SignalEmission, 'id' | 'senderId'>
	): SignalEmission {
		return {
			id: partial.id,
			symbolId: partial.symbolId ?? 'glyph-0',
			senderId: partial.senderId,
			origin: partial.origin ?? { x: 0, y: 0 },
			emittedAt: partial.emittedAt ?? 3,
			expiresAt: partial.expiresAt ?? 4.5,
			context: 'resource_discovered',
			contextDetail: partial.contextDetail ?? 'food',
			symbolSelectionReason: 'test',
			selectionEvidence: {
				emissionContext: 'food',
				selectedSymbolId: 'glyph-0',
				assignedSymbolId: null,
				mode: 'exploratory',
				candidates: [],
				sample: 0.1,
				usedFallback: false,
				reason: 'test'
			},
			provenance:
				partial.provenance === undefined
					? {
							opportunityId: 'ann-creature-0-0',
							perceptionEpisodeId: 'ep-1',
							triggerFeatureId: 'food-1',
							triggerFeaturePosition: { x: 1, y: 1 },
							discoveredAt: 1,
							clarityEvidence: null
						}
					: partial.provenance
		};
	}

	it('writes memory only for successful announcement-linked emissions', () => {
		const creature = testCreature({ id: 'creature-0' });
		const [updated] = applySuccessfulAnnouncementMemories(
			[creature],
			[emission({ id: 'em-0', senderId: 'creature-0' })],
			3
		);
		expect(updated!.memory.entries).toHaveLength(1);
		expect(updated!.memory.entries[0]).toMatchObject({
			featureId: 'food-1',
			opportunityId: 'ann-creature-0-0',
			emissionId: 'em-0',
			rememberedAt: 3
		});
	});

	it('ignores emissions without announcement provenance', () => {
		const creature = testCreature({ id: 'creature-0' });
		const bare = emission({ id: 'em-0', senderId: 'creature-0', provenance: null });
		const [updated] = applySuccessfulAnnouncementMemories([creature], [bare], 3);
		expect(updated!.memory.entries).toHaveLength(0);
	});
});
