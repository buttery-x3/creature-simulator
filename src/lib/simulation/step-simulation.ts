/**
 * Fixed-step simulation advancement and bounded wall-clock catch-up.
 *
 * Step order (authoritative):
 * 1. Resources/weather: rain schedule/refill, food spawn, eat/drink consumption grants
 * 2. Behaviour for all creatures (needs apply grants; perception sees post-consumption world)
 * 3. Memory: resource_observation writes/refreshes from sensing (empty water geography included)
 * 4. Communication: apply emission requests, reception, expire active emissions
 * 5. Memory: resource_announcement from successful announcement emissions
 * 6. Memory: heard_signal from this step's reception (no sender; no interpretation)
 * 7. Learning post-reception: convert newly heard signals into pending investigation candidates
 *    (pendingSignals is transitional until cutover; heard_signal memory is the retained model)
 *
 * Eligibility: a signal heard in step N becomes pending at end of N and is investigable from N+1.
 */

import { stepCreatureBehaviour } from './behaviour/step-creature-behaviour';
import { stepCommunication } from './communication/step-communication';
import type { EmissionRequest } from './communication/types';
import { stepPostReceptionLearning } from './learning/step-signal-learning';
import { applySuccessfulAnnouncementMemories } from './memory/apply-announcement-memory';
import {
	applyHeardSignalMemories,
	applyResourceObservationMemories
} from './memory/apply-sensory-memory';
import { emptyGrant, stepResources } from './resources';
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
	| 'pendingSignalLifetimeSeconds'
	| 'maxPendingSignalsPerCreature'
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
	| 'recentAnnouncementOpportunityDecisionHistoryLimit'
	| 'triggerFeatureCueFadeSeconds'
	| 'maxActiveFoodSources'
	| 'foodSpawnIntervalSeconds'
	| 'rainIntervalMinSeconds'
	| 'rainIntervalMaxSeconds'
	| 'rainDurationSeconds'
	| 'habitat'
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

	// 1. World resources / weather before creature behaviour.
	const resources = stepResources(state, timeSeconds, dt, config);
	const habitat = resources.habitat;
	const environment = resources.environment;

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
			grants
		);
		if (result.emissionRequest) {
			emissionRequests.push(result.emissionRequest);
		}
		return result.creature;
	});

	// Stable request order by sender id (not array iteration accidents).
	emissionRequests.sort((a, b) => (a.senderId < b.senderId ? -1 : a.senderId > b.senderId ? 1 : 0));

	// Resource observations from this step's sensing (available food + water geography).
	const afterObservationMemory = applyResourceObservationMemories(
		creatures,
		habitat,
		timeSeconds,
		config
	);

	const afterBehaviour: SimulationState = {
		...state,
		timeSeconds,
		habitat,
		environment,
		creatures: afterObservationMemory
	};

	const { state: afterCommunication, emittedThisStep } = stepCommunication(
		afterBehaviour,
		emissionRequests,
		timeSeconds,
		config
	);

	// Successful announcement emissions this step → first-class memory (not perception).
	// Use authoritative emittedThisStep — never reconstruct from bounded recentEmissions.
	const afterAnnouncementMemory = applySuccessfulAnnouncementMemories(
		afterCommunication.creatures,
		emittedThisStep,
		timeSeconds
	);

	// Heard-signal retained memory (future model). pendingSignals still written next.
	const afterHeardMemory = applyHeardSignalMemories(afterAnnouncementMemory, timeSeconds);

	// Opportunities from this step's hearing (eligible for investigation from next step).
	return {
		...afterCommunication,
		creatures: stepPostReceptionLearning(afterHeardMemory, timeSeconds, config, state.seed)
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
