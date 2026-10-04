import type { Habitat } from '$lib/habitat';
import { createNewborn, type CreatureCreationConfig } from '../creation/creatures';
import type { Creature } from '../types';
import { advanceLife } from './physiology';
import { resolveReproduction } from './reproduction';
import type { LifecycleConfig, LifeEvent } from './types';

/** Apply physiology once and remove deaths before physical encounters. */
export function advancePopulationLife(
	creatures: readonly Creature[],
	dt: number,
	time: number,
	config: LifecycleConfig
): { creatures: Creature[]; events: LifeEvent[] } {
	const living: Creature[] = [],
		events: LifeEvent[] = [];
	for (const creature of creatures) {
		const advanced = advanceLife(creature, dt, time, config);
		if (advanced.deathCause)
			events.push({ kind: 'death', time, creatureId: creature.id, cause: advanced.deathCause });
		else living.push(advanced.creature);
	}
	return { creatures: living, events };
}

/** Resolve lethal encounters before reciprocal reproduction; assembly owns fresh minds. */
export function finalizePopulation(
	creatures: readonly Creature[],
	time: number,
	nextCreatureId: number,
	habitat: Habitat,
	seed: string,
	config: CreatureCreationConfig
) {
	const survivors = advancePopulationLife(creatures, 0, time, config.lifecycle);
	const reproduced = resolveReproduction(
		survivors.creatures,
		time,
		config.lifecycle,
		nextCreatureId
	);
	return {
		creatures: [
			...reproduced.creatures,
			...reproduced.births.map((birth) => createNewborn(config, habitat, seed, birth, time))
		],
		nextCreatureId: reproduced.nextCreatureId,
		events: [...survivors.events, ...reproduced.events]
	};
}
