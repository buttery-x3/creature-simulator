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
 * Optional consumption grants from the world-resource phase.
 * When eating/drinking, recovery is bounded by actual quantity granted
 * (not the full recovery rate if the source is nearly empty).
 */
export type ConsumptionGrants = {
	/** Hunger pressure reduction granted this step (abstract units, 1:1). */
	food: number;
	/** Thirst pressure reduction granted this step. */
	water: number;
};

/**
 * Advance needs for one fixed step based on the current action.
 * Eating/drinking recover only from world consumption grants when provided;
 * without grants, eat/drink apply zero recovery (callers must pass grants
 * from the resource step). Sleeping still uses sleepRecoveryPerSecond.
 */
export function advanceNeeds(
	creature: Pick<Creature, 'hunger' | 'thirst' | 'energy' | 'action'>,
	dt: number,
	rates: NeedRates,
	grants: ConsumptionGrants = { food: 0, water: 0 }
): { hunger: number; thirst: number; energy: number } {
	const action: CreatureAction = creature.action;
	let { hunger, thirst, energy } = creature;

	if (action === 'eat') {
		// Recovery limited by actual food withdrawn this step (never exceeds grant).
		const granted = Number.isFinite(grants.food) ? Math.max(0, grants.food) : 0;
		hunger -= granted;
	} else {
		hunger += rates.hungerRisePerSecond * dt;
	}

	if (action === 'drink') {
		const granted = Number.isFinite(grants.water) ? Math.max(0, grants.water) : 0;
		thirst -= granted;
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
