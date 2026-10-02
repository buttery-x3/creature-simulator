/**
 * Map the generic per-creature curiosity trait to a bounded optional-investigation
 * preference multiplier used by investigate_signal scoring.
 *
 * Trait domain remains [0, 1]. The multiplier is deliberately not identity:
 * most of the range is quieter than the old uniform signal baseline, while the
 * upper range can restore or exceed that optional competitiveness.
 *
 * investigate_signal is the first consumer; later optional novelty behaviours
 * should reuse this helper rather than inventing parallel mappings.
 *
 * Need-driven information value for investigate_signal is applied separately
 * and must not be scaled by this weight.
 */

/** Minimum optional-investigation weight at curiosity 0 (strongly suppressed, still non-zero). */
export const CURIOSITY_WEIGHT_FLOOR = 0.1;

/** Additional weight gained across the full curiosity span. */
export const CURIOSITY_WEIGHT_SPAN = 1.1;

/**
 * Convert normalized curiosity [0, 1] into an optional investigation multiplier.
 * Monotonic; pure; does not decide candidate validity or need-driven floors.
 */
export function curiosityToInvestigationWeight(curiosity: number): number {
	return CURIOSITY_WEIGHT_FLOOR + CURIOSITY_WEIGHT_SPAN * curiosity;
}
