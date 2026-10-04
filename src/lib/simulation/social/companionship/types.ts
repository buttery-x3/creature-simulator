import type { Vec2 } from '$lib/habitat';
export type CompanionContact = {
	peerId: string;
	lastObservedAt: number;
	lastPeerPosition: Vec2;
	lastSelfPosition: Vec2;
	stationarySeconds: number;
	lastComfortable: boolean;
	qualifiedContactSeconds: number;
	qualifiedAt: number | null;
	departureDistance: number;
	heading: Vec2 | null;
};
export type FollowEpisode = {
	peerId: string;
	startedAt: number;
	expiresAt: number;
	travelDistance: number;
	lastSelfPosition: Vec2;
	lastProgressAt: number;
	progressAnchor: Vec2;
};
export type CompanionEndReason =
	| 'lost_contact'
	| 'expired'
	| 'distance_limit'
	| 'no_progress'
	| 'turn_back'
	| 'visible_chain'
	| 'interrupted'
	| 'resource_found';
export type CompanionOutcome = {
	peerId: string;
	timeSeconds: number;
	reason: CompanionEndReason;
	travelDistance: number;
	durationSeconds: number;
};
export type CompanionshipState = {
	contact: CompanionContact | null;
	active: FollowEpisode | null;
	nextEligibleAt: number;
	lastOutcome: CompanionOutcome | null;
};
