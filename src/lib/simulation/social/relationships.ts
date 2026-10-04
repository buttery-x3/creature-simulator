import { SOCIAL_DEFAULTS } from './defaults';
import type { PeerObservation, Relationship, SocialState } from './types';

export function emptySocialState(): SocialState {
	return {
		relationships: [],
		movementCall: null,
		expression: null,
		expressionSequence: 0,
		nextExpressionAt: 0,
		recentPain: 0
	};
}

/** Only actual current sensing calls this; elapsed unseen time never becomes contact. */
export function updateRelationships(
	social: SocialState,
	peers: readonly PeerObservation[],
	timeSeconds: number,
	elapsed: number,
	comfortable: boolean
): SocialState {
	const retained = new Map(
		social.relationships
			.filter((row) => timeSeconds - row.lastSeenAt < SOCIAL_DEFAULTS.relationshipLifetimeSeconds)
			.map((row) => [row.peerId, row])
	);
	for (const peer of peers.slice(0, SOCIAL_DEFAULTS.peerCapacity)) {
		if (peer.observedAt !== timeSeconds) continue;
		const prior = retained.get(peer.id);
		if (prior?.lastSeenAt === timeSeconds) continue;
		const consecutive =
			prior && timeSeconds - prior.lastSeenAt <= SOCIAL_DEFAULTS.peerFreshnessSeconds + 1e-9;
		const contact = consecutive
			? Math.max(
					0,
					Math.min(
						elapsed,
						timeSeconds - prior.lastSeenAt,
						SOCIAL_DEFAULTS.contactIntervalCapSeconds
					)
				)
			: 0;
		const newDance =
			comfortable &&
			peer.expression?.kind === 'dance' &&
			peer.expression.id !== prior?.lastExpressionId;
		const row: Relationship = {
			peerId: peer.id,
			familiarity: Math.min(
				1,
				(prior?.familiarity ?? 0) + contact * SOCIAL_DEFAULTS.familiarityPerSecond
			),
			liking: Math.min(
				1,
				(prior?.liking ?? 0) +
					(comfortable ? contact * SOCIAL_DEFAULTS.comfortableLikingPerSecond : 0) +
					(newDance ? SOCIAL_DEFAULTS.danceLikingGain * peer.expression!.intensity : 0)
			),
			lastSeenAt: timeSeconds,
			lastExpressionId: peer.expression?.id ?? prior?.lastExpressionId ?? null
		};
		retained.set(peer.id, row);
	}
	return {
		...social,
		relationships: [...retained.values()]
			.sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.peerId.localeCompare(b.peerId))
			.slice(0, SOCIAL_DEFAULTS.relationshipCapacity)
	};
}
