import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { BodyState, EcologyConfig } from './types';
import type { Creature } from '../types';

export const DEFAULT_ECOLOGY_CONFIG: EcologyConfig = {
	wildlifeCount: 6,
	dayLengthSeconds: 180,
	wildlifeSensingRadius: 3.5,
	wildlifeSpeed: 0.65,
	encounterDistance: 0.65,
	attackCooldownSeconds: 2,
	attackDamage: 0.12,
	attackEnergyCost: 0.035,
	movementEnergyCostPerUnit: 0.005,
	activityHungerCostPerSecond: 0.002,
	injuryRecoveryPerSecond: 0.006,
	carcassFoodPerSize: 1.2,
	carcassDecayPerSecond: 0.002,
	wildlifeEnergyDrainPerSecond: 0.003,
	wildlifeRestRecoveryPerSecond: 0.012,
	encounterHistoryLimit: 32
};

export function createBody(seed: string, id: string): BodyState {
	const rng = createSeededRng(deriveSeed(seed, 'body', id));
	return {
		size: rng.nextRange(0.75, 1.25),
		physicality: rng.nextRange(0.65, 1.25),
		health: 1,
		nextAttackAt: 0
	};
}

/** Condition limits effective strength without making an exhausted animal weightless. */
export function bodyAbility(body: BodyState, energy: number): number {
	return body.size * body.physicality * (0.2 + 0.8 * body.health) * (0.3 + 0.7 * energy);
}

/** Starts at dawn; phase is derived from authoritative simulation time only. */
export function daylightAt(time: number, config: EcologyConfig): number {
	return (1 + Math.sin((time / config.dayLengthSeconds) * Math.PI * 2)) / 2;
}

/** Additional physical effort and tissue repair; ordinary need progression stays in behaviour. */
export function advanceBody(creature: Creature, dt: number, config: EcologyConfig): Creature {
	const active = ['move', 'explore', 'search', 'fight'].includes(creature.action);
	const moving = active && creature.action !== 'fight';
	const effort = active ? creature.body.size * (1.25 - 0.25 * creature.body.physicality) : 0;
	const hunger = Math.min(1, creature.hunger + effort * config.activityHungerCostPerSecond * dt);
	const energy = Math.max(
		0,
		creature.energy -
			(moving ? creature.movementSpeed * effort * config.movementEnergyCostPerUnit * dt : 0)
	);
	const recovery =
		creature.action === 'sleep' && hunger < 0.65 && creature.thirst < 0.65
			? config.injuryRecoveryPerSecond * dt
			: 0;
	return {
		...creature,
		hunger,
		energy,
		body: { ...creature.body, health: Math.min(1, creature.body.health + recovery) }
	};
}
