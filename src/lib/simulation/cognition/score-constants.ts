/**
 * Default cognition scoring constants (FLAME-79, retuned FLAME-82).
 * Tuned so pure scenarios show clear, observable margins without locks.
 */

import type { CognitionConfig } from './types';

/**
 * Defaults mirror need thresholds for behavioural familiarity.
 * Continuity is a modest soft bonus — not min-commitment or switch-margin gates.
 * Explore does not receive continuity (see applyContinuity).
 *
 * Need scores use pressure × target-quality multiplier:
 *   visible (1.0) > remembered (0.70) > search (0.35)
 *
 * Optional investigate_signal uses (baseline + recency) × curiosityWeight;
 * need-driven information floor restores unweighted (baseline + recency) when a
 * valid hunger/thirst need has only search_fallback knowledge (trait-independent).
 *
 * Approximate relationships (relative, not locks):
 * - explore ≈ 0.30 (lowest-information fallback; no continuity stickiness)
 * - high-pressure blind search (1.0 × 0.35 = 0.35) still beats explore
 * - unweighted signal max (0.38 + 0.04) beats blind need search (need floor)
 * - mid curiosity optional signal often loses to explore; high curiosity can win
 * - announce above optional signal and explore so post-consumption sharing wins
 * - announce below bare-threshold *visible* need (0.45 × 1.0)
 * - continuity ≈ 0.05 settles close calls only
 */
export const DEFAULT_COGNITION_CONFIG: CognitionConfig = {
	seekFoodThreshold: 0.45,
	seekWaterThreshold: 0.45,
	restThreshold: 0.4,
	exploreBaseline: 0.3,
	signalBaseline: 0.38,
	signalRecencyBoostMax: 0.04,
	announceBaseline: 0.44,
	continuityBonus: 0.05,
	targetQualityVisible: 1,
	targetQualityRemembered: 0.7,
	targetQualitySearch: 0.35
};

export function mergeCognitionConfig(overrides: Partial<CognitionConfig> = {}): CognitionConfig {
	return { ...DEFAULT_COGNITION_CONFIG, ...overrides };
}
