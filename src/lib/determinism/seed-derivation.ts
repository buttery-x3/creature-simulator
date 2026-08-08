/**
 * Pure seed derivation for independent deterministic streams.
 *
 * Streams for habitat generation, creature creation, and search decisions must
 * not share mutable RNG state. Derive independent seed strings from a base seed
 * plus stable channel tags so call-count changes in one stream cannot affect
 * another.
 */

import { hashSeed } from './seeded-rng';

/**
 * Derive a stable seed string from a base seed and one or more channel parts.
 * Parts may be strings or numbers (for creature ids and decision indices).
 */
export function deriveSeed(baseSeed: string, ...parts: Array<string | number>): string {
	if (baseSeed.length === 0) {
		throw new Error('deriveSeed requires a non-empty base seed');
	}
	if (parts.length === 0) {
		throw new Error('deriveSeed requires at least one channel part');
	}

	// Mix each part into a 32-bit hash, then emit a compact deterministic string.
	// Using "::" separators keeps the preimage human-readable for debugging while
	// hashSeed produces a well-distributed numeric mix.
	let mixed = hashSeed(baseSeed);
	for (const part of parts) {
		const tag = typeof part === 'number' ? `#${part}` : String(part);
		// Mix previous hash with part so order and content both matter.
		mixed = hashSeed(`${mixed.toString(16)}::${tag}`) ^ Math.imul(mixed, 0x9e3779b9);
		mixed = mixed >>> 0;
	}

	return `d:${mixed.toString(16)}`;
}
