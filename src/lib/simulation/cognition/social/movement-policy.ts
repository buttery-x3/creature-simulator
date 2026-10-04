import { distanceSquared } from '../../creature-movement';
import { SOCIAL_DEFAULTS } from '../../social';
import type { ArbitrationInput, IntentionCandidate } from '../types';

export const MOVEMENT_UTILITY = {
	responseBonus: 0.12,
	callBenefit: 0.06,
	callEffort: 0.01,
	callCooldownSeconds: 12,
	maximum: 0.6
} as const;

/** Compare silent and calling plans within the same voluntary movement opportunity. */
export function withMovementPlan(
	input: ArbitrationInput,
	candidate: IntentionCandidate
): IntentionCandidate {
	if (!candidate.valid || candidate.target?.kind !== 'creature' || !input.social) return candidate;
	const peerId = candidate.target.creatureId;
	const peer = input.social.peers.find((p) => p.id === peerId);
	if (!peer || input.timeSeconds - peer.observedAt > SOCIAL_DEFAULTS.peerFreshnessSeconds)
		return candidate;
	const relationship = input.social.state.relationships.find((row) => row.peerId === peerId);
	const familiarity = relationship?.familiarity ?? 0,
		liking = Math.max(0, relationship?.liking ?? 0);
	const response = input.social.response;
	const matchingResponse =
		response?.peerId === peerId &&
		response.heardAt <= input.timeSeconds &&
		response.expiresAt > input.timeSeconds;
	const strength =
		matchingResponse && input.lexicon.approach === response.symbolId
			? (input.symbolAssociations?.find((row) => row.symbolId === response.symbolId)?.evidence
					.approach.strength ?? 0)
			: 0;
	const comfort = Math.max(
		0,
		Math.min(1 - input.hunger, 1 - input.thirst, input.energy, input.physical?.body.health ?? 1)
	);
	const bonus =
		candidate.intention === 'approach_peer' && familiarity > 0 && liking > 0
			? MOVEMENT_UTILITY.responseBonus * strength * comfort * Math.min(1, familiarity + liking)
			: 0;
	const previous = input.social.state.movementCall;
	const sameEpisode =
		previous?.peerId === peerId &&
		previous.intention === candidate.intention &&
		input.currentIntention === candidate.intention &&
		previous.intentionStartedAt === (input.currentIntentionStartedAt ?? 0);
	const outsideContact =
		distanceSquared(input.position, peer.position) > SOCIAL_DEFAULTS.comfortDistance ** 2;
	const ready =
		input.speechReady &&
		outsideContact &&
		!matchingResponse &&
		!sameEpisode &&
		(!previous || input.timeSeconds - previous.timeSeconds >= MOVEMENT_UTILITY.callCooldownSeconds);
	const callGain = ready
		? Math.max(
				0,
				MOVEMENT_UTILITY.callBenefit * input.verbosity * Math.min(1, familiarity + liking) -
					MOVEMENT_UTILITY.callEffort
			)
		: 0;
	const score = Math.min(MOVEMENT_UTILITY.maximum, candidate.baseScore + bonus + callGain);
	return {
		...candidate,
		score,
		baseScore: score,
		factors: [
			...candidate.factors,
			{ code: 'approach_prediction_strength', value: strength },
			{ code: 'approach_signal_bonus', value: bonus },
			{ code: 'movement_call_gain', value: callGain },
			{ code: 'movement_call_selected', value: callGain > 0 ? 1 : 0 }
		],
		reasonCodes: [
			...candidate.reasonCodes,
			...(bonus > 0 ? ['learned_approach_prediction' as const] : []),
			...(callGain > 0 ? ['approach_call_plan' as const] : [])
		]
	};
}
