/** Reversible local-social balance and retention bounds. */
export const SOCIAL_DEFAULTS = {
	relationshipCapacity: 8,
	peerCapacity: 16,
	relationshipLifetimeSeconds: 180,
	peerFreshnessSeconds: 0.5,
	contactIntervalCapSeconds: 0.5,
	comfortDistance: 1,
	familiarityPerSecond: 0.03,
	comfortableLikingPerSecond: 0.006,
	danceLikingGain: 0.025,
	painDecayPerSecond: 0.08,
	expressionDurationSeconds: 1,
	expressionCooldownSeconds: 12,
	expressionEnergyCost: 0.004
} as const;
