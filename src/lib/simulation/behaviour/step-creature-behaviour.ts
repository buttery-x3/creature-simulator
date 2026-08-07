/**
 * Per-creature fixed-step behaviour: needs → perception → arbitration → action/movement.
 * May request a communication emission via the announcement executor; does not transmit.
 *
 * Intention selection is exclusive to cognition (`arbitrate`). This module only
 * requests reconsideration and executes the current intention.
 */

import type { Habitat } from '$lib/habitat';
import { stepAnnouncement, type AnnouncementStepConfig } from '../announcement/step-announcement';
import type { ArbitrationTrigger } from '../cognition/types';
import type { EmissionRequest } from '../communication/types';
import {
	distanceSquared,
	moveToward,
	sampleSearchTarget,
	sampleWanderTarget
} from '../creature-movement';
import { resolveInvestigationAtSite } from '../learning/step-signal-learning';
import type { Creature, SimulationConfig } from '../types';
import { appendTransition, transitionToConsumptive } from './actions';
import { replanFromArbitration, type ReplanConfig } from './apply-arbitration';
import { advanceNeeds, recoveryComplete, type ConsumptionGrants } from './needs';
import { updatePerception } from './perception';
import {
	ensureSearchTarget,
	isAtTarget,
	isTargetValid,
	movementPoint,
	pointTarget
} from './resource-awareness';

/** Result of one creature behaviour step, including optional emission handoff. */
export type CreatureBehaviourStepResult = {
	creature: Creature;
	emissionRequest: EmissionRequest | null;
};

export type BehaviourStepConfig = Pick<
	SimulationConfig,
	| 'maxTurnRate'
	| 'creatureRadius'
	| 'arrivalDistance'
	| 'hungerRisePerSecond'
	| 'thirstRisePerSecond'
	| 'energyDrainPerSecond'
	| 'eatRecoveryPerSecond'
	| 'drinkRecoveryPerSecond'
	| 'sleepRecoveryPerSecond'
	| 'seekFoodThreshold'
	| 'seekWaterThreshold'
	| 'restThreshold'
	| 'wanderBaseline'
	| 'signalBaseline'
	| 'signalRecencyBoostMax'
	| 'announceBaseline'
	| 'continuityBonus'
	| 'reconsiderIntervalSeconds'
	| 'eatUntilHunger'
	| 'drinkUntilThirst'
	| 'sleepUntilEnergy'
	| 'decisionHistoryLimit'
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'investigationDistanceScale'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'symbolInventory'
	| 'lexiconAssignmentMinStrength'
	| 'lexiconAssignmentMinEvidenceCount'
	| 'lexiconHistoryLimit'
	| 'resourceAnnouncementClarityMargin'
	| 'speakingPositionSearchRadius'
	| 'speakingPositionSearchResolution'
	| 'recentAnnouncementOutcomeHistoryLimit'
	| 'recentAnnouncementOpportunityDecisionHistoryLimit'
	| 'triggerFeatureCueFadeSeconds'
	| 'emissionCooldownSeconds'
>;

function replan(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	trigger: ArbitrationTrigger,
	config: BehaviourStepConfig,
	simulationSeed: string
): Creature {
	return replanFromArbitration(
		creature,
		habitat,
		timeSeconds,
		trigger,
		config as ReplanConfig,
		simulationSeed
	);
}

/**
 * Advance one creature through needs, perception, arbitration and actions for a fixed dt.
 * `grants` are world-resource consumption amounts for this step (eat/drink recovery).
 */
export function stepCreatureBehaviour(
	creature: Creature,
	dt: number,
	timeSeconds: number,
	simulationSeed: string,
	habitat: Habitat,
	config: BehaviourStepConfig,
	grants: ConsumptionGrants = { food: 0, water: 0 }
): CreatureBehaviourStepResult {
	const needs = advanceNeeds(creature, dt, config, grants);
	let next: Creature = { ...creature, ...needs };
	let emissionRequest: EmissionRequest | null = null;

	// 1. Perception always runs (no investigation freeze).
	const previousFood = new Set(next.perception.perceivedFoodIds);
	const previousWater = new Set(next.perception.perceivedWaterIds);
	const perceived = updatePerception(next.perception, next.position, habitat, timeSeconds, config);
	next = { ...next, perception: perceived.perception };

	let perceptionChanged = false;
	if (perceived.sensed) {
		const foodNow = next.perception.perceivedFoodIds;
		const waterNow = next.perception.perceivedWaterIds;
		const foodChanged =
			foodNow.length !== previousFood.size || foodNow.some((id) => !previousFood.has(id));
		const waterChanged =
			waterNow.length !== previousWater.size || waterNow.some((id) => !previousWater.has(id));
		perceptionChanged = foodChanged || waterChanged;
	}

	// 2. Announcement executor (only advances when intention is announce_resource).
	const announcementConfig = config as AnnouncementStepConfig;
	const announced = stepAnnouncement({
		creature: next,
		habitat,
		timeSeconds,
		config: announcementConfig
	});
	next = announced.creature;
	if (announced.emissionRequest) {
		emissionRequest = announced.emissionRequest;
	}
	if (announced.endedPreparation) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	}

	// 3. Invalid target → immediate arbitration.
	const investigationStale =
		next.intention === 'investigate_signal' && next.activeInvestigation === null;
	const targetOk = isTargetValid(habitat, next.target);
	if (!targetOk || investigationStale) {
		if (next.action === 'search' && next.target?.kind !== 'point' && !investigationStale) {
			const search = ensureSearchTarget(next, simulationSeed, habitat, config);
			next = {
				...next,
				...search,
				action: 'search'
			};
		} else {
			next = replan(
				next,
				habitat,
				timeSeconds,
				investigationStale ? 'action_complete' : 'current_target_invalid',
				config,
				simulationSeed
			);
		}
	}

	// 4. Recovery complete → replan
	if (
		(next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') &&
		recoveryComplete(next, config)
	) {
		next = replan(next, habitat, timeSeconds, 'need_or_recovery_complete', config, simulationSeed);
	}

	// 5. At investigation site
	if (
		next.intention === 'investigate_signal' &&
		next.action === 'investigate' &&
		next.activeInvestigation
	) {
		next = resolveInvestigationAtSite(next, habitat, timeSeconds, config);
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
		return { creature: next, emissionRequest };
	}

	// 6. Event / periodic reconsideration (never blocked by locks).
	const isConsumptive = next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	if (!isConsumptive) {
		if (next.pendingArbitrationTrigger) {
			const trigger = next.pendingArbitrationTrigger;
			next = replan(next, habitat, timeSeconds, trigger, config, simulationSeed);
		} else if (perceptionChanged) {
			next = replan(
				next,
				habitat,
				timeSeconds,
				'relevant_resource_perception_change',
				config,
				simulationSeed
			);
		} else if (timeSeconds >= next.nextReconsiderAt) {
			next = replan(next, habitat, timeSeconds, 'periodic', config, simulationSeed);
		}
	}

	// 7. Pursue action — no movement while eating/drinking/sleeping/investigating
	if (
		next.action === 'eat' ||
		next.action === 'drink' ||
		next.action === 'sleep' ||
		next.action === 'investigate'
	) {
		return { creature: next, emissionRequest };
	}

	// Wander retarget if at wander point before moving.
	if (next.intention === 'wander' || next.action === 'wander') {
		const arrivalSq = config.arrivalDistance * config.arrivalDistance;
		if (distanceSquared(next.position, next.wanderTarget) <= arrivalSq) {
			const wanderDecisionIndex = next.wanderDecisionIndex + 1;
			const wanderTarget = sampleWanderTarget(
				simulationSeed,
				next.id,
				wanderDecisionIndex,
				habitat.bounds,
				config.creatureRadius
			);
			next = {
				...next,
				wanderDecisionIndex,
				wanderTarget,
				target: pointTarget(wanderTarget)
			};
		}
	}

	// Search retarget if at search point.
	if (next.action === 'search') {
		const arrivalSq = config.arrivalDistance * config.arrivalDistance;
		if (distanceSquared(next.position, next.searchTarget) <= arrivalSq) {
			const searchDecisionIndex = next.searchDecisionIndex + 1;
			const searchTarget = sampleSearchTarget(
				simulationSeed,
				next.id,
				searchDecisionIndex,
				habitat.bounds,
				config.creatureRadius
			);
			next = {
				...next,
				searchDecisionIndex,
				searchTarget,
				target: pointTarget(searchTarget)
			};
		}
	}

	const fallback =
		next.action === 'search'
			? next.searchTarget
			: next.intention === 'wander'
				? next.wanderTarget
				: next.position;
	const destination = movementPoint(habitat, next.target, fallback);
	const moved = moveToward(next, destination, dt, habitat.bounds, config);
	next = { ...next, ...moved };

	// After movement, re-check announcement clarity (emit mid-reposition when clear).
	if (next.intention === 'announce_resource' || next.activeAnnouncementOpportunity !== null) {
		const afterMove = stepAnnouncement({
			creature: next,
			habitat,
			timeSeconds,
			config: announcementConfig
		});
		next = afterMove.creature;
		if (afterMove.emissionRequest && !emissionRequest) {
			emissionRequest = afterMove.emissionRequest;
		}
		if (afterMove.endedPreparation) {
			next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
		}
	}

	// Arrive at feature → consumptive action, or arrive at signal origin → investigate
	if (
		next.action === 'move' &&
		isAtTarget(next.position, habitat, next.target, config.arrivalDistance)
	) {
		const transition = transitionToConsumptive(next, timeSeconds, config);
		if (transition) {
			next = { ...next, ...transition };
			if (
				next.intention === 'investigate_signal' &&
				next.action === 'investigate' &&
				next.activeInvestigation
			) {
				next = resolveInvestigationAtSite(next, habitat, timeSeconds, config);
				next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
				return { creature: next, emissionRequest };
			}
		}
	}

	// Stuck on boundary with exterior wander target
	if (next.intention === 'wander') {
		const arrivalSq = config.arrivalDistance * config.arrivalDistance;
		if (distanceSquared(next.position, next.wanderTarget) <= arrivalSq) {
			const wanderDecisionIndex = next.wanderDecisionIndex + 1;
			const wanderTarget = sampleWanderTarget(
				simulationSeed,
				next.id,
				wanderDecisionIndex,
				habitat.bounds,
				config.creatureRadius
			);
			next = {
				...next,
				wanderDecisionIndex,
				wanderTarget,
				target: pointTarget(wanderTarget)
			};
		}
	}

	if (next.action === 'search') {
		const arrivalSq = config.arrivalDistance * config.arrivalDistance;
		if (distanceSquared(next.position, next.searchTarget) <= arrivalSq) {
			const searchDecisionIndex = next.searchDecisionIndex + 1;
			const searchTarget = sampleSearchTarget(
				simulationSeed,
				next.id,
				searchDecisionIndex,
				habitat.bounds,
				config.creatureRadius
			);
			next = {
				...next,
				searchDecisionIndex,
				searchTarget,
				target: pointTarget(searchTarget)
			};
		}
	}

	return { creature: next, emissionRequest };
}

// Re-export appendTransition for tests that import from step module historically.
export { appendTransition };
