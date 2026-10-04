import { executeExpression, SOCIAL_DEFAULTS } from '../../social';
import type { Habitat } from '$lib/habitat';
import {
	stepAnnouncement,
	type AnnouncementStepConfig
} from '../../announcement/step-announcement';
import type { EmissionRequest } from '../../communication/types';
import { distanceSquared, moveToward, sampleSearchTarget } from '../../creature-movement';
import { resolveInvestigationAtSite } from '../../learning/step-signal-learning';
import type { Creature } from '../../types';
import { transitionToConsumptive } from '../actions';
import { replanFromArbitration as replan } from '../apply-arbitration';
import { isAtTarget, movementPoint, pointTarget } from '../resource-awareness';
import type { BehaviourStepConfig, CreatureBehaviourStepResult } from '../step-creature-behaviour';
/**
 * Handle announcement executor completion.
 * Successful emission: defer action_complete to next step (memory not yet written).
 * Invalid/end without emit: replan immediately.
 */
export function applyAnnouncementEnd(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	config: BehaviourStepConfig,
	simulationSeed: string,
	result: { creature: Creature; emissionRequest: EmissionRequest | null; endedPreparation: boolean }
): { creature: Creature; emissionRequest: EmissionRequest | null } {
	let next = result.creature;
	const emissionRequest = result.emissionRequest;
	if (!result.endedPreparation) {
		return { creature: next, emissionRequest };
	}
	if (emissionRequest) {
		// Defer until after communication + applySuccessfulAnnouncementMemories.
		next = {
			...next,
			pendingArbitrationTrigger: 'action_complete'
		};
		return { creature: next, emissionRequest };
	}
	next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
	return { creature: next, emissionRequest: null };
}

/** Execute selected physical actions without owning intention policy. */
export function pursueAction(
	creature: Creature,
	dt: number,
	timeSeconds: number,
	simulationSeed: string,
	habitat: Habitat,
	config: BehaviourStepConfig,
	request: EmissionRequest | null
): CreatureBehaviourStepResult {
	let next = executeExpression(creature, timeSeconds);
	let emissionRequest = request;
	const announcementConfig = config as AnnouncementStepConfig;
	// 7. Pursue action — no movement while eating/drinking/sleeping/investigating
	if (
		(next.action === 'court' &&
			isAtTarget(
				next.position,
				habitat,
				next.target,
				config.lifecycle.courtshipDistance,
				next.perceivedWildlife,
				next.perceivedPeers
			)) ||
		next.action === 'dance' ||
		next.action === 'cry' ||
		next.action === 'eat' ||
		next.action === 'drink' ||
		next.action === 'sleep' ||
		next.action === 'investigate' ||
		(next.action === 'fight' &&
			isAtTarget(
				next.position,
				habitat,
				next.target,
				config.ecology.encounterDistance,
				next.perceivedWildlife
			))
	) {
		return { creature: next, emissionRequest };
	}

	// Search retarget if at search point (need-driven; independent of exploration).
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

	if (next.action === 'fight' || next.action === 'court') next = { ...next, action: 'move' };
	const fallback = next.action === 'search' ? next.searchTarget : next.position;
	const destination = movementPoint(
		habitat,
		next.target,
		fallback,
		next.perceivedWildlife,
		next.perceivedPeers
	);
	const moved = moveToward(next, destination, dt, habitat.bounds, config);
	next = { ...next, ...moved };

	// After movement, re-check announcement clarity — never a second executor pass after emit.
	if (
		!emissionRequest &&
		(next.intention === 'announce_resource' || next.activeAnnouncementExecution !== null)
	) {
		const afterMove = stepAnnouncement({
			creature: next,
			habitat,
			timeSeconds,
			config: announcementConfig
		});
		const applied = applyAnnouncementEnd(
			next,
			habitat,
			timeSeconds,
			config,
			simulationSeed,
			afterMove
		);
		next = applied.creature;
		if (applied.emissionRequest) {
			emissionRequest = applied.emissionRequest;
		}
	}

	// Arrive at feature → consumptive action, or arrive at signal origin → investigate
	if (
		!emissionRequest &&
		next.action === 'move' &&
		isAtTarget(
			next.position,
			habitat,
			next.target,
			next.target?.kind === 'wildlife'
				? config.ecology.encounterDistance
				: next.target?.kind === 'creature'
					? next.intention === 'court_peer'
						? config.lifecycle.courtshipDistance
						: SOCIAL_DEFAULTS.comfortDistance
					: config.arrivalDistance,
			next.perceivedWildlife,
			next.perceivedPeers
		)
	) {
		if (next.intention === 'approach_peer') {
			next = replan(next, habitat, timeSeconds, 'action_complete', config, simulationSeed);
			return { creature: executeExpression(next, timeSeconds), emissionRequest };
		}
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
