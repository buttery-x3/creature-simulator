/**
 * Per-creature fixed-step behaviour: needs → perception → replan gates → action/movement.
 * May request a communication emission via the announcement subdomain; does not transmit.
 */

import type { Habitat } from '$lib/habitat';
import {
	isAnnouncementLocked,
	stepAnnouncement,
	type AnnouncementStepConfig
} from '../announcement/step-announcement';
import type { EmissionRequest } from '../communication/types';
import {
	distanceSquared,
	moveToward,
	sampleSearchTarget,
	sampleWanderTarget
} from '../creature-movement';
import {
	beginInvestigation,
	removePendingByEmissionId,
	selectBestAcceptedOpportunity
} from '../learning/signal-investigation';
import { INVESTIGATION_ELIGIBLE_SCORE } from './decisions';
import {
	advanceActiveLearning,
	interruptInvestigation,
	resolveInvestigationAtSite
} from '../learning/step-signal-learning';
import type { Creature, SimulationConfig } from '../types';
import { appendTransition, applyDecision, transitionToConsumptive } from './actions';
import { commitDecision } from './decisions';
import { advanceNeeds, recoveryComplete, type ConsumptionGrants } from './needs';
import { clearTracked, isTrackedUsable, startTracking, updatePerception } from './perception';
import {
	ensureSearchTarget,
	isAtTarget,
	isTargetValid,
	movementPoint,
	pointTarget,
	tryPerceiveAndPursue
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

/** True while committed to travel/inspect a signal origin — ordinary replan must not interrupt. */
function isInvestigationLocked(creature: Creature): boolean {
	return (
		creature.goal === 'investigate_signal' &&
		creature.activeInvestigation !== null &&
		(creature.action === 'move' || creature.action === 'investigate')
	);
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
		const continuing = activeInvestigation !== null && creature.goal === 'investigate_signal';

		if (continuing && activeInvestigation) {
			target = pointTarget(activeInvestigation.origin);
		} else {
			const best = selectBestAcceptedOpportunity(
				pendingSignals,
				timeSeconds,
				INVESTIGATION_ELIGIBLE_SCORE
			);
			if (best) {
				activeInvestigation = beginInvestigation(best.opportunity, timeSeconds);
				pendingSignals = removePendingByEmissionId(pendingSignals, best.opportunity.emissionId);
				target = pointTarget(activeInvestigation.origin);
			} else if (activeInvestigation) {
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

/**
 * Advance one creature through needs, perception, decisions and actions for a fixed dt.
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

	// 2. Perception tick (episodes + newly perceived for announcements).
	// While committed to signal investigation, freeze ordinary resource-discovery
	// episodes so resources passed en route do not create announcement work or
	// pollute continuous-episode state for later rediscovery.
	const investigationLockedEarly = isInvestigationLocked(next);
	let newlyPerceived: ReturnType<typeof updatePerception>['newlyPerceived'] = [];
	if (!investigationLockedEarly) {
		const perceived = updatePerception(
			next.perception,
			next.position,
			habitat,
			timeSeconds,
			config,
			next.id
		);
		next = { ...next, perception: perceived.perception };
		newlyPerceived = perceived.newlyPerceived;
	}

	// 2a. Resource announcement lifecycle (need-independent; at most one active)
	const announcementConfig = config as AnnouncementStepConfig;
	const announced = stepAnnouncement({
		creature: next,
		habitat,
		timeSeconds,
		newlyPerceived,
		config: announcementConfig
	});
	next = announced.creature;
	if (announced.emissionRequest) {
		emissionRequest = announced.emissionRequest;
	}
	// Preparation ended: restore normal decision flow (restores nextReconsiderAt via applyDecision).
	if (announced.endedPreparation) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	}

	// 2b. Learning: expire pending only
	next = advanceActiveLearning(next, timeSeconds, config);

	// 3. Tracked observation expiry while pursuing a known food/water feature
	if (
		next.target?.kind === 'feature' &&
		(next.target.featureKind === 'food' || next.target.featureKind === 'water') &&
		(next.action === 'move' || next.action === 'search') &&
		isTargetValid(habitat, next.target) &&
		!isAnnouncementLocked(next)
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

	// 4. Search → move when resource perceived (needs only; no emission)
	if (!isAnnouncementLocked(next) && !isInvestigationLocked(next)) {
		const pursued = tryPerceiveAndPursue(next, timeSeconds, config);
		if (pursued) {
			next = pursued;
		}
	}

	const investigationLocked = isInvestigationLocked(next);
	const announcementLocked = isAnnouncementLocked(next);
	const behaviourLocked = investigationLocked || announcementLocked;

	// 5. Invalid target → immediate replan (not while locked).
	// Consumptive eat/drink use habitat-only validity (feature exists + amount > 0).
	// When food is removed or a water basin is empty mid-meal, replan — do not stay
	// stuck on eat/drink with zero grants (recoveryComplete never fires).
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
	if ((!targetOk || investigationStale) && !behaviourLocked) {
		if (next.action === 'search' && next.target?.kind !== 'point' && !investigationStale) {
			const search = ensureSearchTarget(next, simulationSeed, habitat, config);
			next = {
				...next,
				...search,
				action: 'search'
			};
		} else {
			next = replan(next, habitat, timeSeconds, 'invalid_target', config, simulationSeed);
		}
	} else if (investigationStale && !announcementLocked) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	}

	// 6. Recovery complete → replan
	if (
		(next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') &&
		recoveryComplete(next, config)
	) {
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	}

	// 6b. At investigation site
	if (
		next.goal === 'investigate_signal' &&
		next.action === 'investigate' &&
		next.activeInvestigation
	) {
		next = resolveInvestigationAtSite(next, habitat, timeSeconds, config);
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
		return { creature: next, emissionRequest };
	}

	// 7. Ordinary reconsideration
	const isConsumptive = next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	if (!isConsumptive && !behaviourLocked && timeSeconds >= next.nextReconsiderAt) {
		next = replan(next, habitat, timeSeconds, 'reconsider', config, simulationSeed);
	}

	// 8. Pursue action — no movement while eating/drinking/sleeping/investigating
	if (
		next.action === 'eat' ||
		next.action === 'drink' ||
		next.action === 'sleep' ||
		next.action === 'investigate'
	) {
		return { creature: next, emissionRequest };
	}

	// Wander retarget if at wander point before moving.
	if ((next.goal === 'wander' || next.action === 'wander') && !announcementLocked) {
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
	if (next.action === 'search' && !announcementLocked) {
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

	// After movement, re-check announcement clarity (emit mid-reposition when clear).
	if (announcementLocked || next.activeAnnouncementOpportunity !== null) {
		const afterMove = stepAnnouncement({
			creature: next,
			habitat,
			timeSeconds,
			newlyPerceived: [],
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
		!isAnnouncementLocked(next) &&
		isAtTarget(next.position, habitat, next.target, config.arrivalDistance)
	) {
		const transition = transitionToConsumptive(next, timeSeconds, config);
		if (transition) {
			next = { ...next, ...transition };
			if (
				next.goal === 'investigate_signal' &&
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
	if (next.goal === 'wander' && !isAnnouncementLocked(next)) {
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

	if (next.action === 'search' && !isAnnouncementLocked(next)) {
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
