import { withMovementPlan } from '../social/movement-policy';
import { reproductionEligible } from '../../lifecycle';
import { SOCIAL_DEFAULTS } from '../../social';
import type { ArbitrationInput, CandidateReasonCode, IntentionCandidate } from '../types';

/** Courtship is an optional, physically affordable interaction grounded in acquired affiliation. */
export const COURTSHIP_UTILITY = {
	minimumFamiliarity: 0.2,
	minimumLiking: 0.04,
	baseline: 0.42,
	bondWeight: 0.18,
	maximum: 0.6
} as const;

function unavailable(reason: CandidateReasonCode): IntentionCandidate {
	return {
		intention: 'court_peer',
		valid: false,
		score: 0,
		baseScore: 0,
		continuityAdjustment: 0,
		target: null,
		reference: null,
		factors: [],
		reasonCodes: [reason],
		rejectionReason: reason
	};
}

/** Never sees partner need state, reproductive cooldown, intentions, or ancestry. */
export function buildCourtshipCandidate(input: ArbitrationInput): IntentionCandidate {
	if (!input.lifecycle || !input.physical || !input.social) {
		return unavailable('no_reproductive_opportunity');
	}
	if (
		!reproductionEligible(
			{
				lifecycle: input.lifecycle.state,
				body: input.physical.body,
				energy: input.energy,
				hunger: input.hunger,
				thirst: input.thirst
			},
			input.timeSeconds,
			input.lifecycle.config
		)
	) {
		return unavailable('reproductive_ineligible');
	}
	const condition = Math.max(
		0,
		Math.min(1 - input.hunger, 1 - input.thirst, input.energy, input.physical.body.health)
	);
	let best = unavailable('no_reproductive_opportunity');
	for (const peer of [...input.social.peers].sort((a, b) => a.id.localeCompare(b.id))) {
		if (
			!peer.mature ||
			input.timeSeconds < peer.observedAt ||
			input.timeSeconds - peer.observedAt > SOCIAL_DEFAULTS.peerFreshnessSeconds + 1e-9
		)
			continue;
		const relationship = input.social.state.relationships.find(
			(row) =>
				row.peerId === peer.id &&
				input.timeSeconds - row.lastSeenAt < SOCIAL_DEFAULTS.relationshipLifetimeSeconds
		);
		if (
			!relationship ||
			relationship.familiarity < COURTSHIP_UTILITY.minimumFamiliarity ||
			relationship.liking < COURTSHIP_UTILITY.minimumLiking
		)
			continue;
		const bond = Math.sqrt(relationship.familiarity * Math.max(0, relationship.liking));
		const score = Math.min(
			COURTSHIP_UTILITY.maximum,
			(COURTSHIP_UTILITY.baseline + COURTSHIP_UTILITY.bondWeight * bond) * condition
		);
		const candidate = withMovementPlan(input, {
			...unavailable('no_reproductive_opportunity'),
			valid: true,
			score,
			baseScore: score,
			target: { kind: 'creature', creatureId: peer.id },
			reference: { kind: 'creature', creatureId: peer.id },
			factors: [
				{ code: 'familiarity', value: relationship.familiarity },
				{ code: 'liking', value: relationship.liking },
				{ code: 'reproductive_condition', value: condition },
				{ code: 'acquired_bond', value: bond }
			],
			reasonCodes: ['reproductive_opportunity'],
			rejectionReason: undefined
		});
		if (!best.valid || candidate.baseScore > best.baseScore) best = candidate;
	}
	return best;
}
