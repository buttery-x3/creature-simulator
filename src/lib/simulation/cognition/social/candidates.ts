import { distanceSquared } from '../../creature-movement';
import { deriveMood, SOCIAL_DEFAULTS, type ExpressionKind, type MoodSnapshot } from '../../social';
import type { ArbitrationInput, CandidateReasonCode, IntentionCandidate } from '../types';

/** Optional social expression/approach remains below acute resource and rest utility. */
export const SOCIAL_UTILITY = {
	approachBaseline: 0.08,
	familiarityWeight: 0.22,
	likingWeight: 0.25,
	observedDistressWeight: 0.25,
	maximumApproach: 0.6,
	danceWeight: 0.42,
	cryWeight: 0.48
} as const;

function empty(
	intention: 'approach_peer' | ExpressionKind,
	reason: CandidateReasonCode = 'no_social_opportunity'
): IntentionCandidate {
	return {
		intention,
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

function expressionCandidate(
	input: ArbitrationInput,
	kind: ExpressionKind,
	mood: MoodSnapshot,
	hasCompany: boolean
): IntentionCandidate {
	const social = input.social!.state;
	const active =
		social.expression?.kind === kind && social.expression.expiresAt > input.timeSeconds
			? social.expression
			: null;
	if (!active && input.timeSeconds < social.nextExpressionAt)
		return empty(kind, 'expression_cooldown');
	const intensity = active?.intensity ?? (kind === 'dance' ? mood.positive : mood.distress);
	const valid =
		Boolean(active) || (kind === 'dance' ? hasCompany && intensity > 0.15 : intensity > 0.3);
	if (!valid) return empty(kind);
	const score =
		intensity * (kind === 'dance' ? SOCIAL_UTILITY.danceWeight : SOCIAL_UTILITY.cryWeight);
	return {
		...empty(kind),
		valid: true,
		target: { kind: 'point', position: { ...input.position } },
		reference: { kind: 'point', position: { ...input.position } },
		rejectionReason: undefined,
		baseScore: score,
		score,
		factors: [
			{ code: kind === 'dance' ? 'positive_mood' : 'experienced_distress', value: intensity },
			{ code: 'welfare_comfort', value: mood.comfort },
			{ code: 'familiar_company', value: mood.company }
		],
		reasonCodes: [active ? 'expression_active' : 'social_opportunity']
	};
}

export function buildSocialCandidates(input: ArbitrationInput): IntentionCandidate[] {
	if (!input.social) return [empty('approach_peer'), empty('dance'), empty('cry')];
	const peers = input.social.peers
		.filter(
			(peer) =>
				input.timeSeconds >= peer.observedAt &&
				input.timeSeconds - peer.observedAt <= SOCIAL_DEFAULTS.peerFreshnessSeconds + 1e-9
		)
		.slice(0, SOCIAL_DEFAULTS.peerCapacity);
	const mood = deriveMood({
		hunger: input.hunger,
		thirst: input.thirst,
		energy: input.energy,
		body: input.physical?.body ?? { health: 1 },
		social: input.social.state,
		perceivedPeers: peers
	});
	let approach = empty('approach_peer');
	for (const peer of [...peers].sort((a, b) => a.id.localeCompare(b.id))) {
		const distance = Math.sqrt(distanceSquared(input.position, peer.position));
		if (distance <= SOCIAL_DEFAULTS.comfortDistance) continue;
		const relationship = input.social.state.relationships.find(
			(row) =>
				row.peerId === peer.id &&
				input.timeSeconds - row.lastSeenAt < SOCIAL_DEFAULTS.relationshipLifetimeSeconds
		);
		const familiarity = relationship?.familiarity ?? 0;
		const liking = Math.max(0, relationship?.liking ?? 0);
		const distress = peer.expression?.kind === 'cry' ? peer.expression.intensity : 0;
		const interest =
			SOCIAL_UTILITY.approachBaseline +
			familiarity * SOCIAL_UTILITY.familiarityWeight +
			liking * SOCIAL_UTILITY.likingWeight +
			distress * SOCIAL_UTILITY.observedDistressWeight;
		const score = Math.min(
			SOCIAL_UTILITY.maximumApproach,
			(interest * (0.5 + 0.5 * mood.comfort)) / (1 + distance / 4)
		);
		if (approach.valid && score <= approach.baseScore) continue;
		approach = {
			...empty('approach_peer'),
			valid: true,
			score,
			baseScore: score,
			target: { kind: 'creature', creatureId: peer.id },
			reference: { kind: 'creature', creatureId: peer.id },
			factors: [
				{ code: 'familiarity', value: familiarity },
				{ code: 'liking', value: liking },
				{ code: 'observed_distress', value: distress },
				{ code: 'welfare_comfort', value: mood.comfort },
				{ code: 'peer_distance', value: distance }
			],
			reasonCodes: [distress > 0 ? 'observed_distress' : 'peer_affinity'],
			rejectionReason: undefined
		};
	}
	return [
		approach,
		expressionCandidate(input, 'dance', mood, peers.length > 0),
		expressionCandidate(input, 'cry', mood, peers.length > 0)
	];
}
