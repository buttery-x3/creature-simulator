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

/** Resource and animal sensing share one local clock; exploration remains separate memory. */
export function senseCreature(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	config: BehaviourStepConfig,
	wildlife: readonly Wildlife[]
) {
	let next = creature;
	// 1. Perception always runs (no investigation freeze).
	const previousFood = new Set(next.perception.perceivedFoodIds);
	const previousWater = new Set(next.perception.perceivedWaterIds);
	const perceived = updatePerception(next.perception, next.position, habitat, timeSeconds, config);
	next = { ...next, perception: perceived.perception };

	let perceptionChanged = false;
	let dangerChanged = false;
	let wildlifeChanged = false;
	if (perceived.sensed) {
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
				observedAt: timeSeconds
			}));
		const isThreat = (w: WildlifeObservation) =>
			w.health > 0 &&
			bodyAbility({ ...w, nextAttackAt: 0 }, w.energy) > bodyAbility(next.body, next.energy) * 0.65;
		wildlifeChanged =
			observed.map((w) => w.id).join() !== next.perceivedWildlife.map((w) => w.id).join();
		dangerChanged = observed.some(isThreat) || next.perceivedWildlife.some(isThreat);
		next = { ...next, perceivedWildlife: observed };
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
