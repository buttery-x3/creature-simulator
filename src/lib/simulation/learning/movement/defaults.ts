/** Bounded local sequence observation, not a command grammar. */
export const MOVEMENT_DEFAULTS = {
	encounterCapacity: 16,
	pendingCapacity: 4,
	observationWindowSeconds: 4,
	encounterAbsenceSeconds: 12,
	originBindingRadius: 0.25,
	minimumPeerApproachDistance: 0.35,
	negligiblePeerApproachDistance: 0.02,
	contactDistance: 1,
	comfortableContactSeconds: 0.5,
	minimumComfort: 0.65,
	maximumObservationGapIntervals: 2,
	responseLifetimeSeconds: 4,
	responseCooldownSeconds: 12,
	contradictionReduction: 0.1
} as const;
