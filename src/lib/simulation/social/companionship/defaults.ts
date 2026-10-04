/** Physical companionship limits, independent of learned symbols. */
export const FOLLOW_DEFAULTS = {
	followSeconds: 8,
	maximumTravel: 6,
	cooldownSeconds: 12,
	nearDistance: 1,
	farDistance: 1.5,
	maximumDistance: 3,
	stationaryContactSeconds: 0.5,
	stationarySpeed: 0.2,
	minimumComfort: 0.65,
	departureWindowSeconds: 4,
	minimumDeparture: 0.35,
	noProgressSeconds: 1.5,
	minimumProgress: 0.2,
	predecessorDistance: 1.5,
	predecessorWidth: 0.5,
	maximumUtility: 0.44,
	minimumFamiliarity: 0.2,
	minimumLiking: 0.04
} as const;
