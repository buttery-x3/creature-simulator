import { describe, expect, it } from 'vitest';
import { createSeededRng, hashSeed } from './seeded-rng';

describe('createSeededRng', () => {
	it('returns a stable sequence for the same seed', () => {
		const a = createSeededRng('stable');
		const b = createSeededRng('stable');
		const seqA = Array.from({ length: 8 }, () => a.next());
		const seqB = Array.from({ length: 8 }, () => b.next());
		expect(seqA).toEqual(seqB);
	});

	it('diverges for different seeds', () => {
		const a = createSeededRng('alpha');
		const b = createSeededRng('beta');
		expect(a.next()).not.toBe(b.next());
	});

	it('nextRange stays within bounds', () => {
		const rng = createSeededRng('range');
		for (let i = 0; i < 50; i += 1) {
			const value = rng.nextRange(2, 5);
			expect(value).toBeGreaterThanOrEqual(2);
			expect(value).toBeLessThan(5);
		}
	});

	it('nextRange allows fixed min === max sizes', () => {
		const rng = createSeededRng('fixed');
		expect(rng.nextRange(1.5, 1.5)).toBe(1.5);
	});
});

describe('hashSeed', () => {
	it('is deterministic', () => {
		expect(hashSeed('demo')).toBe(hashSeed('demo'));
	});

	it('differs for different strings', () => {
		expect(hashSeed('a')).not.toBe(hashSeed('b'));
	});
});
