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
			expect(a.evidence.food.strength).toBe(0);
			expect(a.evidence.water.strength).toBe(0);
			expect(a.evidence.food.count).toBe(0);
			expect(a.evidence.water.count).toBe(0);
		}
	});

	it('does not share array or row references across createEmptyAssociations calls', () => {
		const a = createEmptyAssociations(['glyph-0']);
		const b = createEmptyAssociations(['glyph-0']);
		expect(a).not.toBe(b);
		expect(a[0]).not.toBe(b[0]);
		a[0]!.evidence.food.strength = 0.5;
		expect(b[0]!.evidence.food.strength).toBe(0);
	});

	it('reinforces only the requested resource kind and clamps', () => {
		const base = [emptyAssociation('glyph-0')];
		const food = reinforceAssociation(
			base,
			'glyph-0',
			{ meanings: { food: true, water: false }, amount: 0.25 },
			clamp
		);
		expect(food.after.food).toBe(0.25);
		expect(food.after.water).toBe(0);
		expect(food.associations[0]!.evidence.food.count).toBe(1);

		const capped = reinforceAssociation(
			food.associations,
			'glyph-0',
			{ meanings: { food: true, water: false }, amount: 5 },
			clamp
		);
		expect(capped.after.food).toBe(1);

		const water = reinforceAssociation(
			capped.associations,
			'glyph-0',
			{ meanings: { food: false, water: true }, amount: 0.3 },
			clamp
		);
		expect(water.after.water).toBe(0.3);
		expect(water.after.food).toBe(1);
	});

	it('applies optional no-evidence reduction conservatively', () => {
		const associations = [
			{
				symbolId: 'glyph-0' as const,
				evidence: {
					food: { strength: 0.4, count: 1 },
					water: { strength: 0.2, count: 1 },
					danger: { strength: 0, count: 0 },
					approach: { strength: 0, count: 0 }
				},
				dangerEvidenceEpisodes: []
			}
		];
		const unchanged = applyNoEvidenceReduction(associations, 'glyph-0', 0, clamp);
		expect(unchanged.after.food).toBe(0.4);
		expect(unchanged.after.water).toBe(0.2);

		const reduced = applyNoEvidenceReduction(associations, 'glyph-0', 0.1, clamp);
		expect(reduced.after.food).toBeCloseTo(0.3);
		expect(reduced.after.water).toBeCloseTo(0.1);
	});
});

it('bounds independent danger episode provenance and ignores repeated confirmation', () => {
	let associations = [emptyAssociation('glyph-0')];
	for (let episode = 0; episode < 20; episode++) {
		associations = reinforceAssociation(
			associations,
			'glyph-0',
			{
				meanings: { food: false, water: false, danger: true, approach: false },
				dangerEpisodes: [`animal:${episode}`],
				amount: 0.1
			},
			clamp
		).associations;
	}
	const repeated = reinforceAssociation(
		associations,
		'glyph-0',
		{
			meanings: { food: false, water: false, danger: true, approach: false },
			dangerEpisodes: ['animal:19'],
			amount: 0.1
		},
		clamp
	);
	expect(repeated.associations[0]).toMatchObject({
		evidence: { danger: { strength: 1, count: 20 } }
	});
	expect(repeated.associations[0]!.dangerEvidenceEpisodes).toHaveLength(8);
});

it('does not repeatedly learn when simultaneous episode candidates exceed provenance capacity', () => {
	const options = {
		meanings: { food: false, water: false, danger: true, approach: false },
		dangerEpisodes: Array.from({ length: 12 }, (_, index) => `animal-${index}:1`),
		amount: 0.25
	};
	const first = reinforceAssociation([emptyAssociation('glyph-0')], 'glyph-0', options, clamp);
	const second = reinforceAssociation(first.associations, 'glyph-0', options, clamp);
	expect(second.associations[0]!.evidence.danger.count).toBe(1);
});

it('keeps nested evidence independent across meanings and symbols', () => {
	const rows = createEmptyAssociations(['glyph-0', 'glyph-1']);
	rows[0]!.evidence.food.strength = 0.8;
	rows[0]!.evidence.food.count = 3;
	expect(rows[0]!.evidence.water).toEqual({ strength: 0, count: 0 });
	expect(rows[0]!.evidence.danger).toEqual({ strength: 0, count: 0 });
	expect(rows[1]!.evidence.food).toEqual({ strength: 0, count: 0 });
});

it('updates partial meaning evidence without mutating its source or scalar history', () => {
	const row = emptyAssociation('glyph-0');
	row.evidence.water = { strength: 0.7, count: 3 };
	row.evidence.danger = { strength: 0.4, count: 2 };
	for (const evidence of Object.values(row.evidence)) Object.freeze(evidence);
	Object.freeze(row.evidence);
	Object.freeze(row);
	const update = reinforceAssociation(
		[row],
		'glyph-0',
		{ meanings: { food: true }, amount: 0.25 },
		clamp
	);
	expect(row.evidence.food).toEqual({ strength: 0, count: 0 });
	expect(update.before).toEqual({ food: 0, water: 0.7, danger: 0.4, approach: 0 });
	expect(update.after).toEqual({ food: 0.25, water: 0.7, danger: 0.4, approach: 0 });
	expect(update.associations[0]!.evidence.water).toEqual(row.evidence.water);
	expect(update.associations[0]!.evidence.danger).toEqual(row.evidence.danger);
	update.associations[0]!.evidence.food.strength = 1;
	expect(update.after.food).toBe(0.25);
});

it('preserves evidence counts and source records when confidence falls', () => {
	const row = emptyAssociation('glyph-0');
	row.evidence.food = { strength: 0.4, count: 2 };
	row.evidence.water = { strength: 0.2, count: 3 };
	row.evidence.danger = { strength: 0.1, count: 1 };
	const update = applyNoEvidenceReduction([row], 'glyph-0', 0.25, clamp);
	expect(update.before).toEqual({ food: 0.4, water: 0.2, danger: 0.1, approach: 0 });
	expect(update.after).toEqual({ food: 0.15000000000000002, water: 0, danger: 0, approach: 0 });
	expect(Object.values(update.associations[0]!.evidence).map((entry) => entry.count)).toEqual([
		2, 3, 1, 0
	]);
	expect(row.evidence.food.strength).toBe(0.4);
});
