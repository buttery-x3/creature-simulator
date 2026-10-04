import type { Habitat } from '$lib/habitat';
import { moveToward } from '../../creature-movement';
import {
	advanceCompanionship,
	finishCompanionship,
	FOLLOW_DEFAULTS,
	SOCIAL_DEFAULTS
} from '../../social';
import type { Creature } from '../../types';
import type { BehaviourStepConfig } from '../step-creature-behaviour';

/** Domain expiry requests cognition; it never chooses a replacement action. */
export function advanceFollow(creature: Creature, timeSeconds: number): Creature {
	const next = advanceCompanionship(creature, timeSeconds);
	return creature.social.companionship.active && !next.social.companionship.active
		? { ...next, pendingArbitrationTrigger: 'action_complete' }
		: next;
}

/** Follow only a fresh observed position, leaving comfortable space behind the peer. */
export function pursueFollow(
	creature: Creature,
	dt: number,
	timeSeconds: number,
	habitat: Habitat,
	config: BehaviourStepConfig
): Creature {
	const episode = creature.social.companionship.active;
	if (!episode) return { ...creature, pendingArbitrationTrigger: 'action_complete' };
	const peer = creature.perceivedPeers.find(
		(observed) =>
			observed.id === episode.peerId &&
			observed.observedAt <= timeSeconds &&
			timeSeconds - observed.observedAt <= SOCIAL_DEFAULTS.peerFreshnessSeconds
	);
	if (!peer)
		return {
			...finishCompanionship(creature, timeSeconds, 'lost_contact'),
			pendingArbitrationTrigger: 'action_complete'
		};
	const dx = peer.position.x - creature.position.x;
	const dy = peer.position.y - creature.position.y;
	const distance = Math.hypot(dx, dy);
	if (distance <= FOLLOW_DEFAULTS.farDistance) {
		return advanceFollow(creature, timeSeconds);
	}
	const destination = {
		x: peer.position.x - (dx / distance) * FOLLOW_DEFAULTS.farDistance,
		y: peer.position.y - (dy / distance) * FOLLOW_DEFAULTS.farDistance
	};
	// Clamp this actual movement step to the remaining episode path allowance.
	const remaining = Math.max(0, FOLLOW_DEFAULTS.maximumTravel - episode.travelDistance);
	const movementSpeed = dt > 0 ? Math.min(creature.movementSpeed, remaining / dt) : 0;
	const moved = moveToward({ ...creature, movementSpeed }, destination, dt, habitat.bounds, config);
	return advanceFollow({ ...creature, ...moved }, timeSeconds);
}
