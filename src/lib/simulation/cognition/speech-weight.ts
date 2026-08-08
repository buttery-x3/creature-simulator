/**
 * Map the generic per-creature verbosity trait to a bounded speech-preference
 * multiplier used by communication intention scoring.
 *
 * Trait domain remains [0, 1]. The multiplier is deliberately not identity:
 * most of the range stays quieter than the old raw announceBaseline, while the
 * upper range can still compete with generic signal traffic.
 *
 * announce_resource is the first consumer; later speech intentions should reuse
 * this helper rather than inventing parallel mappings.
 */

/** Minimum speech weight at verbosity 0 (strongly suppressed, still non-zero). */
export const SPEECH_WEIGHT_FLOOR = 0.1;

/** Additional weight gained across the full verbosity span. */
export const SPEECH_WEIGHT_SPAN = 1.1;

/**
 * Convert normalized verbosity [0, 1] into a speech preference multiplier.
 * Monotonic; pure; does not decide candidate validity.
 */
export function verbosityToSpeechWeight(verbosity: number): number {
	return SPEECH_WEIGHT_FLOOR + SPEECH_WEIGHT_SPAN * verbosity;
}
