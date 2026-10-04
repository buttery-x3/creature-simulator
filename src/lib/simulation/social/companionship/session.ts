import { distanceSquared } from '../../creature-movement';
import type { Creature } from '../../types';
import { FOLLOW_DEFAULTS as POLICY } from './defaults';
import type { CompanionshipState, CompanionEndReason } from './types';

export function emptyCompanionshipState(): CompanionshipState {
	return { contact: null, active: null, nextEligibleAt: 0, lastOutcome: null };
}

/** One bounded outcome is retained; no resource, relationship or symbol credit is created. */
export function finishCompanionship(
	creature: Creature,
	time: number,
	reason: CompanionEndReason
): Creature {
	const state = creature.social.companionship;
	const episode = state.active;
	if (!episode) return creature;
	return {
		...creature,
		social: {
			...creature.social,
			companionship: {
				...state,
				contact: null,
				active: null,
				nextEligibleAt: time + POLICY.cooldownSeconds,
				lastOutcome: {
					peerId: episode.peerId,
					timeSeconds: time,
					reason,
					travelDistance: episode.travelDistance,
					durationSeconds: Math.max(0, time - episode.startedAt)
				}
			}
		}
	};
}

/** Own selected action starts/stops a session; another creature's action is never consulted. */
export function applyCompanionshipSelection(
	creature: Creature,
	previousIntention: Creature['intention'],
	time: number
): Creature {
	const state = creature.social.companionship;
	if (creature.intention !== 'follow_peer') {
		const resource =
			creature.target?.kind === 'feature' &&
			((creature.intention === 'satisfy_hunger' && creature.target.featureKind === 'food') ||
				(creature.intention === 'satisfy_thirst' && creature.target.featureKind === 'water'));
		return state.active
			? finishCompanionship(creature, time, resource ? 'resource_found' : 'interrupted')
			: creature;
	}
	if (state.active) return creature;
	const contact = state.contact;
	if (
		previousIntention === 'follow_peer' ||
		!contact ||
		contact.qualifiedAt === null ||
		time >= contact.qualifiedAt + POLICY.departureWindowSeconds ||
		time < state.nextEligibleAt ||
		creature.target?.kind !== 'creature' ||
		creature.target.creatureId !== contact.peerId
	)
		return creature;
	const active = {
		peerId: contact.peerId,
		startedAt: time,
		expiresAt: time + POLICY.followSeconds,
		travelDistance: 0,
		lastSelfPosition: { ...creature.position },
		lastProgressAt: time,
		progressAnchor: { ...contact.lastPeerPosition }
	};
	return { ...creature, social: { ...creature.social, companionship: { ...state, active } } };
}

/** Called after physical movement; the hard clock/path bound cannot be refreshed by sensing. */
export function advanceCompanionship(creature: Creature, time: number): Creature {
	const state = creature.social.companionship;
	if (!state.active) return creature;
	const active = {
		...state.active,
		travelDistance:
			state.active.travelDistance +
			Math.sqrt(distanceSquared(state.active.lastSelfPosition, creature.position)),
		lastSelfPosition: { ...creature.position }
	};
	const next = { ...creature, social: { ...creature.social, companionship: { ...state, active } } };
	if (time >= active.expiresAt) return finishCompanionship(next, time, 'expired');
	if (active.travelDistance >= POLICY.maximumTravel)
		return finishCompanionship(next, time, 'distance_limit');
	return next;
}

/** A threshold edge can request reconsideration without selecting a behavior. */
export function hasCompanionDeparture(state: CompanionshipState, time: number): boolean {
	const contact = state.contact;
	return (
		!state.active &&
		time >= state.nextEligibleAt &&
		!!contact &&
		contact.qualifiedAt !== null &&
		time < contact.qualifiedAt + POLICY.departureWindowSeconds &&
		contact.departureDistance + 1e-9 >= POLICY.minimumDeparture
	);
}
