/**
 * Deterministic need progression and clamping.
 *
 * hunger/thirst are pressure (↑ when idle of that activity).
 * energy is satisfaction (↓ during ordinary activity, ↑ while sleeping).
 */

import type { Creature, CreatureAction, SimulationConfig } from '../types';

export function clampNeed(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(1, Math.max(0, value));
}

export type NeedRates = Pick<
	SimulationConfig,
	| 'hungerRisePerSecond'
	| 'thirstRisePerSecond'
	| 'energyDrainPerSecond'
	| 'eatRecoveryPerSecond'
	| 'drinkRecoveryPerSecond'
	| 'sleepRecoveryPerSecond'
>;

/**
 * Advance needs for one fixed step based on the current action.
 * Eating/drinking/sleeping recover the corresponding need and still apply
 * other need pressures as documented (only the matching recovery replaces rise).
 */
export function advanceNeeds(
	creature: Pick<Creature, 'hunger' | 'thirst' | 'energy' | 'action'>,
	dt: number,
	rates: NeedRates
): { hunger: number; thirst: number; energy: number } {
	const action: CreatureAction = creature.action;
	let { hunger, thirst, energy } = creature;

	if (action === 'eat') {
		hunger -= rates.eatRecoveryPerSecond * dt;
	} else {
		hunger += rates.hungerRisePerSecond * dt;
	}

	if (action === 'drink') {
		thirst -= rates.drinkRecoveryPerSecond * dt;
	} else {
		thirst += rates.thirstRisePerSecond * dt;
	}

	if (action === 'sleep') {
		energy += rates.sleepRecoveryPerSecond * dt;
	} else {
		energy -= rates.energyDrainPerSecond * dt;
	}

	return {
		hunger: clampNeed(hunger),
		thirst: clampNeed(thirst),
		energy: clampNeed(energy)
	};
}

export function recoveryComplete(
	creature: Pick<Creature, 'hunger' | 'thirst' | 'energy' | 'action'>,
	config: Pick<SimulationConfig, 'eatUntilHunger' | 'drinkUntilThirst' | 'sleepUntilEnergy'>
): boolean {
	switch (creature.action) {
		case 'eat':
			return creature.hunger <= config.eatUntilHunger;
		case 'drink':
			return creature.thirst <= config.drinkUntilThirst;
		case 'sleep':
			return creature.energy >= config.sleepUntilEnergy;
		default:
			return false;
	}
}
