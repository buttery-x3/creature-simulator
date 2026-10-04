import { distanceSquared } from '../../creature-movement';
import { bodyAbility } from '../../ecology/body';
import type { Wildlife } from '../../ecology/types';
import {
	DANGER_MEMORY_LIFETIME_SECONDS,
	forgetEntries,
	rememberDangerObservation
} from '../../memory';
import type { Creature, WildlifeObservation } from '../../types';

/** Local animal evidence, continuous encounter identity and bounded danger-memory writes. */
export function senseWildlife(
	creature: Creature,
	wildlife: readonly Wildlife[],
	timeSeconds: number,
	sensingRadius: number
) {
	let next = creature;
	const previousWildlife = new Map(next.perceivedWildlife.map((animal) => [animal.id, animal]));
	const observed = wildlife
		.filter(
			(w) =>
				distanceSquared(next.position, w.position) <= sensingRadius ** 2 &&
				(w.health > 0 || w.foodAmount > 0)
		)
		.map((w) => ({
			id: w.id,
			position: { ...w.position },
			size: w.size,
			physicality: w.physicality,
			health: w.health,
			energy: w.energy,
			foodAmount: w.foodAmount,
			observedAt: timeSeconds,
			firstObservedAt: observationEpisodeStart(next, previousWildlife.get(w.id), w.id, timeSeconds)
		}));
	const isThreat = (w: WildlifeObservation) =>
		w.health > 0 &&
		bodyAbility({ ...w, nextAttackAt: 0 }, w.energy) > bodyAbility(next.body, next.energy) * 0.65;
	const wildlifeChanged =
		observed.map((w) => w.id).join() !== next.perceivedWildlife.map((w) => w.id).join();
	const dangerChanged = observed.some(isThreat) || next.perceivedWildlife.some(isThreat);
	let memory = next.memory;
	for (const animal of observed) {
		if (isThreat(animal)) {
			memory = rememberDangerObservation(memory, {
				wildlifeId: animal.id,
				position: animal.position,
				size: animal.size,
				physicality: animal.physicality,
				health: animal.health,
				energy: animal.energy,
				rememberedAt: timeSeconds,
				firstObservedAt: animal.firstObservedAt
			});
		} else {
			// New local evidence can disconfirm danger, including a visible carcass.
			memory = forgetEntries(
				memory,
				(entry) => entry.kind === 'danger_observation' && entry.wildlifeId === animal.id
			);
		}
	}
	next = { ...next, perceivedWildlife: observed, memory };
	return { creature: next, wildlifeChanged, dangerChanged };
}

/** Continuous local sight survives shared-memory eviction; unseen episodes still expire. */
function observationEpisodeStart(
	creature: Creature,
	previous: WildlifeObservation | undefined,
	wildlifeId: string,
	timeSeconds: number
): number {
	if (previous && timeSeconds - previous.observedAt < DANGER_MEMORY_LIFETIME_SECONDS) {
		return previous.firstObservedAt;
	}
	const retained = creature.memory.entries.find(
		(entry) =>
			entry.kind === 'danger_observation' &&
			entry.wildlifeId === wildlifeId &&
			timeSeconds - entry.rememberedAt < DANGER_MEMORY_LIFETIME_SECONDS
	);
	return retained?.kind === 'danger_observation' ? retained.firstObservedAt : timeSeconds;
}
