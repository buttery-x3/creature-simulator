import type { Creature } from '../../types';
import type { EmissionRequest } from '../../communication/types';
import { consumeMovementResponse } from '../../learning/movement';
import { MOVEMENT_UTILITY } from '../../cognition/social/movement-policy';

function selectedFactor(creature: Creature, code: string): number {
	return (
		creature.lastArbitration?.candidates
			.find((row) => row.intention === creature.intention)
			?.factors.find((factor) => factor.code === code)?.value ?? 0
	);
}

/** Execute only the call plan chosen in the current arbitration record. */
export function requestMovementCall(
	creature: Creature,
	time: number
): { creature: Creature; emissionRequest: EmissionRequest | null } {
	if (
		creature.action !== 'move' ||
		(creature.intention !== 'approach_peer' && creature.intention !== 'court_peer') ||
		creature.target?.kind !== 'creature' ||
		selectedFactor(creature, 'movement_call_selected') !== 1
	)
		return { creature, emissionRequest: null };
	const previous = creature.social.movementCall;
	if (
		previous &&
		(time - previous.timeSeconds < MOVEMENT_UTILITY.callCooldownSeconds ||
			(previous.peerId === creature.target.creatureId &&
				previous.intention === creature.intention &&
				previous.intentionStartedAt === creature.intentionStartedAt))
	)
		return { creature, emissionRequest: null };
	return {
		creature: {
			...creature,
			social: {
				...creature.social,
				movementCall: {
					peerId: creature.target.creatureId,
					intention: creature.intention,
					intentionStartedAt: creature.intentionStartedAt,
					timeSeconds: time
				}
			}
		},
		emissionRequest: {
			senderId: creature.id,
			origin: { ...creature.position },
			context: 'approach_started',
			contextDetail: 'approach'
		}
	};
}

/** An interrupted response is spent; an ordinary independent approach is not cancelled. */
export function releaseInterruptedMovementResponse(
	previous: Creature,
	next: Creature,
	time: number
): Creature {
	if (
		previous.intention !== 'approach_peer' ||
		selectedFactor(previous, 'approach_signal_bonus') <= 0 ||
		!next.movementLearning.response
	)
		return next;
	if (
		next.intention === 'approach_peer' &&
		next.target?.kind === 'creature' &&
		next.target.creatureId === next.movementLearning.response.peerId
	)
		return next;
	return { ...next, movementLearning: consumeMovementResponse(next.movementLearning, time) };
}
