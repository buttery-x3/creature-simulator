import type { ArbitrationTrigger } from '../../cognition/types';
import type { Creature } from '../../types';
import { hasAcuteCompetingNeed } from '../needs';

type ReconsiderationContext = {
	incomingPendingTrigger: ArbitrationTrigger | null;
	wildlifeChanged: boolean;
	perceptionChanged: boolean;
	peerChanged?: boolean;
	dangerReplanned: boolean;
	emissionRequested: boolean;
};

/** Select an arbitration request, never an intention. Recovery uses the existing bounded clock. */
export function reconsiderationTrigger(
	creature: Creature,
	timeSeconds: number,
	context: ReconsiderationContext
): ArbitrationTrigger | null {
	if (context.emissionRequested || context.dangerReplanned) return null;
	const isRecovering =
		creature.action === 'eat' || creature.action === 'drink' || creature.action === 'sleep';
	if (isRecovering) {
		return timeSeconds >= creature.nextReconsiderAt && hasAcuteCompetingNeed(creature)
			? 'periodic'
			: null;
	}
	if (context.incomingPendingTrigger) return context.incomingPendingTrigger;
	if (creature.pendingArbitrationTrigger) return creature.pendingArbitrationTrigger;
	if (context.wildlifeChanged) return 'wildlife_perception_change';
	if (context.perceptionChanged) return 'relevant_resource_perception_change';
	if (context.peerChanged) return 'peer_perception_change';
	return timeSeconds >= creature.nextReconsiderAt ? 'periodic' : null;
}
