/**
 * Build pure ArbitrationInput snapshots from creature + habitat state.
 */

import type { Habitat } from '$lib/habitat';
import type { ArbitrationInput, ArbitrationTrigger, CognitionConfig } from '../cognition/types';
import { isResourceAvailable } from '../resources/availability';
import type { Creature, SimulationConfig } from '../types';
import { resolveFeature } from './resource-awareness';

export type ArbitrationConfig = Pick<
	SimulationConfig,
	| 'seekFoodThreshold'
	| 'seekWaterThreshold'
	| 'restThreshold'
	| 'wanderBaseline'
	| 'signalBaseline'
	| 'signalRecencyBoostMax'
	| 'announceBaseline'
	| 'continuityBonus'
	| 'targetQualityVisible'
	| 'targetQualityRemembered'
	| 'targetQualitySearch'
>;

export function cognitionConfigFromSimulation(config: ArbitrationConfig): CognitionConfig {
	return {
		seekFoodThreshold: config.seekFoodThreshold,
		seekWaterThreshold: config.seekWaterThreshold,
		restThreshold: config.restThreshold,
		wanderBaseline: config.wanderBaseline,
		signalBaseline: config.signalBaseline,
		signalRecencyBoostMax: config.signalRecencyBoostMax,
		announceBaseline: config.announceBaseline,
		continuityBonus: config.continuityBonus,
		targetQualityVisible: config.targetQualityVisible,
		targetQualityRemembered: config.targetQualityRemembered,
		targetQualitySearch: config.targetQualitySearch
	};
}

/**
 * Available food/water currently in the perception snapshot (habitat amount > 0).
 */
export function listAvailablePerceivedResources(
	creature: Pick<Creature, 'perception'>,
	habitat: Habitat
): {
	availableFood: ArbitrationInput['availableFood'];
	availableWater: ArbitrationInput['availableWater'];
} {
	const availableFood: ArbitrationInput['availableFood'][number][] = [];
	const availableWater: ArbitrationInput['availableWater'][number][] = [];

	for (const obs of creature.perception.observations) {
		const feature = resolveFeature(habitat, {
			kind: 'feature',
			featureId: obs.featureId,
			featureKind: obs.featureKind
		});
		if (!feature || !isResourceAvailable(feature)) {
			continue;
		}
		const entry = {
			featureId: obs.featureId,
			resourceKind: obs.featureKind,
			position: { x: obs.position.x, y: obs.position.y }
		};
		if (obs.featureKind === 'food') {
			availableFood.push(entry);
		} else {
			availableWater.push(entry);
		}
	}

	return { availableFood, availableWater };
}

export function buildArbitrationInput(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	trigger: ArbitrationTrigger,
	config: ArbitrationConfig
): ArbitrationInput {
	const { availableFood, availableWater } = listAvailablePerceivedResources(creature, habitat);
	return {
		timeSeconds,
		trigger,
		position: creature.position,
		hunger: creature.hunger,
		thirst: creature.thirst,
		energy: creature.energy,
		verbosity: creature.verbosity,
		curiosity: creature.curiosity,
		availableFood,
		availableWater,
		memory: creature.memory,
		currentIntention: creature.intention,
		currentTarget: creature.target,
		homeFeatureId: habitat.home.id,
		config: cognitionConfigFromSimulation(config)
	};
}
