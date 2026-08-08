import { describe, expect, it } from 'vitest';
import {
	createEmptyMemory,
	ensureCreatureMemory,
	isValidCreatureMemory,
	sampleMemoryCapacity
} from './create-memory';
import {
	countMemoryEntries,
	findHeardSignalMemory,
	findNewestUsableResourceObservation,
	findResourceObservationMemory,
	hasHeardSignalMemory,
	hasResourceAnnouncementMemory,
	hasResourceObservationMemory,
	listHeardSignalMemories,
	listResourceObservations,
	memoryUsage
} from './query';
import {
	evictToCapacity,
	forgetHeardSignal,
	rememberHeardSignal,
	rememberResourceAnnouncement,
	rememberResourceObservation
} from './mutate';
import { applySuccessfulAnnouncementMemories } from './apply-announcement-memory';
import { applyHeardSignalMemories, applyResourceObservationMemories } from './apply-sensory-memory';
import { testCreature } from '../test-creature';
import type { SignalEmission } from '../communication/types';
import type { Creature, CreatureMemory } from '../types';
import type { Habitat } from '$lib/habitat';

function draft(featureId: string, sequenceHint = 0) {
	return {
		rememberedAt: 10 + sequenceHint,
		featureId,
		resourceKind: 'food' as const,
		emissionId: `em-${featureId}`
	};
}

describe('ensureCreatureMemory', () => {
	it('returns the same creature when memory is valid', () => {
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
	it('writes one entry with feature and emission ids', () => {
		const memory = rememberResourceAnnouncement(createEmptyMemory(4), draft('food-1'));
		expect(memory.entries).toHaveLength(1);
		expect(memory.entries[0]).toMatchObject({
			kind: 'resource_announcement',
			sequence: 0,
			featureId: 'food-1',
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
		expect(memory.entries[0]!.kind).toBe('resource_announcement');
		if (memory.entries[0]!.kind === 'resource_announcement') {
			expect(memory.entries[0]!.emissionId).toBe('em-food-1');
		}
		expect(memory.nextSequence).toBe(1);
	});

	it('evicts oldest first when capacity is exceeded', () => {
		let memory = createEmptyMemory(2);
		memory = rememberResourceAnnouncement(memory, draft('food-1', 0));
		memory = rememberResourceAnnouncement(memory, draft('food-2', 1));
		memory = rememberResourceAnnouncement(memory, draft('food-3', 2));
		expect(memory.entries).toHaveLength(2);
		expect(
			memory.entries.map((e) => (e.kind === 'resource_announcement' ? e.featureId : null))
		).toEqual(['food-2', 'food-3']);
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
							triggerFeatureId: 'food-1',
							triggerFeaturePosition: { x: 1, y: 1 },
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

describe('rememberResourceObservation', () => {
	it('writes one food observation with position', () => {
		const memory = rememberResourceObservation(createEmptyMemory(4), {
			rememberedAt: 5,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 2, y: 3 },
			empty: false
		});
		expect(memory.entries).toHaveLength(1);
		expect(memory.entries[0]).toMatchObject({
			kind: 'resource_observation',
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 2, y: 3 },
			empty: false,
			sequence: 0
		});
		expect(hasResourceObservationMemory(memory, 'food-1')).toBe(true);
	});

	it('refreshes the same feature without duplicating', () => {
		let memory = rememberResourceObservation(createEmptyMemory(4), {
			rememberedAt: 1,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 0, y: 0 },
			empty: false
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 9,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 4, y: 5 },
			empty: false
		});
		expect(memory.entries).toHaveLength(1);
		const found = findResourceObservationMemory(memory, 'food-1');
		expect(found).toMatchObject({
			rememberedAt: 9,
			position: { x: 4, y: 5 },
			sequence: 1
		});
		expect(memory.nextSequence).toBe(2);
	});

	it('updates water empty state on the same basin memory', () => {
		let memory = rememberResourceObservation(createEmptyMemory(4), {
			rememberedAt: 1,
			featureId: 'water-1',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: false
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'water-1',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: true
		});
		expect(countMemoryEntries(memory, 'resource_observation')).toBe(1);
		expect(findResourceObservationMemory(memory, 'water-1')?.empty).toBe(true);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 3,
			featureId: 'water-1',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: false
		});
		expect(findResourceObservationMemory(memory, 'water-1')?.empty).toBe(false);
	});
});

describe('rememberHeardSignal', () => {
	it('writes symbol, origin and emission id without sender', () => {
		const memory = rememberHeardSignal(createEmptyMemory(4), {
			rememberedAt: 7,
			emissionId: 'em-9',
			symbolId: 'glyph-2',
			origin: { x: 8, y: -1 }
		});
		expect(memory.entries[0]).toEqual({
			kind: 'heard_signal',
			sequence: 0,
			rememberedAt: 7,
			emissionId: 'em-9',
			symbolId: 'glyph-2',
			origin: { x: 8, y: -1 }
		});
		expect(JSON.stringify(memory.entries[0])).not.toContain('senderId');
		expect(hasHeardSignalMemory(memory, 'em-9')).toBe(true);
	});

	it('does not duplicate the same emission id', () => {
		let memory = rememberHeardSignal(createEmptyMemory(4), {
			rememberedAt: 1,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 2,
			emissionId: 'em-1',
			symbolId: 'glyph-1',
			origin: { x: 9, y: 9 }
		});
		expect(memory.entries).toHaveLength(1);
		expect(findHeardSignalMemory(memory, 'em-1')?.symbolId).toBe('glyph-0');
		expect(memory.nextSequence).toBe(1);
	});

	it('keeps separate emissions as separate memories', () => {
		let memory = rememberHeardSignal(createEmptyMemory(4), {
			rememberedAt: 1,
			emissionId: 'em-a',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 1,
			emissionId: 'em-b',
			symbolId: 'glyph-1',
			origin: { x: 1, y: 1 }
		});
		expect(countMemoryEntries(memory, 'heard_signal')).toBe(2);
	});
});

describe('forgetHeardSignal', () => {
	it('removes only the matching emission and leaves other kinds intact', () => {
		let memory = createEmptyMemory(8);
		memory = rememberResourceAnnouncement(memory, draft('food-ann'));
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'food-obs',
			resourceKind: 'food',
			position: { x: 1, y: 1 },
			empty: false
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 3,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 4,
			emissionId: 'em-2',
			symbolId: 'glyph-1',
			origin: { x: 2, y: 2 }
		});
		const nextSequence = memory.nextSequence;
		const next = forgetHeardSignal(memory, 'em-1');
		expect(hasHeardSignalMemory(next, 'em-1')).toBe(false);
		expect(hasHeardSignalMemory(next, 'em-2')).toBe(true);
		expect(hasResourceAnnouncementMemory(next, 'food-ann')).toBe(true);
		expect(hasResourceObservationMemory(next, 'food-obs')).toBe(true);
		expect(next.nextSequence).toBe(nextSequence);
		expect(next.entries.map((e) => e.sequence)).toEqual(
			next.entries.map((e) => e.sequence).sort((a, b) => a - b)
		);
	});

	it('is a no-op for an unknown emission id', () => {
		const memory = rememberHeardSignal(createEmptyMemory(4), {
			rememberedAt: 1,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		const next = forgetHeardSignal(memory, 'em-missing');
		expect(next).toBe(memory);
		expect(hasHeardSignalMemory(next, 'em-1')).toBe(true);
	});
});

describe('mixed capacity eviction', () => {
	it('evicts oldest across mixed memory kinds', () => {
		let memory = createEmptyMemory(2);
		memory = rememberResourceAnnouncement(memory, draft('food-ann'));
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'food-obs',
			resourceKind: 'food',
			position: { x: 0, y: 0 },
			empty: false
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 3,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		expect(memory.entries).toHaveLength(2);
		expect(hasResourceAnnouncementMemory(memory, 'food-ann')).toBe(false);
		expect(hasResourceObservationMemory(memory, 'food-obs')).toBe(true);
		expect(hasHeardSignalMemory(memory, 'em-1')).toBe(true);
	});

	it('refresh does not corrupt monotonic nextSequence', () => {
		let memory = createEmptyMemory(3);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 1,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 0, y: 0 },
			empty: false
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 2,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 3,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 1, y: 1 },
			empty: false
		});
		expect(memory.nextSequence).toBe(3);
		const sequences = memory.entries.map((e) => e.sequence);
		expect(new Set(sequences).size).toBe(sequences.length);
		expect(Math.max(...sequences)).toBeLessThan(memory.nextSequence);
	});
});

function testHabitat(overrides: Partial<Habitat> = {}): Habitat {
	return {
		seed: 'test',
		bounds: { width: 40, height: 40 },
		home: { id: 'home-0', kind: 'home', position: { x: 0, y: 0 }, size: { width: 4, height: 4 } },
		food: [
			{
				id: 'food-1',
				kind: 'food',
				position: { x: 2, y: 0 },
				size: { width: 1, height: 1 },
				amount: 5,
				capacity: 5
			}
		],
		water: [
			{
				id: 'water-1',
				kind: 'water',
				position: { x: -2, y: 0 },
				size: { width: 2, height: 2 },
				amount: 3,
				capacity: 3
			}
		],
		...overrides
	};
}

describe('applyResourceObservationMemories', () => {
	const config = { sensingRadius: 10, perceptionIntervalSeconds: 1 };

	it('creates food observation from a sensing pass snapshot', () => {
		const creature = testCreature({
			id: 'c0',
			position: { x: 0, y: 0 },
			perception: {
				...testCreature().perception,
				lastUpdatedAt: 5,
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 2, y: 0 },
						observedAt: 5
					}
				],
				perceivedFoodIds: ['food-1']
			}
		});
		const [updated] = applyResourceObservationMemories([creature], testHabitat(), 5, config);
		expect(updated!.memory.entries).toHaveLength(2); // food + nearby water
		expect(findResourceObservationMemory(updated!.memory, 'food-1')).toMatchObject({
			kind: 'resource_observation',
			empty: false,
			position: { x: 2, y: 0 }
		});
		expect(findResourceObservationMemory(updated!.memory, 'water-1')?.empty).toBe(false);
	});

	it('does not write when no sensing pass ran this step', () => {
		const creature = testCreature({
			perception: {
				...testCreature().perception,
				lastUpdatedAt: 1,
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 2, y: 0 },
						observedAt: 1
					}
				]
			}
		});
		const [updated] = applyResourceObservationMemories([creature], testHabitat(), 5, config);
		expect(updated).toBe(creature);
		expect(updated!.memory.entries).toHaveLength(0);
	});

	it('refreshes rather than duplicating continued food perception', () => {
		const habitat = testHabitat();
		let creature = testCreature({
			id: 'c0',
			position: { x: 0, y: 0 },
			perception: {
				...testCreature().perception,
				lastUpdatedAt: 1,
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 2, y: 0 },
						observedAt: 1
					}
				]
			}
		});
		[creature] = applyResourceObservationMemories([creature], habitat, 1, config) as [Creature];
		creature = {
			...creature,
			perception: { ...creature.perception, lastUpdatedAt: 2 }
		};
		[creature] = applyResourceObservationMemories([creature], habitat, 2, config) as [Creature];
		expect(countMemoryEntries(creature.memory, 'resource_observation')).toBe(2); // food + water
		const food = findResourceObservationMemory(creature.memory, 'food-1');
		expect(food?.rememberedAt).toBe(2);
	});

	it('remembers empty water basins without removing them', () => {
		const habitat = testHabitat({
			water: [
				{
					id: 'water-1',
					kind: 'water',
					position: { x: -2, y: 0 },
					size: { width: 2, height: 2 },
					amount: 0,
					capacity: 3
				}
			]
		});
		const creature = testCreature({
			position: { x: 0, y: 0 },
			perception: {
				...testCreature().perception,
				lastUpdatedAt: 4,
				// available-only perception would omit empty water
				observations: [],
				perceivedWaterIds: []
			}
		});
		const [updated] = applyResourceObservationMemories([creature], habitat, 4, config);
		expect(findResourceObservationMemory(updated!.memory, 'water-1')).toMatchObject({
			empty: true,
			resourceKind: 'water'
		});
	});

	it('forgets food observation when re-sensing a depleted location', () => {
		const withFood = testHabitat();
		let creature = testCreature({
			position: { x: 0, y: 0 },
			perception: {
				...testCreature().perception,
				lastUpdatedAt: 1,
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 2, y: 0 },
						observedAt: 1
					}
				]
			}
		});
		[creature] = applyResourceObservationMemories([creature], withFood, 1, config) as [Creature];
		expect(hasResourceObservationMemory(creature.memory, 'food-1')).toBe(true);

		const depleted: Habitat = { ...withFood, food: [] };
		creature = {
			...creature,
			perception: {
				...creature.perception,
				lastUpdatedAt: 2,
				observations: [],
				perceivedFoodIds: []
			}
		};
		[creature] = applyResourceObservationMemories([creature], depleted, 2, config) as [Creature];
		expect(hasResourceObservationMemory(creature.memory, 'food-1')).toBe(false);
		// water still remembered
		expect(hasResourceObservationMemory(creature.memory, 'water-1')).toBe(true);
	});
});

describe('applyHeardSignalMemories', () => {
	it('writes from newly heard signals and strips sender identity', () => {
		const creature = testCreature({
			recentHeard: [
				{
					emissionId: 'em-1',
					symbolId: 'glyph-3',
					senderId: 'other',
					origin: { x: 3, y: 4 },
					emittedAt: 2,
					heardAt: 3
				}
			]
		});
		const [updated] = applyHeardSignalMemories([creature], 3);
		const entry = findHeardSignalMemory(updated!.memory, 'em-1');
		expect(entry).toMatchObject({
			symbolId: 'glyph-3',
			origin: { x: 3, y: 4 },
			rememberedAt: 3
		});
		expect(JSON.stringify(entry)).not.toContain('senderId');
		expect(JSON.stringify(entry)).not.toContain('other');
	});

	it('ignores older heard history and dedupes reprocessing', () => {
		const creature = testCreature({
			recentHeard: [
				{
					emissionId: 'em-old',
					symbolId: 'glyph-0',
					senderId: 'a',
					origin: { x: 0, y: 0 },
					emittedAt: 1,
					heardAt: 1
				},
				{
					emissionId: 'em-new',
					symbolId: 'glyph-1',
					senderId: 'b',
					origin: { x: 1, y: 1 },
					emittedAt: 2,
					heardAt: 3
				}
			]
		});
		let [updated] = applyHeardSignalMemories([creature], 3);
		expect(countMemoryEntries(updated!.memory, 'heard_signal')).toBe(1);
		[updated] = applyHeardSignalMemories([updated!], 3);
		expect(countMemoryEntries(updated!.memory, 'heard_signal')).toBe(1);
	});
});

describe('list / newest usable recall helpers', () => {
	it('lists resource observations newest-first with optional kind filter', () => {
		let memory = createEmptyMemory(8);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 1,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 0, y: 0 },
			empty: false
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'water-1',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: true
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 3,
			featureId: 'food-2',
			resourceKind: 'food',
			position: { x: 2, y: 2 },
			empty: false
		});
		const all = listResourceObservations(memory);
		expect(all.map((e) => e.featureId)).toEqual(['food-2', 'water-1', 'food-1']);
		expect(listResourceObservations(memory, 'food').map((e) => e.featureId)).toEqual([
			'food-2',
			'food-1'
		]);
	});

	it('lists heard signals newest-first', () => {
		let memory = createEmptyMemory(8);
		memory = rememberHeardSignal(memory, {
			rememberedAt: 1,
			emissionId: 'em-old',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 2,
			emissionId: 'em-new',
			symbolId: 'glyph-1',
			origin: { x: 1, y: 1 }
		});
		expect(listHeardSignalMemories(memory).map((e) => e.emissionId)).toEqual(['em-new', 'em-old']);
	});

	it('finds newest usable observation and skips empty water', () => {
		let memory = createEmptyMemory(8);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 1,
			featureId: 'water-old',
			resourceKind: 'water',
			position: { x: 0, y: 0 },
			empty: false
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'water-dry',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: true
		});
		// Newest water is empty — fall back to older non-empty.
		expect(findNewestUsableResourceObservation(memory, 'water')?.featureId).toBe('water-old');
		// Only empty water remains usable filter → null
		memory = createEmptyMemory(8);
		memory = rememberResourceObservation(memory, {
			rememberedAt: 1,
			featureId: 'water-dry',
			resourceKind: 'water',
			position: { x: 1, y: 1 },
			empty: true
		});
		expect(findNewestUsableResourceObservation(memory, 'water')).toBeNull();
	});
});
