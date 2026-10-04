import { describe, expect, it } from 'vitest';
import {
	createEmptyMemory,
	DANGER_MEMORY_LIFETIME_SECONDS,
	listDangerObservations,
	markHeardSignalEvidenceApplied,
	rememberDangerObservation,
	rememberHeardSignal
} from './index';

const danger = {
	wildlifeId: 'animal-0',
	position: { x: 1, y: 2 },
	size: 1.5,
	physicality: 1.2,
	health: 1,
	energy: 0.8,
	rememberedAt: 5
};

describe('bounded danger retention', () => {
	it('refreshes snapshots independently and shares capacity with other memory', () => {
		const initial = rememberDangerObservation(createEmptyMemory(1), danger);
		const refreshed = rememberDangerObservation(initial, {
			...danger,
			position: { x: 3, y: 4 },
			rememberedAt: 6
		});
		expect(refreshed.entries).toHaveLength(1);
		expect(listDangerObservations(initial, 6)[0].position).toEqual({ x: 1, y: 2 });
		expect(listDangerObservations(refreshed, 6)[0].position).toEqual({ x: 3, y: 4 });
		expect(listDangerObservations(refreshed, 6)[0].firstObservedAt).toBe(5);
		const laterEpisode = rememberDangerObservation(refreshed, { ...danger, rememberedAt: 30 });
		expect(listDangerObservations(laterEpisode, 30)[0].firstObservedAt).toBe(30);
		const evicted = rememberHeardSignal(refreshed, {
			rememberedAt: 7,
			emissionId: 'signal',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		expect(evicted.entries).toHaveLength(1);
		expect(listDangerObservations(evicted, 7)).toEqual([]);
	});
	it('excludes stale danger and does not invent future evidence', () => {
		const memory = rememberDangerObservation(createEmptyMemory(4), danger);
		expect(listDangerObservations(memory, 4)).toEqual([]);
		expect(listDangerObservations(memory, 5 + DANGER_MEMORY_LIFETIME_SECONDS - 0.01)).toHaveLength(
			1
		);
		expect(listDangerObservations(memory, 5 + DANGER_MEMORY_LIFETIME_SECONDS)).toEqual([]);
	});
	it('marks reception evidence once without changing memory recency or forgetting the signal', () => {
		const memory = rememberHeardSignal(createEmptyMemory(2), {
			rememberedAt: 1,
			emissionId: 'signal',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 }
		});
		const marked = markHeardSignalEvidenceApplied(memory, 'signal');
		expect(marked.entries[0]).toMatchObject({
			kind: 'heard_signal',
			evidenceApplied: true,
			sequence: 0,
			rememberedAt: 1
		});
		expect(memory.entries[0]).toMatchObject({ evidenceApplied: false });
		expect(markHeardSignalEvidenceApplied(marked, 'signal')).toBe(marked);
		expect(markHeardSignalEvidenceApplied(marked, 'missing')).toBe(marked);
		expect(marked.nextSequence).toBe(memory.nextSequence);
	});
});
