/**
 * Per-creature fixed-step behaviour: needs → perception → replan gates → action/movement.
 */

import type { Habitat } from '$lib/habitat';
import {
	clampToInterior,
	distanceSquared,
	normalizeAngle,
	sampleSearchTarget,
	sampleWanderTarget,
	shortestAngleDelta
} from '../creature-movement';
import type { Creature, SimulationConfig } from '../types';
import { appendTransition, applyDecision, transitionToConsumptive } from './actions';
import { commitDecision } from './decisions';
import { advanceNeeds, recoveryComplete } from './needs';
import {
	clearTracked,
	isTrackedUsable,
	selectNearestPerceived,
	startTracking,
	updatePerception
} from './perception';
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
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'trackedObservationDurationSeconds'
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

function ensureSearchTarget(
	creature: Creature,
	simulationSeed: string,
	habitat: Habitat,
	config: Pick<SimulationConfig, 'creatureRadius'>
): Pick<Creature, 'searchTarget' | 'searchDecisionIndex' | 'target'> {
	const targetIsSearchPoint =
		creature.target?.kind === 'point' &&
		creature.target.position.x === creature.searchTarget.x &&
		creature.target.position.y === creature.searchTarget.y;
	if (creature.action === 'search' && targetIsSearchPoint) {
		return {
			searchTarget: creature.searchTarget,
			searchDecisionIndex: creature.searchDecisionIndex,
			target: creature.target
		};
	}
	// Assign a fresh search point when entering search or target is not the search stream.
	const searchDecisionIndex = creature.searchDecisionIndex + 1;
	const searchTarget = sampleSearchTarget(
		simulationSeed,
		creature.id,
		searchDecisionIndex,
		habitat.bounds,
		config.creatureRadius
	);
	return {
		searchTarget,
		searchDecisionIndex,
		target: pointTarget(searchTarget)
	};
}

function replan(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	trigger: 'reconsider' | 'invalid_target' | 'action_complete' | 'initial',
	config: BehaviourStepConfig,
	simulationSeed: string
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
	let searchTarget = creature.searchTarget;
	let searchDecisionIndex = creature.searchDecisionIndex;
	let perception = creature.perception;

	if (applied.goal === 'wander') {
		if (target?.kind !== 'point') {
			target = pointTarget(wanderTarget);
		} else {
			wanderTarget = target.position;
		}
	} else if (applied.action === 'search') {
		const search = ensureSearchTarget(
			{
				...creature,
				...applied,
				target,
				searchTarget,
				searchDecisionIndex
			},
			simulationSeed,
			habitat,
			config
		);
		searchTarget = search.searchTarget;
		searchDecisionIndex = search.searchDecisionIndex;
		target = search.target;
	} else if (
		applied.action === 'move' &&
		target !== null &&
		target.kind === 'feature' &&
		(target.featureKind === 'food' || target.featureKind === 'water')
	) {
		// Begin brief tracking when committing to a perceived/tracked resource.
		const featureId = target.featureId;
		const obs =
			creature.perception.observations.find((o) => o.featureId === featureId) ??
			(creature.perception.tracked?.featureId === featureId ? creature.perception.tracked : null);
		if (obs) {
			perception = startTracking(perception, {
				...obs,
				observedAt: timeSeconds
			});
		}
	}

	return {
		...creature,
		...applied,
		target,
		wanderTarget,
		wanderDecisionIndex,
		searchTarget,
		searchDecisionIndex,
		perception
	};
}

function tryPerceiveAndPursue(
	creature: Creature,
	timeSeconds: number,
	config: BehaviourStepConfig
): Creature | null {
	if (creature.goal !== 'seek_food' && creature.goal !== 'seek_water') {
		return null;
	}
	if (creature.action !== 'search' && creature.action !== 'move') {
		return null;
	}
	// Already on a valid feature target — nothing to do here.
	if (
		creature.action === 'move' &&
		creature.target?.kind === 'feature' &&
		((creature.goal === 'seek_food' && creature.target.featureKind === 'food') ||
			(creature.goal === 'seek_water' && creature.target.featureKind === 'water'))
	) {
		return null;
	}

	const kind = creature.goal === 'seek_food' ? 'food' : 'water';
	const nearest = selectNearestPerceived(creature.position, creature.perception, kind);
	if (!nearest) {
		return null;
	}

	const featureTarget = {
		kind: 'feature' as const,
		featureId: nearest.featureId,
		featureKind: nearest.featureKind
	};

	const recentTransitions = appendTransition(
		creature.recentTransitions,
		{
			timeSeconds,
			fromGoal: creature.goal,
			toGoal: creature.goal,
			fromAction: creature.action,
			toAction: 'move',
			reason: kind === 'food' ? 'food perceived and selected' : 'water perceived and selected'
		},
		config.decisionHistoryLimit
	);

	return {
		...creature,
		action: 'move',
		target: featureTarget,
		actionStartedAt: timeSeconds,
		perception: startTracking(creature.perception, {
			...nearest,
			observedAt: timeSeconds
		}),
		recentTransitions
	};
}

/**
 * Advance one creature through needs, perception, decisions and actions for a fixed dt.
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

	// 2. Perception tick
	next = {
		...next,
		perception: updatePerception(next.perception, next.position, habitat, timeSeconds, config)
	};

	// 3. Tracked observation expiry while pursuing a known food/water feature
	if (
		next.target?.kind === 'feature' &&
		(next.target.featureKind === 'food' || next.target.featureKind === 'water') &&
		(next.action === 'move' || next.action === 'search') &&
		// Missing features are handled by invalid-target replan, not track expiry.
		isTargetValid(habitat, next.target)
	) {
		const kind = next.target.featureKind;
		const stillPerceived = (
			kind === 'food' ? next.perception.perceivedFoodIds : next.perception.perceivedWaterIds
		).includes(next.target.featureId);
		const trackOk = isTrackedUsable(
			next.perception.tracked,
			timeSeconds,
			config.trackedObservationDurationSeconds
		);
		const trackMatches =
			next.perception.tracked?.featureId === next.target.featureId &&
			next.perception.tracked?.featureKind === kind;
		if (!stillPerceived && !(trackOk && trackMatches)) {
			const recentTransitions = appendTransition(
				next.recentTransitions,
				{
					timeSeconds,
					fromGoal: next.goal,
					toGoal: next.goal,
					fromAction: next.action,
					toAction: 'search',
					reason:
						kind === 'food'
							? 'tracked food observation expired'
							: 'tracked water observation expired'
				},
				config.decisionHistoryLimit
			);
			const search = ensureSearchTarget(
				{
					...next,
					action: 'search',
					target: null
				},
				simulationSeed,
				habitat,
				config
			);
			next = {
				...next,
				action: 'search',
				target: search.target,
				searchTarget: search.searchTarget,
				searchDecisionIndex: search.searchDecisionIndex,
				actionStartedAt: timeSeconds,
				perception: clearTracked(next.perception),
				recentTransitions
			};
		}
	}

	// 4. Search → move when resource perceived
	const pursued = tryPerceiveAndPursue(next, timeSeconds, config);
	if (pursued) {
		next = pursued;
	}

	// 5. Invalid target → immediate replan
	// Consumptive actions only require the feature still exist in habitat (not perception).
	const isConsumptiveAction =
		next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	const targetOk = isConsumptiveAction
		? isTargetValid(habitat, next.target)
		: isTargetValid(
				habitat,
				next.target,
				next.perception,
				timeSeconds,
				config.trackedObservationDurationSeconds
			);
	if (!targetOk) {
		if (next.action === 'search' && next.target?.kind !== 'point') {
			const search = ensureSearchTarget(next, simulationSeed, habitat, config);
			next = {
				...next,
				...search,
				action: 'search'
			};
		} else if (!isConsumptiveAction) {
			next = replan(next, habitat, timeSeconds, 'invalid_target', config, simulationSeed);
		}
	}

	// 6. Recovery complete → replan
	if (
		(next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') &&
		recoveryComplete(next, config)
	) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	}

	// 7. Ordinary reconsideration (not while mid consumptive recovery)
	const isConsumptive = next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	if (!isConsumptive && timeSeconds >= next.nextReconsiderAt) {
		next = replan(next, habitat, timeSeconds, 'reconsider', config, simulationSeed);
	}

	// 8. Pursue action
	if (next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') {
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
			: next.goal === 'wander'
				? next.wanderTarget
				: next.position;
	const destination = movementPoint(habitat, next.target, fallback);
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

	// Stuck on boundary with search target
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

	return next;
}
