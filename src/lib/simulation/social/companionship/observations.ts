/** Consecutive local positions qualify a direct companion; no peer intent or resource knowledge. */
import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../../creature-movement';
import type { Creature, SimulationConfig } from '../../types';
import type { PeerObservation } from '../types';
import { deriveMood } from '../expressions';
import { FOLLOW_DEFAULTS as POLICY } from './defaults';
import { finishCompanionship } from './session';
import type { CompanionContact } from './types';

const EPSILON = 1e-9;
const distance = (a: Vec2, b: Vec2) => Math.sqrt(distanceSquared(a, b));

/** Reject only an actually visible predecessor ahead of the observed peer's movement. */
export function hasVisiblePredecessor(
	peerId: string,
	position: Vec2,
	heading: Vec2 | null,
	peers: readonly PeerObservation[]
): boolean {
	if (!heading) return false;
	return peers.some((other) => {
		if (other.id === peerId) return false;
		const dx = other.position.x - position.x,
			dy = other.position.y - position.y;
		const ahead = dx * heading.x + dy * heading.y;
		const lateral = Math.abs(dx * heading.y - dy * heading.x);
		return ahead > 0 && ahead <= POLICY.predecessorDistance && lateral <= POLICY.predecessorWidth;
	});
}

function freshContact(peer: PeerObservation, self: Vec2, comfortable: boolean): CompanionContact {
	return {
		peerId: peer.id,
		lastObservedAt: peer.observedAt,
		lastPeerPosition: { ...peer.position },
		lastSelfPosition: { ...self },
		stationarySeconds: 0,
		lastComfortable: comfortable,
		qualifiedContactSeconds: 0,
		qualifiedAt: null,
		departureDistance: 0,
		heading: null
	};
}

function updateContact(
	contact: CompanionContact,
	peer: PeerObservation,
	creature: Creature,
	interval: number
): CompanionContact {
	const elapsed = peer.observedAt - contact.lastObservedAt;
	if (elapsed <= 0) return contact;
	if (elapsed > 2 * interval + EPSILON)
		return freshContact(
			peer,
			creature.position,
			deriveMood(creature).comfort >= POLICY.minimumComfort
		);
	const dx = peer.position.x - contact.lastPeerPosition.x,
		dy = peer.position.y - contact.lastPeerPosition.y;
	const moved = Math.hypot(dx, dy);
	const previousDistance = distance(contact.lastPeerPosition, contact.lastSelfPosition);
	const outward =
		previousDistance > EPSILON
			? (dx * (contact.lastPeerPosition.x - contact.lastSelfPosition.x) +
					dy * (contact.lastPeerPosition.y - contact.lastSelfPosition.y)) /
				previousDistance
			: 0;
	const comfortable = deriveMood(creature).comfort >= POLICY.minimumComfort;
	const stationary =
		distance(peer.position, creature.position) <= POLICY.nearDistance &&
		moved <= POLICY.stationarySpeed * elapsed + EPSILON &&
		distance(creature.position, contact.lastSelfPosition) <=
			POLICY.stationarySpeed * elapsed + EPSILON &&
		comfortable &&
		contact.lastComfortable;
	const stationarySeconds = stationary
		? contact.stationarySeconds + Math.min(interval, elapsed)
		: 0;
	const qualified = stationarySeconds + EPSILON >= POLICY.stationaryContactSeconds;
	return {
		...contact,
		lastObservedAt: peer.observedAt,
		lastPeerPosition: { ...peer.position },
		lastSelfPosition: { ...creature.position },
		stationarySeconds,
		lastComfortable: comfortable,
		qualifiedContactSeconds: qualified ? stationarySeconds : contact.qualifiedContactSeconds,
		qualifiedAt: qualified ? peer.observedAt : contact.qualifiedAt,
		departureDistance: qualified ? 0 : contact.departureDistance + outward,
		heading: moved > EPSILON ? { x: dx / moved, y: dy / moved } : contact.heading
	};
}

/** Actual sensing only; one recent contact and one selected episode bound all retention. */
export function observeCompanionship(
	creature: Creature,
	time: number,
	config: Pick<SimulationConfig, 'perceptionIntervalSeconds' | 'sensingRadius'>
): Creature {
	const state = creature.social.companionship;
	const peers = creature.perceivedPeers.filter(
		(peer) =>
			peer.observedAt === time &&
			distanceSquared(peer.position, creature.position) <= config.sensingRadius ** 2
	);
	const old = state.contact;
	if (
		state.active &&
		old &&
		time - old.lastObservedAt > 2 * config.perceptionIntervalSeconds + EPSILON
	)
		return finishCompanionship(creature, time, 'lost_contact');
	const watched = old ? peers.find((peer) => peer.id === old.peerId) : undefined;
	let contact =
		old && watched ? updateContact(old, watched, creature, config.perceptionIntervalSeconds) : null;
	if (
		contact &&
		!state.active &&
		((contact.qualifiedAt === null &&
			distance(contact.lastPeerPosition, creature.position) > POLICY.nearDistance) ||
			(contact.qualifiedAt !== null && time >= contact.qualifiedAt + POLICY.departureWindowSeconds))
	)
		contact = null;
	if (!contact && !state.active && time >= state.nextEligibleAt) {
		const nearby = peers
			.filter(
				(peer) => distanceSquared(peer.position, creature.position) <= POLICY.nearDistance ** 2
			)
			.sort(
				(a, b) =>
					distanceSquared(a.position, creature.position) -
						distanceSquared(b.position, creature.position) || a.id.localeCompare(b.id)
			)[0];
		if (nearby)
			contact = freshContact(
				nearby,
				creature.position,
				deriveMood(creature).comfort >= POLICY.minimumComfort
			);
	}
	let next = { ...creature, social: { ...creature.social, companionship: { ...state, contact } } };
	if (!state.active) return next;
	const peer = peers.find((peer) => peer.id === state.active!.peerId);
	if (!peer || !contact) return finishCompanionship(next, time, 'lost_contact');
	if (distance(peer.position, creature.position) > POLICY.maximumDistance)
		return finishCompanionship(next, time, 'distance_limit');
	if (hasVisiblePredecessor(peer.id, peer.position, contact.heading, peers))
		return finishCompanionship(next, time, 'visible_chain');
	if (
		contact.heading &&
		contact.heading.x * (peer.position.x - creature.position.x) +
			contact.heading.y * (peer.position.y - creature.position.y) <
			-0.05
	)
		return finishCompanionship(next, time, 'turn_back');
	if (distance(state.active.progressAnchor, peer.position) >= POLICY.minimumProgress)
		next = {
			...next,
			social: {
				...next.social,
				companionship: {
					...next.social.companionship,
					active: { ...state.active, lastProgressAt: time, progressAnchor: { ...peer.position } }
				}
			}
		};
	else if (time - state.active.lastProgressAt >= POLICY.noProgressSeconds)
		return finishCompanionship(next, time, 'no_progress');
	return next;
}
