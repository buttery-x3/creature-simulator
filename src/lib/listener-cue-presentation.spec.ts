import { describe, expect, it } from 'vitest';
import type { Creature, HeardSignal } from '$lib/simulation';
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
	return {
		id,
		position: { x: 1, y: 2 },
		facing: 0,
		movementSpeed: 1,
		wanderTarget: { x: 2, y: 2 },
		wanderDecisionIndex: 0,
		searchTarget: { x: 0, y: 2 },
		searchDecisionIndex: 0,
		perception: {
			lastUpdatedAt: -1,
			perceivedFoodIds: [],
			perceivedWaterIds: [],
			observations: [],
			tracked: null
		},
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		curiosity: 0.45,
		goal: 'wander',
		action: 'wander',
		target: { kind: 'point', position: { x: 2, y: 2 } },
		goalStartedAt: 0,
		actionStartedAt: 0,
		nextReconsiderAt: 1.5,
		lastDecision: null,
		lastCandidates: [],
		recentTransitions: [],
		preferredSymbolId: 'glyph-0',
		emissionCount: 0,
		lastEmissionAt: -1,
		recentEmitted: [],
		recentHeard,
		symbolAssociations: [],
		lexicon: { food: null, water: null },
		recentLexiconChanges: [],
		pendingSignals: [],
		activeInvestigation: null,
		recentLearning: []
	};
}

describe('reconcileHeardCues', () => {
	it('creates one brief neutral cue when a creature newly hears a signal', () => {
		const resources = createListenerCuePresentationResources();
		const list = [creature('creature-1', [heard({ emissionId: 'e1', heardAt: 1.0 })])];
		reconcileHeardCues(resources, list, 1.1);
		expect(resources.byCreatureId.size).toBe(1);
		const group = resources.byCreatureId.get('creature-1')!;
		expect(group.userData.cueKind).toBe('heard');
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

	it('expires and disposes the cue after the presentation duration', () => {
		const resources = createListenerCuePresentationResources();
		const list = [creature('creature-1', [heard({ emissionId: 'e1', heardAt: 1.0 })])];
		reconcileHeardCues(resources, list, 1.1);
		expect(resources.byCreatureId.size).toBe(1);
		reconcileHeardCues(resources, list, 1.0 + DEFAULT_HEARD_CUE_DURATION_SECONDS + 0.05);
		expect(resources.byCreatureId.size).toBe(0);
		clearListenerCuePresentation(resources);
	});

	it('does not create cues from investigation state alone', () => {
		const resources = createListenerCuePresentationResources();
		const c = creature('creature-1', []);
		c.activeInvestigation = {
			emissionId: 'e1',
			symbolId: 'glyph-0',
			senderId: 's',
			origin: { x: 0, y: 0 },
			startedAt: 1
		};
		reconcileHeardCues(resources, [c], 1.1);
		expect(resources.byCreatureId.size).toBe(0);
		clearListenerCuePresentation(resources);
	});
});
