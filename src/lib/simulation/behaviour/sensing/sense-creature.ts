import { observePeers, updateRelationships, SOCIAL_DEFAULTS } from '../../social';
import type { Habitat } from '$lib/habitat';
import type { Wildlife } from '../../ecology/types';
import {
	selectExplorationTarget,
	updateExplorationFromSensing,
	type ExplorationScoreConfig
} from '../../exploration';
import type { Creature } from '../../types';
import type { BehaviourStepConfig } from '../step-creature-behaviour';
import { updatePerception } from '../perception';
import { senseWildlife } from './wildlife-perception';
import { pointTarget } from '../resource-awareness';
import { DANGER_MEMORY_LIFETIME_SECONDS, forgetEntries } from '../../memory';

/** Resource and animal sensing share one local clock; exploration remains separate memory. */
export function senseCreature(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	config: BehaviourStepConfig,
	wildlife: readonly Wildlife[],
	population: readonly Creature[] = []
) {
	let next = {
		...creature,
		perceivedPeers: creature.perceivedPeers.filter(
			(peer) => timeSeconds - peer.observedAt <= SOCIAL_DEFAULTS.peerFreshnessSeconds
		),
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
	let peerChanged = next.perceivedPeers.length !== creature.perceivedPeers.length;
	if (perceived.sensed) {
		const peers = observePeers(
			next,
			population,
			timeSeconds,
			config.sensingRadius,
			config.lifecycle
		);
		peerChanged =
			peers
				.map((peer) => peer.id + ':' + (peer.expression?.id ?? ''))
				.sort()
				.join('|') !==
			creature.perceivedPeers
				.map((peer) => peer.id + ':' + (peer.expression?.id ?? ''))
				.sort()
				.join('|');
		const elapsed =
			creature.perception.lastUpdatedAt < 0
				? 0
				: Math.min(
						config.perceptionIntervalSeconds,
						timeSeconds - creature.perception.lastUpdatedAt
					);
		next = {
			...next,
			perceivedPeers: peers,
			social: updateRelationships(
				next.social,
				peers,
				timeSeconds,
				elapsed,
				next.hunger < 0.6 && next.thirst < 0.6 && next.energy > 0.4 && next.body.health > 0.6
			)
		};
		const animals = senseWildlife(next, wildlife, timeSeconds, config.sensingRadius);
		next = animals.creature;
		wildlifeChanged = animals.wildlifeChanged;
		dangerChanged = animals.dangerChanged;
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

	return { creature: next, perceptionChanged, dangerChanged, wildlifeChanged, peerChanged };
}
