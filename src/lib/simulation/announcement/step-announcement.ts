/**
 * Announcement executor under the announce_resource intention.
 *
 * Cognition selects announce_resource + feature target. This module advances
 * clarity evaluation, speaking-position search, and emission request construction.
 * It never locks behaviour or forces intention ownership.
 *
 * Successful emission requests do not write resource_announcement memory here —
 * that happens after communication accepts the emission.
 */

import type { Habitat } from '$lib/habitat';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import type { EmissionRequest } from '../communication/types';
import { ensureCreatureMemory } from '../memory/create-memory';
import { hasResourceAnnouncementMemory } from '../memory/query';
import type { Creature, SimulationConfig } from '../types';
import { evaluateKindClarity, type ClarityResourceCandidate } from './clarity';
import { appendOutcome, buildOutcome, getActiveExecution } from './execution-state';
import { findSpeakingPosition } from './speaking-position';
import type { ActiveAnnouncementExecution } from './types';

export type AnnouncementStepConfig = Pick<
	SimulationConfig,
	| 'resourceAnnouncementClarityMargin'
	| 'speakingPositionSearchRadius'
	| 'speakingPositionSearchResolution'
	| 'recentAnnouncementOutcomeHistoryLimit'
	| 'emissionCooldownSeconds'
	| 'creatureRadius'
	| 'sensingRadius'
>;

export type AnnouncementStepResult = {
	creature: Creature;
	emissionRequest: EmissionRequest | null;
	/**
	 * True when this step completed or invalidated announcement execution
	 * (emit, invalidate, or cannot start). Orchestrator defers re-arbitration
	 * after a successful emissionRequest until post-communication memory exists.
	 */
	endedPreparation: boolean;
};

function canEmitNow(lastEmissionAt: number, timeSeconds: number, cooldownSeconds: number): boolean {
	if (lastEmissionAt < 0) {
		return true;
	}
	return timeSeconds - lastEmissionAt >= cooldownSeconds;
}

/**
 * Clarity candidate scope: current perception observations union habitat food/water
 * within max(sensingRadius, speakingPositionSearchRadius) of the evaluation position.
 */
export function collectClarityCandidates(
	position: Creature['position'],
	habitat: Habitat,
	perceptionObservations: Creature['perception']['observations'],
	radius: number
): ClarityResourceCandidate[] {
	const byId = new Map<string, ClarityResourceCandidate>();
	for (const obs of perceptionObservations) {
		byId.set(obs.featureId, {
			featureId: obs.featureId,
			resourceKind: obs.featureKind,
			position: { x: obs.position.x, y: obs.position.y }
		});
	}
	const nearby = queryFeaturesNear(habitat, position, radius, ['food', 'water']);
	for (const feature of nearby) {
		if (feature.kind !== 'food' && feature.kind !== 'water') {
			continue;
		}
		if (!byId.has(feature.id)) {
			byId.set(feature.id, {
				featureId: feature.id,
				resourceKind: feature.kind,
				position: { x: feature.position.x, y: feature.position.y }
			});
		}
	}
	return [...byId.values()].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);
}

function featureStillAvailable(
	habitat: Habitat,
	featureId: string,
	kind: 'food' | 'water'
): boolean {
	const list = kind === 'food' ? habitat.food : habitat.water;
	const feature = list.find((f) => f.id === featureId);
	return feature !== undefined && feature.amount > 0;
}

/**
 * Ensure execution-local state for announce_resource.
 *
 * Ordering is intentional: an existing execution survives when the creature
 * target is the speaking-position point (repositioning). New executions still
 * require a cognition-selected feature target. The trigger feature identity
 * lives on the execution record, not on the movement target.
 */
function ensureExecutorState(
	creature: Creature,
	habitat: Habitat
): { creature: Creature; active: ActiveAnnouncementExecution | null } {
	if (creature.intention !== 'announce_resource') {
		return {
			creature: {
				...creature,
				activeAnnouncementExecution: null
			},
			active: null
		};
	}

	const existing = getActiveExecution(creature.activeAnnouncementExecution);
	if (existing) {
		// Memory may have been written mid-flight (should be rare); do not keep prep.
		if (hasResourceAnnouncementMemory(creature.memory, existing.triggerFeatureId)) {
			return {
				creature: {
					...creature,
					activeAnnouncementExecution: null
				},
				active: null
			};
		}
		// Continue execution — target may legitimately be the speaking-position point.
		return { creature, active: existing };
	}

	// No active execution: create only from cognition-selected feature target.
	const target = creature.target;
	if (
		!target ||
		target.kind !== 'feature' ||
		(target.featureKind !== 'food' && target.featureKind !== 'water')
	) {
		return {
			creature: {
				...creature,
				activeAnnouncementExecution: null
			},
			active: null
		};
	}

	if (hasResourceAnnouncementMemory(creature.memory, target.featureId)) {
		return {
			creature: {
				...creature,
				activeAnnouncementExecution: null
			},
			active: null
		};
	}

	const list = target.featureKind === 'food' ? habitat.food : habitat.water;
	const feature = list.find((f) => f.id === target.featureId);
	if (!feature || feature.amount <= 0) {
		return {
			creature: { ...creature, activeAnnouncementExecution: null },
			active: null
		};
	}

	const counter = creature.announcementExecutionCounter + 1;
	const active: ActiveAnnouncementExecution = {
		id: `ann-${creature.id}-${counter}`,
		creatureId: creature.id,
		triggerFeatureId: feature.id,
		resourceKind: target.featureKind,
		triggerFeaturePosition: { x: feature.position.x, y: feature.position.y },
		state: 'evaluating',
		speakingTarget: null,
		initialClarity: null
	};

	return {
		creature: {
			...creature,
			activeAnnouncementExecution: active,
			announcementExecutionCounter: counter
		},
		active
	};
}

/**
 * Advance announcement executor when intention is announce_resource.
 * Clears stale executor state when intention is not announce.
 */
export function stepAnnouncement(input: {
	creature: Creature;
	habitat: Habitat;
	timeSeconds: number;
	config: AnnouncementStepConfig;
}): AnnouncementStepResult {
	const { habitat, timeSeconds, config } = input;
	let creature = ensureCreatureMemory(input.creature);

	// Not announcing: drop executor state.
	if (creature.intention !== 'announce_resource') {
		if (creature.activeAnnouncementExecution !== null) {
			creature = { ...creature, activeAnnouncementExecution: null };
		}
		return { creature, emissionRequest: null, endedPreparation: false };
	}

	const ensured = ensureExecutorState(creature, habitat);
	creature = ensured.creature;
	let active = ensured.active;
	if (!active) {
		return { creature, emissionRequest: null, endedPreparation: true };
	}

	if (!featureStillAvailable(habitat, active.triggerFeatureId, active.resourceKind)) {
		return finalizeInvalid(creature, active, timeSeconds, 'invalid_trigger_feature', config);
	}
	const kindList = active.resourceKind === 'food' ? habitat.food : habitat.water;
	if (!kindList.some((f) => f.amount > 0)) {
		return finalizeInvalid(creature, active, timeSeconds, 'no_announced_kind_available', config);
	}

	const scopeRadius = Math.max(config.sensingRadius, config.speakingPositionSearchRadius);
	const candidates = collectClarityCandidates(
		creature.position,
		habitat,
		creature.perception.observations,
		scopeRadius
	);

	const clarity = evaluateKindClarity({
		position: creature.position,
		announcedKind: active.resourceKind,
		candidates,
		clarityMargin: config.resourceAnnouncementClarityMargin
	});

	if (!active.initialClarity) {
		active = { ...active, initialClarity: clarity };
		creature = {
			...creature,
			activeAnnouncementExecution: active
		};
	}

	if (clarity.clear) {
		if (!canEmitNow(creature.lastEmissionAt, timeSeconds, config.emissionCooldownSeconds)) {
			return { creature, emissionRequest: null, endedPreparation: false };
		}

		const emissionRequest: EmissionRequest = {
			senderId: creature.id,
			origin: { x: creature.position.x, y: creature.position.y },
			context: 'resource_discovered',
			contextDetail: active.resourceKind,
			triggerFeatureId: active.triggerFeatureId,
			triggerFeaturePosition: { ...active.triggerFeaturePosition },
			clarityEvidence: clarity
		};

		const repositioningRequired =
			active.state === 'repositioning' ||
			(active.initialClarity !== null && !active.initialClarity.clear);

		const outcome = buildOutcome({
			execution: active,
			completedAt: timeSeconds,
			reason: 'emission_requested',
			finalClarity: clarity,
			repositioningRequired,
			finalEmitterPosition: { x: creature.position.x, y: creature.position.y }
		});

		creature = {
			...creature,
			activeAnnouncementExecution: null,
			recentAnnouncementOutcomes: appendOutcome(
				creature.recentAnnouncementOutcomes,
				outcome,
				config.recentAnnouncementOutcomeHistoryLimit
			)
		};

		return { creature, emissionRequest, endedPreparation: true };
	}

	if (clarity.reason === 'no_announced_kind_in_scope') {
		return finalizeInvalid(creature, active, timeSeconds, 'no_announced_kind_available', config);
	}

	const speaking = findSpeakingPosition({
		creaturePosition: creature.position,
		announcedKind: active.resourceKind,
		candidates,
		habitat,
		config: {
			clarityMargin: config.resourceAnnouncementClarityMargin,
			searchRadius: config.speakingPositionSearchRadius,
			searchResolution: config.speakingPositionSearchResolution,
			creatureRadius: config.creatureRadius
		}
	});

	if (!speaking.ok) {
		return finalizeInvalid(
			creature,
			active,
			timeSeconds,
			speaking.reason === 'no_announced_kind_available'
				? 'no_announced_kind_available'
				: 'no_valid_speaking_position',
			config
		);
	}

	active = {
		...active,
		state: 'repositioning',
		speakingTarget: speaking.position
	};

	// Executor only moves the target point; intention remains announce_resource.
	creature = {
		...creature,
		activeAnnouncementExecution: active,
		action: 'move',
		target: { kind: 'point', position: { ...speaking.position } }
	};

	return { creature, emissionRequest: null, endedPreparation: false };
}

function finalizeInvalid(
	creature: Creature,
	active: ActiveAnnouncementExecution,
	timeSeconds: number,
	reason: 'invalid_trigger_feature' | 'no_announced_kind_available' | 'no_valid_speaking_position',
	config: AnnouncementStepConfig
): AnnouncementStepResult {
	const outcome = buildOutcome({
		execution: active,
		completedAt: timeSeconds,
		reason,
		finalClarity: active.initialClarity,
		repositioningRequired: active.state === 'repositioning',
		finalEmitterPosition: { x: creature.position.x, y: creature.position.y }
	});
	return {
		creature: {
			...creature,
			activeAnnouncementExecution: null,
			recentAnnouncementOutcomes: appendOutcome(
				creature.recentAnnouncementOutcomes,
				outcome,
				config.recentAnnouncementOutcomeHistoryLimit
			)
		},
		emissionRequest: null,
		endedPreparation: true
	};
}
