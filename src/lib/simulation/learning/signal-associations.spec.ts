import { describe, expect, it } from 'vitest';
import {
	applyNoEvidenceReduction,
	createEmptyAssociations,
	emptyAssociation,
	reinforceAssociation
} from './signal-associations';

const clamp = { associationStrengthMin: 0, associationStrengthMax: 1 };

describe('symbol associations', () => {
	it('starts with zero strength and evidence for every symbol', () => {
		const associations = createEmptyAssociations(['glyph-0', 'glyph-1']);
		expect(associations).toHaveLength(2);
		for (const a of associations) {
			expect(a.foodStrength).toBe(0);
			expect(a.waterStrength).toBe(0);
			expect(a.foodEvidenceCount).toBe(0);
			expect(a.waterEvidenceCount).toBe(0);
		}
	});

	it('does not share array or row references across createEmptyAssociations calls', () => {
		const a = createEmptyAssociations(['glyph-0']);
		const b = createEmptyAssociations(['glyph-0']);
		expect(a).not.toBe(b);
		expect(a[0]).not.toBe(b[0]);
		a[0]!.foodStrength = 0.5;
		expect(b[0]!.foodStrength).toBe(0);
	});

	it('reinforces only the requested resource kind and clamps', () => {
		const base = [emptyAssociation('glyph-0')];
		const food = reinforceAssociation(
			base,
			'glyph-0',
			{ reinforceFood: true, reinforceWater: false, amount: 0.25 },
			clamp
		);
		expect(food.foodStrengthAfter).toBe(0.25);
		expect(food.waterStrengthAfter).toBe(0);
		expect(food.associations[0]!.foodEvidenceCount).toBe(1);

		const capped = reinforceAssociation(
			food.associations,
			'glyph-0',
			{ reinforceFood: true, reinforceWater: false, amount: 5 },
			clamp
		);
		expect(capped.foodStrengthAfter).toBe(1);

		const water = reinforceAssociation(
			capped.associations,
			'glyph-0',
			{ reinforceFood: false, reinforceWater: true, amount: 0.3 },
			clamp
		);
		expect(water.waterStrengthAfter).toBe(0.3);
		expect(water.foodStrengthAfter).toBe(1);
	});

	it('applies optional no-evidence reduction conservatively', () => {
		const associations = [
			{
				symbolId: 'glyph-0' as const,
				foodStrength: 0.4,
				waterStrength: 0.2,
				foodEvidenceCount: 1,
				waterEvidenceCount: 1
			}
		];
		const unchanged = applyNoEvidenceReduction(associations, 'glyph-0', 0, clamp);
		expect(unchanged.foodStrengthAfter).toBe(0.4);
		expect(unchanged.waterStrengthAfter).toBe(0.2);

		const reduced = applyNoEvidenceReduction(associations, 'glyph-0', 0.1, clamp);
		expect(reduced.foodStrengthAfter).toBeCloseTo(0.3);
		expect(reduced.waterStrengthAfter).toBeCloseTo(0.1);
	});
});
