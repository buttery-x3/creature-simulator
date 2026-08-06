import { describe, expect, it } from 'vitest';
import { createSeededRng } from './seeded-rng';
import { deriveSeed } from './seed-derivation';

describe('deriveSeed', () => {
	it('is deterministic for the same inputs', () => {
		expect(deriveSeed('demo', 'creatures')).toBe(deriveSeed('demo', 'creatures'));
		expect(deriveSeed('demo', 'wander', 'creature-0', 3)).toBe(
			deriveSeed('demo', 'wander', 'creature-0', 3)
		);
	});

	it('diverges across channels for the same base seed', () => {
		const creatures = deriveSeed('demo', 'creatures');
		const wander = deriveSeed('demo', 'wander', 'creature-0', 0);
		expect(creatures).not.toBe(wander);
	});

	it('diverges for different decision indices', () => {
		expect(deriveSeed('demo', 'wander', 'creature-0', 0)).not.toBe(
			deriveSeed('demo', 'wander', 'creature-0', 1)
		);
	});

	it('produces independent RNG streams from the same base seed', () => {
		const habitat = createSeededRng('demo');
		const creatures = createSeededRng(deriveSeed('demo', 'creatures'));

		// Burn habitat samples; creature stream must be unaffected.
		const creatureSeqBefore = Array.from({ length: 4 }, () => creatures.next());
		for (let i = 0; i < 40; i += 1) {
			habitat.next();
		}
		const creaturesAfter = createSeededRng(deriveSeed('demo', 'creatures'));
		const creatureSeqAfter = Array.from({ length: 4 }, () => creaturesAfter.next());
		expect(creatureSeqAfter).toEqual(creatureSeqBefore);
	});

	it('rejects empty base seed or missing parts', () => {
		expect(() => deriveSeed('', 'creatures')).toThrow(/non-empty/);
		expect(() => deriveSeed('demo')).toThrow(/at least one/);
	});
});
