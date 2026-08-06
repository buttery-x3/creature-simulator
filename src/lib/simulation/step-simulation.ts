/**
 * Fixed-step simulation advancement and bounded wall-clock catch-up.
 */

import { stepCreature } from './creature-movement';
import type { SimulationConfig, SimulationState } from './types';

/**
 * Advance the simulation by exactly one fixed timestep.
 * Returns a new state object; does not mutate the input.
 */
export function stepSimulation(
	state: SimulationState,
	config: Pick<SimulationConfig, 'fixedDt' | 'maxTurnRate' | 'creatureRadius' | 'arrivalDistance'>
): SimulationState {
	const dt = config.fixedDt;
	const creatures = state.creatures.map((creature) =>
		stepCreature(creature, dt, state.seed, state.habitat.bounds, config)
	);

	return {
		...state,
		timeSeconds: state.timeSeconds + dt,
		creatures
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
	config: Pick<
		SimulationConfig,
		'fixedDt' | 'maxCatchUpSteps' | 'maxTurnRate' | 'creatureRadius' | 'arrivalDistance'
	>
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
