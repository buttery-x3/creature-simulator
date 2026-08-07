import { describe, expect, it } from 'vitest';
import type { Creature, HeardSignal } from '$lib/simulation';
import { testCreature } from '$lib/simulation/test-creature';
import {
	DEFAULT_HEARD_CUE_DURATION_SECONDS,
	clearListenerCuePresentation,
	createListenerCuePresentationResources,
	reconcileHeardCues
} from './listener-cue-presentation';

function heard(
	partial: Partial<HeardSignal> & Pick<HeardSignal, 'emissionId' | 'heardAt'>
): HeardSignal {
	return {
		emissionId: partial.emissionId,
		symbolId: partial.symbolId ?? 'glyph-0',
		senderId: partial.senderId ?? 'creature-sender',
		origin: partial.origin ?? { x: 0, y: 0 },
		emittedAt: partial.emittedAt ?? partial.heardAt,
		heardAt: partial.heardAt
	};
}

function creature(id: string, recentHeard: HeardSignal[] = []): Creature {
	return testCreature({
		id,
		position: { x: 1, y: 2 },
		wanderTarget: { x: 2, y: 2 },
		searchTarget: { x: 0, y: 2 },
		recentHeard
	});
}

describe('reconcileHeardCues', () => {
	it('creates one brief neutral cue when a creature newly hears a signal', () => {
		const resources = createListenerCuePresentationResources();
		const list = [creature('creature-1', [heard({ emissionId: 'e1', heardAt: 1.0 })])];
		reconcileHeardCues(resources, list, 1.1);
		expect(resources.byCreatureId.size).toBe(1);
		const group = resources.byCreatureId.get('creature-1')!;
		expect(group.userData.cueKind).toBe('listener');
		expect(group.userData.recentlyHeard).toBe(true);
		expect(group.userData.investigating).toBe(false);
		expect(group.position.x).toBeCloseTo(1);
		expect(group.position.y).toBeCloseTo(2);
		clearListenerCuePresentation(resources);
		expect(resources.byCreatureId.size).toBe(0);
	});

	it('coalesces multiple same-step hears into one cue per listener', () => {
		const resources = createListenerCuePresentationResources();
		const list = [
			creature('creature-1', [
				heard({ emissionId: 'e1', heardAt: 2.0, symbolId: 'glyph-0' }),
				heard({ emissionId: 'e2', heardAt: 2.0, symbolId: 'glyph-1' })
			])
		];
		reconcileHeardCues(resources, list, 2.05);
		expect(resources.byCreatureId.size).toBe(1);
		// Re-reconcile should not grow groups.
		const version = resources.structureVersion;
		reconcileHeardCues(resources, list, 2.1);
		expect(resources.byCreatureId.size).toBe(1);
		expect(resources.structureVersion).toBe(version);
		clearListenerCuePresentation(resources);
	});

	it('expires and disposes a hear-only cue after the presentation duration', () => {
		const resources = createListenerCuePresentationResources();
		const list = [creature('creature-1', [heard({ emissionId: 'e1', heardAt: 1.0 })])];
		reconcileHeardCues(resources, list, 1.1);
		expect(resources.byCreatureId.size).toBe(1);
		reconcileHeardCues(resources, list, 1.0 + DEFAULT_HEARD_CUE_DURATION_SECONDS + 0.05);
		expect(resources.byCreatureId.size).toBe(0);
		clearListenerCuePresentation(resources);
	});

	it('holds a steady cue for the full active investigation lifetime', () => {
		const resources = createListenerCuePresentationResources();
		const c = creature('creature-1', []);
		c.activeInvestigation = {
			emissionId: 'e1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 },
			startedAt: 1
		};
		c.position = { x: 3, y: 4 };
		reconcileHeardCues(resources, [c], 1.1);
		expect(resources.byCreatureId.size).toBe(1);
		const group = resources.byCreatureId.get('creature-1')!;
		expect(group.userData.investigating).toBe(true);
		expect(group.position.x).toBeCloseTo(3);
		expect(group.position.y).toBeCloseTo(4);
		const mat = resources.materialsById.get('creature-1')!;
		expect(mat.opacity).toBeCloseTo(1);

		// Continues while investigation remains (long after any hear window).
		const version = resources.structureVersion;
		c.position = { x: 5, y: 6 };
		reconcileHeardCues(resources, [c], 50);
		expect(resources.byCreatureId.size).toBe(1);
		expect(resources.structureVersion).toBe(version);
		expect(group.position.x).toBeCloseTo(5);
		expect(mat.opacity).toBeCloseTo(1);

		// Removed when investigation ends and no recent hear.
		c.activeInvestigation = null;
		reconcileHeardCues(resources, [c], 50.1);
		expect(resources.byCreatureId.size).toBe(0);
		clearListenerCuePresentation(resources);
	});

	it('keeps the cue after the hear window while investigation remains active', () => {
		const resources = createListenerCuePresentationResources();
		const c = creature('creature-1', [heard({ emissionId: 'e1', heardAt: 1.0 })]);
		c.activeInvestigation = {
			emissionId: 'e1',
			symbolId: 'glyph-0',
			origin: { x: 0, y: 0 },
			startedAt: 1.2
		};
		reconcileHeardCues(resources, [c], 1.3);
		expect(resources.byCreatureId.size).toBe(1);

		const pastHearWindow = 1.0 + DEFAULT_HEARD_CUE_DURATION_SECONDS + 1;
		reconcileHeardCues(resources, [c], pastHearWindow);
		expect(resources.byCreatureId.size).toBe(1);
		expect(resources.byCreatureId.get('creature-1')!.userData.investigating).toBe(true);
		expect(resources.byCreatureId.get('creature-1')!.userData.recentlyHeard).toBe(false);

		c.activeInvestigation = null;
		reconcileHeardCues(resources, [c], pastHearWindow + 0.1);
		expect(resources.byCreatureId.size).toBe(0);
		clearListenerCuePresentation(resources);
	});
});
