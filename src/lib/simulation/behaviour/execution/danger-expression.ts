import { canEmit } from '../../communication/emission';
import type { EmissionRequest } from '../../communication/types';
import type { Creature, SimulationConfig } from '../../types';

/** Executes cognition's selected warning while allowing its retreat movement to proceed. */
export function requestDangerWarning(
	creature: Creature,
	timeSeconds: number,
	config: Pick<SimulationConfig, 'emissionCooldownSeconds'>
): EmissionRequest | null {
	if (
		creature.intention !== 'warn_danger' ||
		!canEmit(creature.lastEmissionAt, timeSeconds, config.emissionCooldownSeconds)
	)
		return null;
	return {
		senderId: creature.id,
		origin: { ...creature.position },
		context: 'danger_observed',
		contextDetail: 'danger'
	};
}
