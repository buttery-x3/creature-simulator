import { describe, expect, it } from 'vitest';
import { arbitrate, DEFAULT_COGNITION_CONFIG } from '../index';
import type { ArbitrationInput } from '../types';
import { createEmptyMemory } from '../../memory/create-memory';
import { rememberHeardSignal, rememberResourceObservation } from '../../memory/mutate';

function input(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
	let memory = createEmptyMemory(16);
	memory = rememberHeardSignal(memory, {
		rememberedAt: 1,
		emissionId: 'old-food',
		symbolId: 'glyph-0',
		origin: { x: -8, y: 0 }
	});
	memory = rememberHeardSignal(memory, {
		rememberedAt: 2,
		emissionId: 'new-water',
		symbolId: 'glyph-1',
		origin: { x: 8, y: 0 }
	});
	return {
		timeSeconds: 10,
		trigger: 'periodic',
		position: { x: 0, y: 0 },
		hunger: 0.8,
		thirst: 0.1,
		energy: 0.95,
		verbosity: 0,
		curiosity: 0,
		availableFood: [],
		availableWater: [],
		memory,
		lexicon: { food: 'glyph-0', water: 'glyph-1', danger: null, approach: null },
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home',
		config: DEFAULT_COGNITION_CONFIG,
		...overrides
	};
}
function investigation(i: ArbitrationInput) {
	return arbitrate(i).candidates.find((c) => c.intention === 'investigate_signal')!;
}

describe('listener-local meaning and unresolved needs', () => {
	it('chooses older food over newer water and explains the bounded contribution after the floor', () => {
		const i = input();
		const record = arbitrate(i);
		const c = investigation(i);
		expect(record.selectedIntention).toBe('investigate_signal');
		expect(c.reference).toMatchObject({ emissionId: 'old-food', symbolId: 'glyph-0' });
		expect(c.target).toEqual({ kind: 'point', position: { x: -8, y: 0 } });
		expect(c.signalEvaluations).toHaveLength(2);
		const [food, water] = c.signalEvaluations!;
		expect(food).toMatchObject({
			interpretation: 'food',
			selected: true,
			foodKnowledge: 'none',
			hungerPressure: 0.8
		});
		expect(food.semanticContribution).toBeCloseTo(0.16);
		expect(food.score).toBe(
			Math.max(food.optionalScore, food.informationFloor) + food.semanticContribution
		);
		expect(water.semanticContribution).toBe(0);
		expect(food.score).toBeGreaterThan(water.score);
		expect(c.reasonCodes).toContain('semantic_relevance');
	});
	it.each([0, 0.2, 1])('chooses older water under thirst at curiosity %s', (curiosity) => {
		const i = input({
			hunger: 0.1,
			thirst: 0.8,
			curiosity,
			lexicon: { food: 'glyph-1', water: 'glyph-0', danger: null, approach: null }
		});
		expect(arbitrate(i).selectedIntention).toBe('investigate_signal');
		expect(investigation(i).reference).toMatchObject({ emissionId: 'old-food' });
	});
	it('reverses the origin with only personal assignments changed; clearing restores newest baseline', () => {
		const original = input();
		const before = structuredClone(original);
		const swapped = {
			...original,
			lexicon: { food: 'glyph-1' as const, water: 'glyph-0' as const, danger: null, approach: null }
		};
		const cleared = {
			...original,
			lexicon: { food: null, water: null, danger: null, approach: null }
		};
		expect(investigation(original).target).toEqual({ kind: 'point', position: { x: -8, y: 0 } });
		expect(investigation(swapped).target).toEqual({ kind: 'point', position: { x: 8, y: 0 } });
		expect(investigation(cleared).reference).toMatchObject({ emissionId: 'new-water' });
		expect(
			investigation(cleared).signalEvaluations?.every(
				(s) => s.semanticContribution === 0 && s.interpretation === 'unknown'
			)
		).toBe(true);
		expect(original).toEqual(before);
	});
	it('keeps unknown and known mismatched signals eligible with generic information value', () => {
		const unknown = investigation(
			input({ lexicon: { food: null, water: null, danger: null, approach: null } })
		);
		const mismatch = investigation(
			input({ lexicon: { food: null, water: 'glyph-1', danger: null, approach: null } })
		);
		expect(mismatch.valid).toBe(true);
		expect(mismatch.baseScore).toBe(unknown.baseScore);
		expect(mismatch.signalEvaluations?.[0]).toMatchObject({
			interpretation: 'water',
			semanticContribution: 0
		});
		expect(mismatch.signalEvaluations?.[0].informationFloor).toBeGreaterThan(0);
	});
	it('preserves optional unknown curiosity for sated creatures', () => {
		const i = input({
			hunger: 0.1,
			lexicon: { food: null, water: null, danger: null, approach: null }
		});
		expect(arbitrate(i).selectedIntention).toBe('explore');
		expect(arbitrate({ ...i, curiosity: 1 }).selectedIntention).toBe('investigate_signal');
	});
	it('tracks both pressures, suppressing only the need with visible knowledge', () => {
		const i = input({ hunger: 0.95, thirst: 0.5 });
		expect(investigation(i).reference).toMatchObject({ emissionId: 'old-food' });
		const withFood = {
			...i,
			availableFood: [
				{ featureId: 'food', resourceKind: 'food' as const, position: { x: 1, y: 0 } }
			]
		};
		const signals = investigation(withFood).signalEvaluations!;
		expect(signals.find((s) => s.interpretation === 'food')).toMatchObject({
			foodKnowledge: 'visible',
			semanticContribution: 0
		});
		expect(signals.find((s) => s.interpretation === 'water')?.semanticContribution).toBeCloseTo(
			0.1
		);
		expect(investigation(withFood).reference).toMatchObject({ emissionId: 'new-water' });
		expect(arbitrate(withFood).selectedIntention).toBe('satisfy_hunger');
	});
	it.each([true, false])(
		'remembered water usable=%s suppresses only actionable matching boost',
		(usable) => {
			const i = input({ hunger: 0.1, thirst: 0.8 });
			i.memory = rememberResourceObservation(i.memory, {
				rememberedAt: 3,
				featureId: 'water',
				resourceKind: 'water',
				position: { x: 2, y: 0 },
				empty: !usable
			});
			const water = investigation(i).signalEvaluations!.find((s) => s.interpretation === 'water')!;
			expect(water.waterKnowledge).toBe(usable ? 'remembered' : 'none');
			expect(water.semanticContribution).toBe(usable ? 0 : 0.2 * i.thirst);
		}
	);
	it('adds no boost below meaningful need threshold', () => {
		const c = investigation(input({ hunger: 0.44, thirst: 0.44 }));
		expect(
			c.signalEvaluations?.every((s) => s.semanticContribution === 0 && s.informationFloor === 0)
		).toBe(true);
	});
	it.each(['food', 'water', 'rest'] as const)(
		'strong actionable %s beats maximum curiosity and investigation continuity',
		(need) => {
			const i = input({
				hunger: 0.95,
				thirst: 0.95,
				curiosity: 1,
				currentIntention: 'investigate_signal',
				...(need === 'rest'
					? { energy: 0.01 }
					: need === 'food'
						? {
								availableFood: [
									{ featureId: 'food', resourceKind: 'food', position: { x: 1, y: 0 } }
								]
							}
						: {
								availableWater: [
									{ featureId: 'water', resourceKind: 'water', position: { x: 1, y: 0 } }
								]
							})
			});
			expect(arbitrate(i).selectedIntention).toBe(
				need === 'rest' ? 'rest' : need === 'food' ? 'satisfy_hunger' : 'satisfy_thirst'
			);
		}
	);
	it('has no signals when memory contains none', () => {
		const c = investigation(input({ memory: createEmptyMemory(16) }));
		expect(c).toMatchObject({
			valid: false,
			score: 0,
			reference: null,
			target: null,
			signalEvaluations: []
		});
	});
	it('is stable over repeat arbitration and entry reordering; continuity stays separate', () => {
		const i = input({ currentIntention: 'investigate_signal' });
		const expected = arbitrate(i);
		expect(arbitrate(i)).toEqual(expected);
		expect(
			arbitrate({ ...i, memory: { ...i.memory, entries: [...i.memory.entries].reverse() } })
		).toEqual(expected);
		const c = investigation(i);
		expect(c.score).toBeCloseTo(c.baseScore + i.config.continuityBonus);
		expect(c.signalEvaluations![0].score).toBe(c.baseScore);
	});
	it('breaks equal scores by newer sequence then emission ID, independent of array storage', () => {
		const i = input({
			lexicon: { food: null, water: null, danger: null, approach: null },
			config: { ...DEFAULT_COGNITION_CONFIG, signalRecencyBoostMax: 0 }
		});
		expect(investigation(i).reference).toMatchObject({ emissionId: 'new-water' });
		i.memory.entries = i.memory.entries.map((e) => ({ ...e, sequence: 1 }));
		const expected = investigation(i);
		expect(expected.reference).toMatchObject({ emissionId: 'new-water' }); // n sorts before o
		expect(
			investigation({ ...i, memory: { ...i.memory, entries: [...i.memory.entries].reverse() } })
		).toEqual(expected);
	});
});

describe('learned approach has no stale-origin fallback', () => {
	function oneSignal(lexicon: ArbitrationInput['lexicon']) {
		const memory = rememberHeardSignal(createEmptyMemory(16), {
			rememberedAt: 1,
			emissionId: 'heard-earlier',
			symbolId: 'glyph-0',
			origin: { x: -8, y: 0 }
		});
		return input({ timeSeconds: 100, curiosity: 1, hunger: 0.9, memory, lexicon });
	}
	it('excludes known approach even with high curiosity, unmet hunger and expired or absent peer response', () => {
		const known = oneSignal({ food: null, water: null, danger: null, approach: 'glyph-0' });
		const candidate = investigation(known);
		expect(candidate).toMatchObject({
			valid: false,
			target: null,
			reference: null,
			score: 0,
			rejectionReason: 'approach_requires_visible_peer',
			reasonCodes: ['approach_requires_visible_peer']
		});
		expect(candidate.signalEvaluations).toEqual([
			expect.objectContaining({
				interpretation: 'approach',
				selected: false,
				semanticContribution: 0
			})
		]);
		expect(arbitrate(known).selectedIntention).not.toBe('investigate_signal');
	});
	it('keeps the identical sound investigable when unknown or personally learned as food', () => {
		const unknown = investigation(
			oneSignal({ food: null, water: null, danger: null, approach: null })
		);
		const food = investigation(
			oneSignal({ food: 'glyph-0', water: null, danger: null, approach: null })
		);
		expect(unknown).toMatchObject({
			valid: true,
			target: { kind: 'point', position: { x: -8, y: 0 } }
		});
		expect(unknown.signalEvaluations![0]!.interpretation).toBe('unknown');
		expect(food).toMatchObject({ valid: true, target: unknown.target });
		expect(food.signalEvaluations![0]).toMatchObject({ interpretation: 'food', selected: true });
		expect(food.baseScore).toBeGreaterThan(unknown.baseScore);
	});
	it('retains unknown alternatives while excluding approach, and explains all local-response exclusions', () => {
		const mixed = input({
			lexicon: { food: null, water: null, danger: null, approach: 'glyph-1' }
		});
		expect(investigation(mixed).reference).toMatchObject({ emissionId: 'old-food' });
		const excluded = investigation({
			...mixed,
			lexicon: { food: null, water: null, danger: 'glyph-0', approach: 'glyph-1' }
		});
		expect(excluded.valid).toBe(false);
		expect(excluded.reasonCodes).toEqual([
			'approach_requires_visible_peer',
			'danger_requires_avoidance'
		]);
		expect(excluded.signalEvaluations?.every((row) => !row.selected)).toBe(true);
	});
});
