import type { Habitat } from '$lib/habitat';
import { distanceSquared } from '../../creature-movement';
import { bodyAbility } from '../../ecology/body';
import type { Wildlife } from '../../ecology/types';
import {
	selectExplorationTarget,
	updateExplorationFromSensing,
	type ExplorationScoreConfig
} from '../../exploration';
import type { Creature, WildlifeObservation } from '../../types';
import type { BehaviourStepConfig } from '../step-creature-behaviour';
import { updatePerception } from '../perception';
import { pointTarget } from '../resource-awareness';
import {
	DANGER_MEMORY_LIFETIME_SECONDS,
	forgetEntries,
	rememberDangerObservation
} from '../../memory';

/** Resource and animal sensing share one local clock; exploration remains separate memory. */
export function senseCreature(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	config: BehaviourStepConfig,
	wildlife: readonly Wildlife[]
) {
	let next = {
		...creature,
		memory: forgetEntries(
			creature.memory,
			(entry) =>
				entry.kind === 'danger_observation' &&
				timeSeconds - entry.rememberedAt >= DANGER_MEMORY_LIFETIME_SECONDS
		)
	};
	// 1. Perception always runs (no investigation freeze).
	const previousFood = new Set(next.perception.perceivedFoodIds);
	const previousWater = new Set(next.perception.perceivedWaterIds);
	const perceived = updatePerception(next.perception, next.position, habitat, timeSeconds, config);
	next = { ...next, perception: perceived.perception };

	let perceptionChanged = false;
	let dangerChanged = false;
	let wildlifeChanged = false;
	if (perceived.sensed) {
		const previousWildlife = new Map(next.perceivedWildlife.map((animal) => [animal.id, animal]));
		const observed = wildlife
			.filter(
				(w) =>
					distanceSquared(next.position, w.position) <= config.sensingRadius ** 2 &&
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
				firstObservedAt: observationEpisodeStart(
					next,
					previousWildlife.get(w.id),
					w.id,
					timeSeconds
				)
			}));
		const isThreat = (w: WildlifeObservation) =>
			w.health > 0 &&
			bodyAbility({ ...w, nextAttackAt: 0 }, w.energy) > bodyAbility(next.body, next.energy) * 0.65;
		wildlifeChanged =
			observed.map((w) => w.id).join() !== next.perceivedWildlife.map((w) => w.id).join();
		dangerChanged = observed.some(isThreat) || next.perceivedWildlife.some(isThreat);
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
		const foodNow = next.perception.perceivedFoodIds;
		const waterNow = next.perception.perceivedWaterIds;
		const foodChanged =
			foodNow.length !== previousFood.size || foodNow.some((id) => !previousFood.has(id));
		const waterChanged =
			waterNow.length !== previousWater.size || waterNow.some((id) => !previousWater.has(id));
		perceptionChanged = foodChanged || waterChanged;

		// Exploration knowledge updates on every real sensing pass (any intention).
		const previousActive = next.exploration.activeCellIndex;
		const previousActiveTime =
			previousActive !== null ? next.exploration.map.lastFullySensedAt[previousActive] : null;
		const map = updateExplorationFromSensing(
			next.exploration.map,
			habitat.bounds,
			next.position,
			config.sensingRadius,
			timeSeconds
		);
		let exploration = { ...next.exploration, map };

		// Completing the active exploration cell immediately retargets (no need to reach centre).
		if (
			next.intention === 'explore' &&
			previousActive !== null &&
			map.lastFullySensedAt[previousActive] !== previousActiveTime &&
			map.lastFullySensedAt[previousActive] === timeSeconds
		) {
			const scoreConfig: ExplorationScoreConfig = {
				explorationDistanceWeight: config.explorationDistanceWeight,
				explorationStalenessWeight: config.explorationStalenessWeight,
				explorationStalenessScaleSeconds: config.explorationStalenessScaleSeconds
			};
			const selection = selectExplorationTarget(
				map,
				habitat.bounds,
				next.position,
				timeSeconds,
				scoreConfig
			);
			exploration = { map, activeCellIndex: selection.cellIndex };
			next = {
				...next,
				exploration,
				target: pointTarget(selection.centre)
			};
		} else {
			next = { ...next, exploration };
		}
	}

	return { creature: next, perceptionChanged, dangerChanged, wildlifeChanged };
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
