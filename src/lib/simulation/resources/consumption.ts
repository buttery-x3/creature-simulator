/**
 * Deterministic multi-consumer resource withdrawal for one fixed step.
 *
 * Creatures already on eat/drink at the start of the step request
 * recoveryRate * dt units. Allocation order is stable creature-id sort.
 * Total grants never exceed source amount; amount never goes negative.
 * Depleted food is removed; empty water basins remain with amount 0.
 */

import type { Habitat, ResourceFeature } from '$lib/habitat';
import type { Creature, CreatureTarget } from '../types';
import { emptyGrant, type ConsumptionGrant } from './types';

export type ConsumptionRates = {
	eatRecoveryPerSecond: number;
	drinkRecoveryPerSecond: number;
};

function isFeatureTarget(
	target: CreatureTarget | null,
	kind: 'food' | 'water'
): target is Extract<CreatureTarget, { kind: 'feature' }> {
	return target !== null && target.kind === 'feature' && target.featureKind === kind;
}

/**
 * Resolve eat/drink consumption against habitat resources.
 * Returns updated habitat (new arrays) and per-creature grants.
 */
export function resolveConsumption(input: {
	habitat: Habitat;
	creatures: readonly Creature[];
	dt: number;
	rates: ConsumptionRates;
}): {
	habitat: Habitat;
	grantsByCreatureId: Map<string, ConsumptionGrant>;
} {
	const grantsByCreatureId = new Map<string, ConsumptionGrant>();
	for (const creature of input.creatures) {
		grantsByCreatureId.set(creature.id, emptyGrant());
	}

	// Working copies — mutate then freeze into new habitat.
	const foodById = new Map<string, ResourceFeature>(
		input.habitat.food.map((f) => [
			f.id,
			{ ...f, position: { ...f.position }, size: { ...f.size } }
		])
	);
	const waterById = new Map<string, ResourceFeature>(
		input.habitat.water.map((f) => [
			f.id,
			{ ...f, position: { ...f.position }, size: { ...f.size } }
		])
	);

	const eaters = input.creatures
		.filter((c) => c.action === 'eat' && isFeatureTarget(c.target, 'food'))
		.slice()
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	const drinkers = input.creatures
		.filter((c) => c.action === 'drink' && isFeatureTarget(c.target, 'water'))
		.slice()
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	const eatRequest = input.rates.eatRecoveryPerSecond * input.dt;
	const drinkRequest = input.rates.drinkRecoveryPerSecond * input.dt;

	for (const creature of eaters) {
		const target = creature.target;
		if (!isFeatureTarget(target, 'food')) {
			continue;
		}
		const source = foodById.get(target.featureId);
		if (!source || !(source.amount > 0)) {
			continue;
		}
		const granted = Math.min(eatRequest, source.amount);
		if (!(granted > 0)) {
			continue;
		}
		source.amount = Math.max(0, source.amount - granted);
		const grant = grantsByCreatureId.get(creature.id) ?? emptyGrant();
		grant.food += granted;
		grantsByCreatureId.set(creature.id, grant);
		if (source.amount <= 0 || source.amount < 1e-12) {
			// Remove depleted food — do not retain zero-amount food features.
			foodById.delete(source.id);
		}
	}

	for (const creature of drinkers) {
		const target = creature.target;
		if (!isFeatureTarget(target, 'water')) {
			continue;
		}
		const source = waterById.get(target.featureId);
		if (!source || !(source.amount > 0)) {
			continue;
		}
		const granted = Math.min(drinkRequest, source.amount);
		if (!(granted > 0)) {
			continue;
		}
		source.amount = Math.max(0, source.amount - granted);
		// Clamp tiny residual to zero for clean empty state.
		if (source.amount < 1e-12) {
			source.amount = 0;
		}
		const grant = grantsByCreatureId.get(creature.id) ?? emptyGrant();
		grant.water += granted;
		grantsByCreatureId.set(creature.id, grant);
		// Water basin remains even at amount 0.
		waterById.set(source.id, source);
	}

	// Stable array order: lexicographic id (matches generation order for initial features).
	const food = [...foodById.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const water = [...waterById.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	return {
		habitat: {
			...input.habitat,
			food,
			water
		},
		grantsByCreatureId
	};
}
