/**
 * Default cognition scoring constants (FLAME-79).
 * Tuned so pure scenarios show clear, observable margins without locks.
 */

import type { CognitionConfig } from './types';

/**
 * Defaults mirror need thresholds for behavioural familiarity.
 * Continuity is a modest soft bonus — not min-commitment or switch-margin gates.
 * Wander does not receive continuity (see applyContinuity).
 *
 * Approximate relationships:
 * - wander ≈ 0.35 (aimless default; no continuity stickiness)
 * - announce above wander so idle discovery yields announce_resource
 * - announce below need thresholds (~0.45) so meaningful needs outrank sharing
 * - signal modestly above announce so investigation beats optional announce
 * - continuity ≈ 0.10 resists thrashing without making activity uninterruptible
 */
export const DEFAULT_COGNITION_CONFIG: CognitionConfig = {
	seekFoodThreshold: 0.45,
	seekWaterThreshold: 0.45,
	restThreshold: 0.4,
	wanderBaseline: 0.35,
	signalBaseline: 0.4,
	signalRecencyBoostMax: 0.05,
	announceBaseline: 0.38,
	continuityBonus: 0.1
};

export function mergeCognitionConfig(overrides: Partial<CognitionConfig> = {}): CognitionConfig {
	return { ...DEFAULT_COGNITION_CONFIG, ...overrides };
}
