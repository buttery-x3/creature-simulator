/** Physical companionship is a voluntary choice, independent of symbol interpretation. */
import { distanceSquared } from '../../creature-movement';
import {
	FOLLOW_DEFAULTS as POLICY,
	hasVisiblePredecessor,
	hasCompanionDeparture,
	deriveMood,
	SOCIAL_DEFAULTS
} from '../../social';
import { selectResourceNeedTarget } from '../target-selection';
import type { ArbitrationInput, CandidateReasonCode, IntentionCandidate } from '../types';

function invalid(reason: CandidateReasonCode): IntentionCandidate {
	return {
		intention: 'follow_peer',
		valid: false,
		baseScore: 0,
		score: 0,
		continuityAdjustment: 0,
		target: null,
		reference: null,
		factors: [],
		reasonCodes: [reason],
		rejectionReason: reason
	};
}

export function buildFollowCandidate(input: ArbitrationInput): IntentionCandidate {
	const social = input.social;
	if (!social) return invalid('no_companion_departure');
	const state = social.state.companionship;
	if (input.timeSeconds < state.nextEligibleAt) return invalid('follow_cooldown');
	const contact = state.contact,
		active = state.active;
	if (!contact) return invalid('no_companion_departure');
	if (
		active &&
		(input.timeSeconds >= active.expiresAt ||
			active.travelDistance >= POLICY.maximumTravel ||
			input.timeSeconds - active.lastProgressAt >= POLICY.noProgressSeconds)
	)
		return invalid('follow_limit');
	if (!active && !hasCompanionDeparture(state, input.timeSeconds))
		return invalid('no_companion_departure');
	const peers = social.peers.filter(
		(peer) =>
			peer.observedAt <= input.timeSeconds &&
			input.timeSeconds - peer.observedAt <= SOCIAL_DEFAULTS.peerFreshnessSeconds + 1e-9
	);
	const peer = peers.find((row) => row.id === (active?.peerId ?? contact.peerId));
	if (!peer || distanceSquared(input.position, peer.position) > POLICY.maximumDistance ** 2)
		return invalid('no_companion_departure');
	if (
		!active &&
		(!contact.heading ||
			contact.heading.x * (peer.position.x - input.position.x) +
				contact.heading.y * (peer.position.y - input.position.y) <=
				0)
	)
		return invalid('no_companion_departure');
	if (hasVisiblePredecessor(peer.id, peer.position, contact.heading, peers))
		return invalid('follow_visible_chain');
	const relationship = social.state.relationships.find(
		(row) =>
			row.peerId === peer.id &&
			input.timeSeconds - row.lastSeenAt < SOCIAL_DEFAULTS.relationshipLifetimeSeconds
	);
	if (
		!relationship ||
		relationship.familiarity < POLICY.minimumFamiliarity ||
		relationship.liking < POLICY.minimumLiking
	)
		return invalid('no_companion_departure');
	const affinity = Math.sqrt(relationship.familiarity * Math.max(0, relationship.liking));
	const food = selectResourceNeedTarget(input.position, input.availableFood, input.memory, 'food');
	const water = selectResourceNeedTarget(
		input.position,
		input.availableWater,
		input.memory,
		'water'
	);
	const uncertainty = Math.max(
		food.source === 'none' && input.hunger >= input.config.seekFoodThreshold ? input.hunger : 0,
		water.source === 'none' && input.thirst >= input.config.seekWaterThreshold ? input.thirst : 0
	);
	const comfort = deriveMood({
		hunger: input.hunger,
		thirst: input.thirst,
		energy: input.energy,
		body: input.physical?.body ?? { health: 1 },
		social: social.state,
		perceivedPeers: peers
	}).comfort;
	const score = Math.min(
		POLICY.maximumUtility,
		(0.3 + 0.1 * affinity + 0.04 * uncertainty) * (0.5 + 0.5 * comfort)
	);
	return {
		intention: 'follow_peer',
		valid: true,
		baseScore: score,
		score,
		continuityAdjustment: 0,
		target: { kind: 'creature', creatureId: peer.id },
		reference: { kind: 'creature', creatureId: peer.id },
		factors: [
			{ code: 'companion_affinity', value: affinity },
			{ code: 'observed_departure', value: contact.departureDistance },
			{ code: 'companion_contact_seconds', value: contact.qualifiedContactSeconds },
			{ code: 'unresolved_need_information', value: uncertainty },
			{ code: 'welfare_comfort', value: comfort },
			{
				code: 'follow_time_remaining',
				value: active ? Math.max(0, active.expiresAt - input.timeSeconds) : POLICY.followSeconds
			},
			{ code: 'follow_travel_distance', value: active?.travelDistance ?? 0 }
		],
		reasonCodes: [active ? 'follow_active' : 'companion_departure']
	};
}
