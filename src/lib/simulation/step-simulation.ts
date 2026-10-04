/**
 * Fixed-step simulation advancement and bounded wall-clock catch-up.
 *
 * Step order (authoritative):
 * 1. Resources/weather: rain schedule/refill, food spawn, eat/drink consumption grants
 * 2. Behaviour for all creatures (needs apply grants; perception sees post-consumption world;
 *    unified cognition arbitration selects intention; actions execute)
 * 3. Lifecycle physiology/death, physical encounters, then reciprocal reproduction/newborns
 * 4. Memory: resource_observation writes/refreshes from sensing
 * 5. Communication: apply emission requests, reception, expire active emissions
 * 6. Memory: resource_announcement from successful announcement emissions
 * 7. Memory: heard_signal from this step's reception (no sender; no interpretation)
 * 8. Request reconsideration for listeners that gained heard_signal this step
 *
 * Eligibility: a signal heard in step N is remembered at end of N and is investigable from N+1
 * via ordinary arbitration (no pending opportunity / curiosity gate).
 */

import { advancePopulationLife, finalizePopulation } from './lifecycle/population';
import { releaseInterruptedMovementResponse } from './behaviour/execution/movement-expression';
import { recordInjury } from './social';
import { stepWildlife, resolveEncounters } from './ecology';
import { stepCreatureBehaviour } from './behaviour/step-creature-behaviour';
import { stepCommunication } from './communication/step-communication';
import type { EmissionRequest } from './communication/types';
import { applySuccessfulAnnouncementMemories } from './memory/apply-announcement-memory';
import {
	applyHeardSignalMemories,
	applyResourceObservationMemories
} from './memory/apply-sensory-memory';
import { hearMovementLearning } from './learning/movement';
import { learnFromLocalDangerReception } from './learning';
import { emptyGrant, stepResources } from './resources';
import type { Creature, SimulationConfig, SimulationState } from './types';

export type StepSimulationConfig = Pick<
	SimulationConfig,
	| 'ecology'
	| 'lifecycle'
	| 'movementSpeed'
	| 'memoryCapacityRange'
	| 'explorationCellSize'
	| 'initialHunger'
	| 'initialThirst'
	| 'initialEnergy'
	| 'fixedDt'
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
	| 'exploreBaseline'
	| 'explorationDistanceWeight'
	| 'explorationStalenessWeight'
	| 'explorationStalenessScaleSeconds'
	| 'signalBaseline'
	| 'signalRecencyBoostMax'
	| 'announceBaseline'
	| 'continuityBonus'
	| 'targetQualityVisible'
	| 'targetQualityRemembered'
	| 'targetQualitySearch'
	| 'reconsiderIntervalSeconds'
	| 'eatUntilHunger'
	| 'drinkUntilThirst'
	| 'sleepUntilEnergy'
	| 'decisionHistoryLimit'
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'hearingRadius'
	| 'signalLifetimeSeconds'
	| 'emissionCooldownSeconds'
	| 'recentEmittedHistoryLimit'
	| 'recentHeardHistoryLimit'
	| 'recentSimulationEmissionHistoryLimit'
	| 'symbolInventory'
	| 'investigationDistanceScale'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'lexiconAssignmentMinStrength'
	| 'lexiconAssignmentMinEvidenceCount'
	| 'lexiconHistoryLimit'
	| 'resourceAnnouncementClarityMargin'
	| 'speakingPositionSearchRadius'
	| 'speakingPositionSearchResolution'
	| 'recentAnnouncementOutcomeHistoryLimit'
	| 'maxActiveFoodSources'
	| 'foodSpawnIntervalSeconds'
	| 'rainIntervalMinSeconds'
	| 'rainIntervalMaxSeconds'
	| 'rainDurationSeconds'
	| 'habitat'
>;

/**
 * After heard_signal memory writes, request next-step arbitration for affected listeners.
 * Does not select investigate — cognition decides on the next behaviour step.
 */
function requestArbitrationForNewHeardSignals(
	before: readonly Creature[],
	after: readonly Creature[]
): Creature[] {
	const oldIds = new Map(
		before.map((c) => [
			c.id,
			new Set(c.memory.entries.filter((e) => e.kind === 'heard_signal').map((e) => e.emissionId))
		])
	);
	return after.map((creature) => {
		const previous = oldIds.get(creature.id);
		const gained = creature.memory.entries.some(
			(e) => e.kind === 'heard_signal' && !previous?.has(e.emissionId)
		);
		return gained
			? {
					...creature,
					pendingArbitrationTrigger: 'new_heard_signal_memory' as const,
					nextReconsiderAt: 0
				}
			: creature;
	});
}

/**
 * Advance the simulation by exactly one fixed timestep.
 * Returns a new state object; does not mutate the input.
 */
export function stepSimulation(
	state: SimulationState,
	config: StepSimulationConfig
): SimulationState {
	const dt = config.fixedDt;
	// Behaviour sees the time *after* this step so need-driven clocks align with state.timeSeconds.
	const timeSeconds = state.timeSeconds + dt;

	// 1. World resources / weather before creature behaviour.
	const resources = stepResources(state, timeSeconds, dt, config);
	const habitat = resources.habitat;
	const environment = resources.environment;

	const wildlife = stepWildlife(
		state.wildlife,
		state.creatures,
		habitat,
		timeSeconds,
		dt,
		config.ecology
	);
	const emissionRequests: EmissionRequest[] = [];
	const creatures = state.creatures.map((creature) => {
		const grants = resources.grantsByCreatureId.get(creature.id) ?? emptyGrant();
		const result = stepCreatureBehaviour(
			creature,
			dt,
			timeSeconds,
			state.seed,
			habitat,
			config,
			grants,
			wildlife,
			state.creatures
		);
		if (result.emissionRequest) {
			emissionRequests.push(result.emissionRequest);
		}
		return releaseInterruptedMovementResponse(creature, result.creature, timeSeconds);
	});

	const aged = advancePopulationLife(creatures, dt, timeSeconds, config.lifecycle);
	const encountered = resolveEncounters(wildlife, aged.creatures, timeSeconds, dt, config);
	const beforeInjury = new Map(creatures.map((creature) => [creature.id, creature.body.health]));
	const afterPain = encountered.creatures.map((creature) => ({
		...creature,
		social: recordInjury(
			creature.social,
			Math.max(0, (beforeInjury.get(creature.id) ?? creature.body.health) - creature.body.health)
		)
	}));

	const population = finalizePopulation(
		afterPain,
		timeSeconds,
		state.nextCreatureId,
		habitat,
		state.seed,
		config
	);

	// Stable request order by sender id (not array iteration accidents).
	emissionRequests.sort((a, b) => (a.senderId < b.senderId ? -1 : a.senderId > b.senderId ? 1 : 0));

	// Resource observations from this step's sensing (available food + water geography).
	const afterObservationMemory = applyResourceObservationMemories(
		population.creatures,
		habitat,
		timeSeconds,
		config
	);

	const afterBehaviour: SimulationState = {
		...state,
		timeSeconds,
		habitat,
		environment,
		wildlife: encountered.wildlife,
		recentEncounters: [...state.recentEncounters, ...encountered.encounters].slice(
			-config.ecology.encounterHistoryLimit
		),
		nextCreatureId: population.nextCreatureId,
		recentLifeEvents: [...state.recentLifeEvents, ...aged.events, ...population.events].slice(
			-config.lifecycle.eventHistoryLimit
		),
		creatures: afterObservationMemory
	};

	const {
		state: afterCommunication,
		emittedThisStep,
		receivedThisStep
	} = stepCommunication(afterBehaviour, emissionRequests, timeSeconds, config);

	// Successful announcement emissions this step → first-class memory (not perception).
	const afterAnnouncementMemory = applySuccessfulAnnouncementMemories(
		afterCommunication.creatures,
		emittedThisStep,
		timeSeconds
	);

	// Heard-signal retained memory.
	const afterHeardMemory = learnFromLocalDangerReception(
		applyHeardSignalMemories(afterAnnouncementMemory, timeSeconds, receivedThisStep),
		timeSeconds,
		config,
		receivedThisStep
	);

	// Request reconsideration for listeners that gained heard_signal this step.
	const afterMovementLearning = afterHeardMemory.map((creature) =>
		hearMovementLearning(creature, receivedThisStep.get(creature.id) ?? [], timeSeconds, config)
	);
	const withReconsider = requestArbitrationForNewHeardSignals(
		afterAnnouncementMemory,
		afterMovementLearning
	);

	return {
		...afterCommunication,
		creatures: withReconsider
	};
}

export type CatchUpResult = {
	state: SimulationState;
	/** Residual time not yet consumed by a full fixed step. */
	accumulator: number;
	/** Number of fixed steps applied this catch-up. */
	stepsTaken: number;
};

/**
 * Convert wall-clock elapsed time into a bounded number of fixed steps.
 * Rendering frame rate must not change movement outcomes for a given sequence
 * of fixed steps; this only limits how many steps run per frame.
 */
export function advanceSimulation(
	state: SimulationState,
	elapsedSeconds: number,
	accumulator: number,
	config: StepSimulationConfig & Pick<SimulationConfig, 'maxCatchUpSteps'>
): CatchUpResult {
	if (!(elapsedSeconds >= 0) || !Number.isFinite(elapsedSeconds)) {
		return { state, accumulator, stepsTaken: 0 };
	}

	let nextState = state;
	let acc = accumulator + elapsedSeconds;
	let stepsTaken = 0;

	while (acc >= config.fixedDt && stepsTaken < config.maxCatchUpSteps) {
		nextState = stepSimulation(nextState, config);
		acc -= config.fixedDt;
		stepsTaken += 1;
	}

	// Drop excess time beyond the catch-up budget so a long stall does not
	// schedule an unbounded backlog on subsequent frames.
	if (stepsTaken >= config.maxCatchUpSteps && acc >= config.fixedDt) {
		acc = acc % config.fixedDt;
	}

	return { state: nextState, accumulator: acc, stepsTaken };
}
