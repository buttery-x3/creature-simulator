/**
 * Per-creature fixed-step behaviour: needs → replan gates → action/movement.
 */

import type { Habitat } from '$lib/habitat';
import {
	clampToInterior,
	distanceSquared,
	normalizeAngle,
	sampleWanderTarget,
	shortestAngleDelta
} from '../creature-movement';
import type { Creature, SimulationConfig } from '../types';
import { applyDecision, transitionToConsumptive } from './actions';
import { commitDecision } from './decisions';
import { advanceNeeds, recoveryComplete } from './needs';
import { isAtTarget, isTargetValid, movementPoint, pointTarget } from './resource-awareness';

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
	| 'goalSwitchMargin'
	| 'minGoalCommitmentSeconds'
	| 'reconsiderIntervalSeconds'
	| 'eatUntilHunger'
	| 'drinkUntilThirst'
	| 'sleepUntilEnergy'
	| 'decisionHistoryLimit'
>;

function moveToward(
	creature: Creature,
	destination: { x: number; y: number },
	dt: number,
	bounds: Habitat['bounds'],
	config: Pick<SimulationConfig, 'maxTurnRate' | 'creatureRadius'>
): Pick<Creature, 'position' | 'facing'> {
	const desiredFacing = Math.atan2(
		destination.y - creature.position.y,
		destination.x - creature.position.x
	);
	const delta = shortestAngleDelta(creature.facing, desiredFacing);
	const maxTurn = config.maxTurnRate * dt;
	const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
	const facing = normalizeAngle(creature.facing + turn);

	const distance = creature.movementSpeed * dt;
	let position = {
		x: creature.position.x + Math.cos(facing) * distance,
		y: creature.position.y + Math.sin(facing) * distance
	};
	position = clampToInterior(position, bounds, config.creatureRadius);
	return { position, facing };
}

function replan(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	trigger: 'reconsider' | 'invalid_target' | 'action_complete' | 'initial',
	config: BehaviourStepConfig
): Creature {
	const decision = commitDecision({
		creature,
		habitat,
		timeSeconds,
		trigger,
		config
	});
	const arrived = isAtTarget(
		creature.position,
		habitat,
		decision.selectedTarget,
		config.arrivalDistance
	);
	const applied = applyDecision(creature, decision, arrived, config);

	let wanderTarget = creature.wanderTarget;
	const wanderDecisionIndex = creature.wanderDecisionIndex;
	let target = applied.target;

	if (applied.goal === 'wander') {
		// Ensure wander target/stream is active.
		if (target?.kind !== 'point') {
			target = pointTarget(wanderTarget);
		} else {
			wanderTarget = target.position;
		}
	}

	return {
		...creature,
		...applied,
		target,
		wanderTarget,
		wanderDecisionIndex
	};
}

/**
 * Advance one creature through needs, decisions and actions for a fixed dt.
 */
export function stepCreatureBehaviour(
	creature: Creature,
	dt: number,
	timeSeconds: number,
	simulationSeed: string,
	habitat: Habitat,
	config: BehaviourStepConfig
): Creature {
	// 1. Needs
	const needs = advanceNeeds(creature, dt, config);
	let next: Creature = { ...creature, ...needs };

	// 2. Invalid target → immediate replan
	if (!isTargetValid(habitat, next.target)) {
		next = replan(next, habitat, timeSeconds, 'invalid_target', config);
	}

	// 3. Recovery complete → replan
	if (
		(next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') &&
		recoveryComplete(next, config)
	) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config);
	}

	// 4. Ordinary reconsideration (not while mid consumptive recovery)
	const isConsumptive = next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	if (!isConsumptive && timeSeconds >= next.nextReconsiderAt) {
		next = replan(next, habitat, timeSeconds, 'reconsider', config);
	}

	// 5. Pursue action
	if (next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') {
		// Stationary while recovering.
		return next;
	}

	// Wander retarget if at wander point before moving.
	if (next.goal === 'wander' || next.action === 'wander') {
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

	const destination = movementPoint(habitat, next.target, next.wanderTarget);
	const moved = moveToward(next, destination, dt, habitat.bounds, config);
	next = { ...next, ...moved };

	// Arrive at feature → consumptive action
	if (
		next.action === 'move' &&
		isAtTarget(next.position, habitat, next.target, config.arrivalDistance)
	) {
		const transition = transitionToConsumptive(next, timeSeconds, config);
		if (transition) {
			next = { ...next, ...transition };
		}
	}

	// Stuck on boundary with exterior wander target: force retarget (wander only).
	if (next.goal === 'wander') {
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

	return next;
}
