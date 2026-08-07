/**
 * Pure memory-aware continuous intention arbitration (FLAME-79).
 *
 * Single entry point for the cognition subdomain. Side-effect free:
 * identical inputs produce identical ArbitrationRecord outputs.
 *
 * Does not import legacy behaviour/decisions or learning pendingSignals.
 * Runtime wiring is FLAME-80.
 */

import { buildCandidates } from './build-candidates';
import { applyContinuity, buildArbitrationRecord } from './select-intention';
import type { ArbitrationInput, ArbitrationRecord } from './types';

/**
 * Build candidates from body + perception + memory, apply soft continuity,
 * and select the best intention with explicit tie-breaking.
 */
export function arbitrate(input: ArbitrationInput): ArbitrationRecord {
	const built = buildCandidates(input);
	const withContinuity = applyContinuity(built, input.currentIntention, input.config);
	return buildArbitrationRecord({
		timeSeconds: input.timeSeconds,
		trigger: input.trigger,
		previousIntention: input.currentIntention,
		candidates: withContinuity
	});
}
