import { describe, expect, it } from 'vitest';
import { createEmptyMemory } from '../memory/create-memory';
import {
	rememberHeardSignal,
	rememberResourceAnnouncement,
	rememberResourceObservation
} from '../memory/mutate';
import type { CreatureMemory } from '../memory/types';
import {
	arbitrate,
	DEFAULT_COGNITION_CONFIG,
	INTENTION_TIE_BREAK_ORDER,
	mergeCognitionConfig,
	selectBestCandidate,
	selectResourceNeedTarget,
	selectSignalInvestigationTarget
} from './index';
import type { ArbitrationInput, IntentionKind, PerceivedResource } from './types';

function emptyMemory(capacity = 16): CreatureMemory {
	return createEmptyMemory(capacity);
}

function baseInput(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
	return {
		timeSeconds: 10,
		trigger: 'periodic',
		position: { x: 0, y: 0 },
		hunger: 0.1,
		thirst: 0.1,
		energy: 0.95,
		availableFood: [],
		availableWater: [],
		memory: emptyMemory(),
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home-0',
		config: DEFAULT_COGNITION_CONFIG,
		...overrides
	};
}

function byIntention(record: ReturnType<typeof arbitrate>) {
	return Object.fromEntries(record.candidates.map((c) => [c.intention, c]));
}

function foodPerceived(id: string, position = { x: 1, y: 0 }): PerceivedResource {
	return { featureId: id, resourceKind: 'food', position };
}

function waterPerceived(id: string, position = { x: 0, y: 1 }): PerceivedResource {
	return { featureId: id, resourceKind: 'water', position };
}

describe('baseline choice', () => {
	it('selects wander when no meaningful need or signal', () => {
		const record = arbitrate(baseInput());
		expect(record.selectedIntention).toBe('wander');
		const map = byIntention(record);
		expect(map.satisfy_hunger?.valid).toBe(false);
		expect(map.satisfy_thirst?.valid).toBe(false);
		expect(map.rest?.valid).toBe(false);
		expect(map.investigate_signal?.valid).toBe(false);
		expect(map.wander?.valid).toBe(true);
		expect(map.wander?.score).toBe(DEFAULT_COGNITION_CONFIG.wanderBaseline);
	});

	it('selects investigate_signal over wander for a recent heard signal', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 3, y: 4 }
		});
		const record = arbitrate(baseInput({ memory }));
		expect(record.selectedIntention).toBe('investigate_signal');
		const inv = byIntention(record).investigate_signal!;
		expect(inv.valid).toBe(true);
		expect(inv.score).toBeGreaterThan(DEFAULT_COGNITION_CONFIG.wanderBaseline);
		expect(inv.target).toEqual({ kind: 'point', position: { x: 3, y: 4 } });
		expect(inv.reference).toEqual({
			kind: 'heard_signal',
			emissionId: 'em-1',
			symbolId: 'glyph-0'
		});
	});

	it('selects satisfy_hunger over signal when hunger is meaningful', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 3, y: 4 }
		});
		const record = arbitrate(
			baseInput({
				hunger: 0.9,
				memory,
				availableFood: [foodPerceived('food-1')]
			})
		);
		expect(record.selectedIntention).toBe('satisfy_hunger');
	});

	it('selects satisfy_thirst over signal when thirst is meaningful', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 3, y: 4 }
		});
		const record = arbitrate(
			baseInput({
				thirst: 0.9,
				memory,
				availableWater: [waterPerceived('water-1')]
			})
		);
		expect(record.selectedIntention).toBe('satisfy_thirst');
	});

	it('selects rest when energy deficit is stronger than optional behaviour', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 1 }
		});
		// energy 0.2 → deficit 0.8; signal max ≈ 0.45
		const record = arbitrate(baseInput({ energy: 0.2, memory }));
		expect(record.selectedIntention).toBe('rest');
		expect(record.selectedTarget).toEqual({
			kind: 'feature',
			featureId: 'home-0',
			featureKind: 'home'
		});
	});
});

describe('resource memory targeting', () => {
	it('uses visible usable food for hunger', () => {
		const record = arbitrate(
			baseInput({
				hunger: 0.8,
				availableFood: [foodPerceived('food-near', { x: 1, y: 0 })]
			})
		);
		const hunger = byIntention(record).satisfy_hunger!;
		expect(hunger.valid).toBe(true);
		expect(hunger.target).toEqual({
			kind: 'feature',
			featureId: 'food-near',
			featureKind: 'food'
		});
		expect(hunger.reasonCodes).toContain('visible_resource');
	});

	it('uses remembered food when no visible food exists', () => {
		let memory = emptyMemory();
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'food-mem',
			resourceKind: 'food',
			position: { x: 5, y: 5 },
			empty: false
		});
		const record = arbitrate(baseInput({ hunger: 0.8, memory, availableFood: [] }));
		const hunger = byIntention(record).satisfy_hunger!;
		expect(hunger.target).toEqual({
			kind: 'feature',
			featureId: 'food-mem',
			featureKind: 'food'
		});
		expect(hunger.reasonCodes).toContain('remembered_resource');
	});

	it('uses remembered non-empty water for thirst', () => {
		let memory = emptyMemory();
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'water-ok',
			resourceKind: 'water',
			position: { x: 2, y: 2 },
			empty: false
		});
		const record = arbitrate(baseInput({ thirst: 0.8, memory }));
		const thirst = byIntention(record).satisfy_thirst!;
		expect(thirst.target).toEqual({
			kind: 'feature',
			featureId: 'water-ok',
			featureKind: 'water'
		});
	});

	it('does not select water memory marked empty as usable', () => {
		let memory = emptyMemory();
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'water-dry',
			resourceKind: 'water',
			position: { x: 2, y: 2 },
			empty: true
		});
		const result = selectResourceNeedTarget({ x: 0, y: 0 }, [], memory, 'water');
		expect(result.source).toBe('none');
		expect(result.target).toBeNull();
		expect(result.reasonCodes).toContain('search_fallback');

		const record = arbitrate(baseInput({ thirst: 0.8, memory }));
		const thirst = byIntention(record).satisfy_thirst!;
		expect(thirst.valid).toBe(true);
		expect(thirst.target).toBeNull();
		expect(thirst.reasonCodes).toContain('search_fallback');
	});

	it('falls back to search_fallback with null target when no resource knowledge', () => {
		const record = arbitrate(baseInput({ hunger: 0.9, availableFood: [] }));
		const hunger = byIntention(record).satisfy_hunger!;
		expect(hunger.valid).toBe(true);
		expect(hunger.target).toBeNull();
		expect(hunger.reasonCodes).toContain('search_fallback');
	});

	it('prefers visible food over remembered food', () => {
		let memory = emptyMemory();
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'food-mem',
			resourceKind: 'food',
			position: { x: 9, y: 9 },
			empty: false
		});
		const record = arbitrate(
			baseInput({
				hunger: 0.8,
				memory,
				availableFood: [foodPerceived('food-vis', { x: 1, y: 0 })]
			})
		);
		expect(byIntention(record).satisfy_hunger?.target).toEqual({
			kind: 'feature',
			featureId: 'food-vis',
			featureKind: 'food'
		});
	});
});

describe('continuity', () => {
	it('keeps current intention against a tiny challenger via continuity bonus', () => {
		// wander baseline 0.35 + continuity 0.1 = 0.45
		// announce baseline 0.30 cannot beat it
		const record = arbitrate(
			baseInput({
				currentIntention: 'wander',
				availableFood: [foodPerceived('food-1')],
				// announce valid at 0.30; wander+continuity = 0.45
				hunger: 0.1
			})
		);
		expect(record.selectedIntention).toBe('wander');
		const wander = byIntention(record).wander!;
		expect(wander.continuityAdjustment).toBe(DEFAULT_COGNITION_CONFIG.continuityBonus);
		expect(wander.score).toBeCloseTo(
			DEFAULT_COGNITION_CONFIG.wanderBaseline + DEFAULT_COGNITION_CONFIG.continuityBonus,
			10
		);
		expect(record.selectionReasonCodes).toContain('continuity_bonus');
	});

	it('lets a clearly stronger need interrupt signal investigation', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 3, y: 4 }
		});
		const record = arbitrate(
			baseInput({
				memory,
				currentIntention: 'investigate_signal',
				hunger: 0.9,
				availableFood: [foodPerceived('food-1')]
			})
		);
		expect(record.selectedIntention).toBe('satisfy_hunger');
	});

	it('does not make current activity uninterruptible', () => {
		// Even with continuity, hunger 0.9 beats investigate (~0.45+0.1)
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 1 }
		});
		const withContinuity = arbitrate(
			baseInput({
				memory,
				currentIntention: 'investigate_signal',
				hunger: 0.9
			})
		);
		expect(withContinuity.selectedIntention).toBe('satisfy_hunger');
	});
});

describe('signal memory', () => {
	it('derives signal candidate from heard_signal memory only', () => {
		// No pendingSignals field exists on ArbitrationInput — memory alone.
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 1,
			emissionId: 'em-a',
			symbolId: 'glyph-2',
			origin: { x: 0, y: 2 }
		});
		const record = arbitrate(baseInput({ memory }));
		const inv = byIntention(record).investigate_signal!;
		expect(inv.valid).toBe(true);
		expect(inv.reference).toMatchObject({ emissionId: 'em-a', symbolId: 'glyph-2' });
	});

	it('selects newer signal memory deterministically for the investigation target', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 1,
			emissionId: 'em-old',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 0 }
		});
		memory = rememberHeardSignal(memory, {
			rememberedAt: 2,
			emissionId: 'em-new',
			symbolId: 'glyph-1',
			origin: { x: 9, y: 9 }
		});
		const selected = selectSignalInvestigationTarget(memory);
		expect(selected.memory?.emissionId).toBe('em-new');
		expect(selected.target).toEqual({ kind: 'point', position: { x: 9, y: 9 } });

		const record = arbitrate(baseInput({ memory }));
		expect(byIntention(record).investigate_signal?.reference).toMatchObject({
			emissionId: 'em-new'
		});
	});

	it('does not change score based on symbol id / lexicon meaning', () => {
		let memA = emptyMemory();
		memA = rememberHeardSignal(memA, {
			rememberedAt: 1,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 1 }
		});
		let memB = emptyMemory();
		memB = rememberHeardSignal(memB, {
			rememberedAt: 1,
			emissionId: 'em-1',
			symbolId: 'glyph-3',
			origin: { x: 1, y: 1 }
		});
		const a = byIntention(arbitrate(baseInput({ memory: memA }))).investigate_signal!;
		const b = byIntention(arbitrate(baseInput({ memory: memB }))).investigate_signal!;
		expect(a.score).toBeCloseTo(b.score, 10);
		expect(a.baseScore).toBeCloseTo(b.baseScore, 10);
	});
});

describe('announcement candidate', () => {
	it('is valid for perceived resource without announcement memory', () => {
		const record = arbitrate(
			baseInput({
				availableFood: [foodPerceived('food-1')]
			})
		);
		const announce = byIntention(record).announce_resource!;
		expect(announce.valid).toBe(true);
		expect(announce.target).toEqual({
			kind: 'feature',
			featureId: 'food-1',
			featureKind: 'food'
		});
		expect(announce.score).toBe(DEFAULT_COGNITION_CONFIG.announceBaseline);
	});

	it('is invalid when announcement memory already covers the feature', () => {
		let memory = emptyMemory();
		memory = rememberResourceAnnouncement(memory, {
			rememberedAt: 1,
			featureId: 'food-1',
			resourceKind: 'food',
			opportunityId: 'ann-1',
			emissionId: 'em-1'
		});
		const record = arbitrate(
			baseInput({
				memory,
				availableFood: [foodPerceived('food-1')]
			})
		);
		const announce = byIntention(record).announce_resource!;
		expect(announce.valid).toBe(false);
		expect(announce.rejectionReason).toBe('no_unannounced_resource');
	});

	it('picks a deterministic feature among multiple unannounced resources', () => {
		const record = arbitrate(
			baseInput({
				availableFood: [foodPerceived('food-b'), foodPerceived('food-a')],
				availableWater: [waterPerceived('water-z')]
			})
		);
		// featureId ascending: food-a wins
		expect(byIntention(record).announce_resource?.target).toEqual({
			kind: 'feature',
			featureId: 'food-a',
			featureKind: 'food'
		});
	});
});

describe('determinism', () => {
	it('produces identical records for identical inputs', () => {
		let memory = emptyMemory();
		memory = rememberHeardSignal(memory, {
			rememberedAt: 1,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 2, y: 2 }
		});
		memory = rememberResourceObservation(memory, {
			rememberedAt: 2,
			featureId: 'food-1',
			resourceKind: 'food',
			position: { x: 1, y: 1 },
			empty: false
		});
		const input = baseInput({
			hunger: 0.5,
			memory,
			availableFood: [foodPerceived('food-vis')],
			currentIntention: 'wander',
			trigger: 'new_heard_signal_memory'
		});
		const a = arbitrate(input);
		const b = arbitrate(input);
		expect(a).toEqual(b);
	});

	it('uses explicit intention tie-break order on equal scores', () => {
		const config = mergeCognitionConfig({
			wanderBaseline: 0.5,
			announceBaseline: 0.5,
			signalBaseline: 0.5,
			signalRecencyBoostMax: 0
		});
		// rest threshold: energy deficit 0.5 with energy 0.5 → rest score 0.5
		const record = arbitrate(
			baseInput({
				config,
				energy: 0.5,
				// rest valid at threshold 0.4 with score 0.5
				// wander also 0.5 — rest ranks earlier
				hunger: 0.1,
				thirst: 0.1
			})
		);
		expect(record.selectedIntention).toBe('rest');
		expect(record.selectionReasonCodes).toContain('selected_tie_break');
	});

	it('exposes a fixed baseline candidate kind set', () => {
		const record = arbitrate(baseInput());
		expect(record.candidates.map((c) => c.intention)).toEqual([...INTENTION_TIE_BREAK_ORDER]);
	});

	it('selectBestCandidate is stable under reordering of the array', () => {
		const record = arbitrate(
			baseInput({
				hunger: 0.9,
				availableFood: [foodPerceived('food-1')]
			})
		);
		const reversed = [...record.candidates].reverse();
		expect(selectBestCandidate(reversed).intention).toBe(
			selectBestCandidate(record.candidates).intention
		);
	});
});

describe('open decision preferences', () => {
	it('uses feature targets for remembered resources (not point fallback when id known)', () => {
		let memory = emptyMemory();
		memory = rememberResourceObservation(memory, {
			rememberedAt: 1,
			featureId: 'food-x',
			resourceKind: 'food',
			position: { x: 4, y: 4 },
			empty: false
		});
		const result = selectResourceNeedTarget({ x: 0, y: 0 }, [], memory, 'food');
		expect(result.target?.kind).toBe('feature');
		if (result.target?.kind === 'feature') {
			expect(result.target.featureId).toBe('food-x');
		}
	});

	it('does not emit a separate continue intention kind', () => {
		const record = arbitrate(baseInput({ currentIntention: 'wander' }));
		const kinds = record.candidates.map((c) => c.intention);
		expect(kinds).not.toContain('continue' as IntentionKind);
		expect(kinds).toEqual([...INTENTION_TIE_BREAK_ORDER]);
	});
});
