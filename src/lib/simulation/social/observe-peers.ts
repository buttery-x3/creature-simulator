import { isMature, DEFAULT_LIFECYCLE_CONFIG, type LifecycleConfig } from '../lifecycle';
import { distanceSquared } from '../creature-movement';
import type { Creature } from '../types';
import { SOCIAL_DEFAULTS } from './defaults';
import type { PeerObservation } from './types';

/** A simultaneous population snapshot avoids leaking iteration order into local knowledge. */
export function observePeers(
	creature: Pick<Creature, 'id' | 'position'>,
	population: readonly Creature[],
	timeSeconds: number,
	radius: number,
	lifecycleConfig: Pick<LifecycleConfig, 'maturitySeconds'> = DEFAULT_LIFECYCLE_CONFIG
): PeerObservation[] {
	return population
		.filter(
			(peer) =>
				peer.id !== creature.id && distanceSquared(creature.position, peer.position) <= radius ** 2
		)
		.sort(
			(a, b) =>
				distanceSquared(creature.position, a.position) -
					distanceSquared(creature.position, b.position) || a.id.localeCompare(b.id)
		)
		.slice(0, SOCIAL_DEFAULTS.peerCapacity)
		.map((peer) => {
			const expression = peer.social.expression;
			return {
				id: peer.id,
				mature: isMature(peer.lifecycle, lifecycleConfig),
				position: { ...peer.position },
				observedAt: timeSeconds,
				expression:
					expression && expression.startedAt <= timeSeconds && expression.expiresAt > timeSeconds
						? { id: expression.id, kind: expression.kind, intensity: expression.intensity }
						: null
			};
		});
}
