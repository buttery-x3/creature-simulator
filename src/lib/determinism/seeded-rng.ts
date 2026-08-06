/**
 * Deterministic pseudo-random number generator for simulation and generation.
 * Never use Math.random() on those paths.
 */

/**
 * Hash a string seed into a 32-bit unsigned integer.
 * FNV-1a variant so short strings (e.g. "demo") spread well.
 */
export function hashSeed(seed: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < seed.length; i += 1) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export type SeededRng = {
	/** Next float in [0, 1). */
	next(): number;
	/** Next float in [min, max). */
	nextRange(min: number, max: number): number;
	/** Next integer in [min, max] inclusive. */
	nextInt(min: number, max: number): number;
};

/**
 * Mulberry32 PRNG. Same seed always yields the same sequence.
 */
export function createSeededRng(seed: string): SeededRng {
	let state = hashSeed(seed);

	function next(): number {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	return {
		next,
		nextRange(min: number, max: number): number {
			if (!(max >= min)) {
				throw new Error(`nextRange requires max >= min, received min=${min} max=${max}`);
			}
			if (max === min) {
				// Consume a sample so fixed ranges still advance the stream deterministically.
				next();
				return min;
			}
			return min + next() * (max - min);
		},
		nextInt(min: number, max: number): number {
			if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
				throw new Error(
					`nextInt requires integer min/max with max >= min, received min=${min} max=${max}`
				);
			}
			return min + Math.floor(next() * (max - min + 1));
		}
	};
}
