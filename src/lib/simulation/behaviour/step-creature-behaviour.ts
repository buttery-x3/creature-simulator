/**
 * Per-creature fixed-step behaviour: needs → perception → replan gates → action/movement.
 * May request a communication emission on resource discovery; does not transmit or receive.
 */

import type { Habitat } from '$lib/habitat';
import type { EmissionRequest } from '../communication/types';
import {
	clampToInterior,
	distanceSquared,
	normalizeAngle,
	sampleSearchTarget,
	sampleWanderTarget,
	shortestAngleDelta
} from '../creature-movement';
import {
	beginInvestigation,
	removePendingByEmissionId,
	selectBestPendingSignal
} from '../learning/signal-investigation';
import { advanceActiveLearning, interruptInvestigation } from '../learning/step-signal-learning';
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

/** Result of one creature behaviour step, including optional emission handoff. */
export type CreatureBehaviourStepResult = {
	creature: Creature;
	/** Set only on search → resource-target discovery transitions. */
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
	| 'pendingSignalLifetimeSeconds'
	| 'maxPendingSignalsPerCreature'
	| 'investigationCuriosityBaseline'
	| 'investigationDistanceWeight'
	| 'investigationAgeWeight'
	| 'investigationDurationSeconds'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
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
	let pendingSignals = creature.pendingSignals;
	let activeInvestigation = creature.activeInvestigation;
	let symbolAssociations = creature.symbolAssociations;
	let recentLearning = creature.recentLearning;

	// Leaving investigation for another goal interrupts coherent learning state.
	if (activeInvestigation && applied.goal !== 'investigate_signal') {
		const interrupted = interruptInvestigation(
			{
				...creature,
				symbolAssociations,
				pendingSignals,
				activeInvestigation,
				recentLearning
			},
			timeSeconds,
			`interrupted: switched to ${applied.goal} (${decision.selectionReason})`,
			config
		);
		activeInvestigation = interrupted.activeInvestigation;
		symbolAssociations = interrupted.symbolAssociations;
		recentLearning = interrupted.recentLearning;
	}

	if (applied.goal === 'wander') {
		if (target?.kind !== 'point') {
			target = pointTarget(wanderTarget);
		} else {
			wanderTarget = target.position;
		}
	} else if (applied.goal === 'investigate_signal') {
		// Commit or continue investigation toward the recorded emission origin.
		const continuing =
			activeInvestigation !== null &&
			activeInvestigation.expiresAt > timeSeconds &&
			creature.goal === 'investigate_signal';

		if (continuing && activeInvestigation) {
			target = pointTarget(activeInvestigation.origin);
		} else {
			const best = selectBestPendingSignal(
				{
					position: creature.position,
					hunger: creature.hunger,
					thirst: creature.thirst,
					symbolAssociations
				},
				pendingSignals,
				timeSeconds,
				config
			);
			if (best) {
				activeInvestigation = beginInvestigation(
					best.pending,
					timeSeconds,
					config.investigationDurationSeconds
				);
				pendingSignals = removePendingByEmissionId(pendingSignals, best.pending.emissionId);
				target = pointTarget(activeInvestigation.origin);
			} else if (activeInvestigation && activeInvestigation.expiresAt > timeSeconds) {
				target = pointTarget(activeInvestigation.origin);
			}
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
		perception,
		pendingSignals,
		activeInvestigation,
		symbolAssociations,
		recentLearning
	};
}

function tryPerceiveAndPursue(
	creature: Creature,
	timeSeconds: number,
	config: BehaviourStepConfig
): { creature: Creature; discoveryEmission: EmissionRequest | null } | null {
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

	const fromAction = creature.action;
	const recentTransitions = appendTransition(
		creature.recentTransitions,
		{
			timeSeconds,
			fromGoal: creature.goal,
			toGoal: creature.goal,
			fromAction,
			toAction: 'move',
			reason: kind === 'food' ? 'food perceived and selected' : 'water perceived and selected'
		},
		config.decisionHistoryLimit
	);

	const nextCreature: Creature = {
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

	// Emit only on the semantic search → resource-target transition, not every perception.
	const discoveryEmission: EmissionRequest | null =
		fromAction === 'search'
			? {
					senderId: creature.id,
					origin: { x: creature.position.x, y: creature.position.y },
					context: 'resource_discovered',
					contextDetail: kind
				}
			: null;

	return { creature: nextCreature, discoveryEmission };
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
): CreatureBehaviourStepResult {
	// 1. Needs
	const needs = advanceNeeds(creature, dt, config);
	let next: Creature = { ...creature, ...needs };
	let emissionRequest: EmissionRequest | null = null;

	// 2. Perception tick
	next = {
		...next,
		perception: updatePerception(next.perception, next.position, habitat, timeSeconds, config)
	};

	// 2b. Learning: expire pending, reinforce active investigation, complete expired windows
	next = advanceActiveLearning(next, timeSeconds, config);

	// If investigation completed mid-step and we were investigating, force replan next gates.
	// (advanceActiveLearning only clears activeInvestigation; goal may still say investigate.)

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
		next = pursued.creature;
		emissionRequest = pursued.discoveryEmission;
	}

	// 5. Invalid target → immediate replan
	// Consumptive actions only require the feature still exist in habitat (not perception).
	// Investigation without an active investigation record is invalid after completion/expiry.
	const isConsumptiveAction =
		next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	const investigationStale =
		next.goal === 'investigate_signal' && next.activeInvestigation === null;
	const targetOk = isConsumptiveAction
		? isTargetValid(habitat, next.target)
		: isTargetValid(
				habitat,
				next.target,
				next.perception,
				timeSeconds,
				config.trackedObservationDurationSeconds
			);
	if (!targetOk || investigationStale) {
		if (next.action === 'search' && next.target?.kind !== 'point' && !investigationStale) {
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
		return { creature: next, emissionRequest };
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

	return { creature: next, emissionRequest };
}
