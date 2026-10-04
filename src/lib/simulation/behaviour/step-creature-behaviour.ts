/**
 * Per-creature fixed-step behaviour: needs → perception → arbitration → action/movement.
 * May request a communication emission via the announcement executor; does not transmit.
 *
 * Intention selection is exclusive to cognition (`arbitrate`). This module only
 * requests reconsideration and executes the current intention.
 *
 * Successful announcement emission requests defer action_complete arbitration until
 * the next step so resource_announcement memory (written post-communication) is visible.
 */

import type { Habitat } from '$lib/habitat';
import { stepAnnouncement, type AnnouncementStepConfig } from '../announcement/step-announcement';
import { hasFreshDangerSignal } from '../cognition/danger/warning-candidates';
import type { ArbitrationTrigger } from '../cognition/types';
import type { EmissionRequest } from '../communication/types';
import { resolveInvestigationAtSite } from '../learning/step-signal-learning';
import type { Creature, SimulationConfig } from '../types';
import { appendTransition } from './actions';
import { replanFromArbitration, type ReplanConfig } from './apply-arbitration';
import { advanceNeeds, recoveryComplete, type ConsumptionGrants } from './needs';
import { requestDangerWarning } from './execution/danger-expression';
import { senseCreature } from './sensing/sense-creature';
import { pursueAction, applyAnnouncementEnd } from './execution/pursue-action';
import type { Wildlife } from '../ecology/types';
import { advanceBody } from '../ecology/body';
import { ensureSearchTarget, isTargetValid } from './resource-awareness';

/** Result of one creature behaviour step, including optional emission handoff. */
export type CreatureBehaviourStepResult = {
	creature: Creature;
	emissionRequest: EmissionRequest | null;
};

export type BehaviourStepConfig = Pick<
	SimulationConfig,
	| 'ecology'
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
	| 'signalBaseline'
	| 'signalRecencyBoostMax'
	| 'announceBaseline'
	| 'continuityBonus'
	| 'targetQualityVisible'
	| 'targetQualityRemembered'
	| 'targetQualitySearch'
	| 'explorationDistanceWeight'
	| 'explorationStalenessWeight'
	| 'explorationStalenessScaleSeconds'
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
	grants: ConsumptionGrants = { food: 0, water: 0 },
	wildlife: readonly Wildlife[] = []
): CreatureBehaviourStepResult {
	// Snapshot so a deferred post-emit trigger set later this step cannot fire now.
	const incomingPendingTrigger = creature.pendingArbitrationTrigger;

	const needs = advanceNeeds(creature, dt, config, grants);
	let next: Creature = advanceBody({ ...creature, ...needs }, dt, config.ecology);
	let emissionRequest: EmissionRequest | null = null;

	const sensed = senseCreature(next, habitat, timeSeconds, config, wildlife);
	next = sensed.creature;
	const { perceptionChanged, dangerChanged, wildlifeChanged } = sensed;
	const heardWarning =
		incomingPendingTrigger === 'new_heard_signal_memory' &&
		hasFreshDangerSignal(next.memory, next.lexicon, timeSeconds);
	const dangerReplanned =
		dangerChanged || incomingPendingTrigger === 'danger_perception_change' || heardWarning;
	if (dangerReplanned) {
		next = replan(
			next,
			habitat,
			timeSeconds,
			heardWarning ? 'new_heard_signal_memory' : 'danger_perception_change',
			config,
			simulationSeed
		);
	}

	// 2. Announcement executor (only advances when intention is announce_resource).
	const announcementConfig = config as AnnouncementStepConfig;
	const announced = stepAnnouncement({
		creature: next,
		habitat,
		timeSeconds,
		config: announcementConfig
	});
	const afterAnnounce = applyAnnouncementEnd(
		next,
		habitat,
		timeSeconds,
		config,
		simulationSeed,
		announced
	);
	next = afterAnnounce.creature;
	if (afterAnnounce.emissionRequest) {
		emissionRequest = afterAnnounce.emissionRequest;
	}

	// 3. Invalid target → immediate arbitration (skip if we already emitted this step).
	if (!emissionRequest) {
		const investigationStale =
			next.intention === 'investigate_signal' && next.activeInvestigation === null;
		const targetOk = isTargetValid(habitat, next.target, next.perceivedWildlife);
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
	}

	// 4. Recovery complete → replan
	if (
		!emissionRequest &&
		(next.action === 'eat' || next.action === 'drink' || next.action === 'sleep') &&
		recoveryComplete(next, config)
	) {
		next = replan(next, habitat, timeSeconds, 'need_or_recovery_complete', config, simulationSeed);
	}

	// 5. At investigation site
	if (
		!emissionRequest &&
		next.intention === 'investigate_signal' &&
		next.action === 'investigate' &&
		next.activeInvestigation
	) {
		next = resolveInvestigationAtSite(next, habitat, timeSeconds, config);
		next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
		return { creature: next, emissionRequest };
	}

	// 6. Event / periodic reconsideration — not after a successful same-step emit.
	const isConsumptive = next.action === 'eat' || next.action === 'drink' || next.action === 'sleep';
	if (!emissionRequest && !dangerReplanned && !isConsumptive) {
		if (incomingPendingTrigger) {
			next = replan(next, habitat, timeSeconds, incomingPendingTrigger, config, simulationSeed);
		} else if (next.pendingArbitrationTrigger) {
			// e.g. set mid-step by other paths without emit (should be rare).
			const trigger = next.pendingArbitrationTrigger;
			next = replan(next, habitat, timeSeconds, trigger, config, simulationSeed);
		} else if (wildlifeChanged) {
			next = replan(
				next,
				habitat,
				timeSeconds,
				'wildlife_perception_change',
				config,
				simulationSeed
			);
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

	const pursued = pursueAction(
		next,
		dt,
		timeSeconds,
		simulationSeed,
		habitat,
		config,
		emissionRequest
	);
	return {
		creature: pursued.creature,
		emissionRequest:
			pursued.emissionRequest ?? requestDangerWarning(pursued.creature, timeSeconds, config)
	};
}

// Re-export appendTransition for tests that import from step module historically.
export { appendTransition };
