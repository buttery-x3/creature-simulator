/**
 * Fixed-step simulation advancement and bounded wall-clock catch-up.
 *
 * Step order (authoritative):
 * 1. Behaviour for all creatures (needs, perception, learning evidence, decisions, movement)
 * 2. Communication: apply emission requests, reception, expire active emissions
 * 3. Learning post-reception: convert newly heard signals into pending investigation candidates
 *
 * Eligibility: a signal heard in step N becomes pending at end of N and is investigable from N+1.
 */

import { stepCreatureBehaviour } from './behaviour/step-creature-behaviour';
import { stepCommunication } from './communication/step-communication';
import type { EmissionRequest } from './communication/types';
import { stepPostReceptionLearning } from './learning/step-signal-learning';
import type { SimulationConfig, SimulationState } from './types';

export type StepSimulationConfig = Pick<
	SimulationConfig,
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
	| 'goalSwitchMargin'
	| 'minGoalCommitmentSeconds'
	| 'reconsiderIntervalSeconds'
	| 'eatUntilHunger'
	| 'drinkUntilThirst'
	| 'sleepUntilEnergy'
	| 'decisionHistoryLimit'
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'trackedObservationDurationSeconds'
	| 'hearingRadius'
	| 'signalLifetimeSeconds'
	| 'emissionCooldownSeconds'
	| 'recentEmittedHistoryLimit'
	| 'recentHeardHistoryLimit'
	| 'recentSimulationEmissionHistoryLimit'
	| 'symbolInventory'
	| 'emissionExplorationFloor'
	| 'emissionAssociationWeightMultiplier'
	| 'pendingSignalLifetimeSeconds'
	| 'maxPendingSignalsPerCreature'
	| 'investigationCuriosityWeight'
	| 'investigationDistanceScale'
	| 'investigationAgeWeight'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
>;

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

	const emissionRequests: EmissionRequest[] = [];
	const creatures = state.creatures.map((creature) => {
		const result = stepCreatureBehaviour(
			creature,
			dt,
			timeSeconds,
			state.seed,
			state.habitat,
			config
		);
		if (result.emissionRequest) {
			emissionRequests.push(result.emissionRequest);
		}
		return result.creature;
	});

	// Stable request order by sender id (not array iteration accidents).
	emissionRequests.sort((a, b) => (a.senderId < b.senderId ? -1 : a.senderId > b.senderId ? 1 : 0));

	const afterBehaviour: SimulationState = {
		...state,
		timeSeconds,
		creatures
	};

	const afterCommunication = stepCommunication(
		afterBehaviour,
		emissionRequests,
		timeSeconds,
		config
	);

	// Pending candidates from this step's hearing (eligible for investigation from next step).
	return {
		...afterCommunication,
		creatures: stepPostReceptionLearning(afterCommunication.creatures, timeSeconds, config)
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
