/**
 * Investigation eligibility is owned by cognition (heard_signal memory + arbitrate).
 * This file covers the investigate_signal candidate path under unified arbitration.
 */
import { describe, expect, it } from 'vitest';
import { arbitrate, DEFAULT_COGNITION_CONFIG } from '../cognition';
import { createEmptyMemory } from '../memory/create-memory';
import { rememberHeardSignal } from '../memory/mutate';
import type { ArbitrationInput } from '../cognition/types';

function baseInput(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
	return {
		timeSeconds: 10,
		trigger: 'periodic',
		position: { x: 0, y: 0 },
		hunger: 0.1,
		thirst: 0.1,
		energy: 0.95,
		verbosity: 1,
		availableFood: [],
		availableWater: [],
		memory: createEmptyMemory(16),
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home-0',
		config: DEFAULT_COGNITION_CONFIG,
		...overrides
	};
}

describe('investigate_signal via arbitration', () => {
	it('includes a valid investigate candidate for a heard_signal memory', () => {
		let memory = createEmptyMemory(16);
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-near',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 0 }
		});
		const record = arbitrate(baseInput({ memory }));
		const inv = record.candidates.find((c) => c.intention === 'investigate_signal');
		expect(inv?.valid).toBe(true);
		expect(inv?.target).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
		expect(record.selectedIntention).toBe('investigate_signal');
	});

	it('marks investigate invalid when memory has no heard signals', () => {
		const record = arbitrate(baseInput());
		const inv = record.candidates.find((c) => c.intention === 'investigate_signal');
		expect(inv?.valid).toBe(false);
		expect(inv?.rejectionReason).toBe('no_heard_signal');
	});

	it('prefers survival need over investigate when hunger is high', () => {
		let memory = createEmptyMemory(16);
		memory = rememberHeardSignal(memory, {
			rememberedAt: 5,
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 1, y: 0 }
		});
		const record = arbitrate(
			baseInput({
				memory,
				hunger: 0.95,
				availableFood: [{ featureId: 'food-1', resourceKind: 'food', position: { x: 0.5, y: 0 } }]
			})
		);
		expect(record.selectedIntention).toBe('satisfy_hunger');
		const inv = record.candidates.find((c) => c.intention === 'investigate_signal');
		expect(inv?.valid).toBe(true);
	});
});
