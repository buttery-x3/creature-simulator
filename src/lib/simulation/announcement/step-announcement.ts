/**
 * Announcement executor under the announce_resource intention.
 *
 * Cognition selects announce_resource + feature target. This module advances
 * clarity evaluation, speaking-position search, and emission request construction.
 * It never locks behaviour or forces intention ownership.
 */

import type { Habitat } from '$lib/habitat';
import type { EmissionRequest } from '../communication/types';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import type { Creature, SimulationConfig } from '../types';
import { evaluateKindClarity, type ClarityResourceCandidate } from './clarity';
import { ensureCreatureMemory } from '../memory/create-memory';
import { appendOutcome, buildOutcome, getActiveOpportunity } from './opportunity-lifecycle';
import { findSpeakingPosition } from './speaking-position';
import type { AnnouncementOpportunity } from './types';

export type AnnouncementStepConfig = Pick<
	SimulationConfig,
	| 'resourceAnnouncementClarityMargin'
	| 'speakingPositionSearchRadius'
	| 'speakingPositionSearchResolution'
	| 'recentAnnouncementOutcomeHistoryLimit'
	| 'recentAnnouncementOpportunityDecisionHistoryLimit'
	| 'triggerFeatureCueFadeSeconds'
	| 'emissionCooldownSeconds'
	| 'creatureRadius'
	| 'sensingRadius'
	| 'decisionHistoryLimit'
>;

export type AnnouncementStepResult = {
	creature: Creature;
	emissionRequest: EmissionRequest | null;
	/**
	 * True when this step completed or invalidated announcement execution
	 * (emit, invalidate). Orchestrator should request action_complete arbitration.
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

function ensureExecutorOpportunity(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number
): { creature: Creature; active: AnnouncementOpportunity | null } {
	const target = creature.target;
	if (
		creature.intention !== 'announce_resource' ||
		!target ||
		target.kind !== 'feature' ||
		(target.featureKind !== 'food' && target.featureKind !== 'water')
	) {
		return {
			creature: {
				...creature,
				activeAnnouncementOpportunity: null
			},
			active: null
		};
	}

	const existing = getActiveOpportunity(creature.activeAnnouncementOpportunity);
	if (existing && existing.triggerFeatureId === target.featureId) {
		return { creature, active: existing };
	}

	const list = target.featureKind === 'food' ? habitat.food : habitat.water;
	const feature = list.find((f) => f.id === target.featureId);
	if (!feature || feature.amount <= 0) {
		return {
			creature: { ...creature, activeAnnouncementOpportunity: null },
			active: null
		};
	}

	const counter = creature.announcementOpportunityCounter + 1;
	const active: AnnouncementOpportunity = {
		id: `ann-${creature.id}-${counter}`,
		creatureId: creature.id,
		triggerFeatureId: feature.id,
		resourceKind: target.featureKind,
		triggerFeaturePosition: { x: feature.position.x, y: feature.position.y },
		perceptionEpisodeId: `exec-${feature.id}`,
		discoveredAt: timeSeconds,
		discoveryCreaturePosition: { x: creature.position.x, y: creature.position.y },
		state: 'ready',
		speakingTarget: null,
		initialClarity: null
	};

	return {
		creature: {
			...creature,
			activeAnnouncementOpportunity: active,
			announcementOpportunityCounter: counter,
			activeAnnouncementCue: {
				opportunityId: active.id,
				triggerFeatureId: active.triggerFeatureId,
				triggerFeaturePosition: { ...active.triggerFeaturePosition },
				fadeStartedAt: null
			}
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

	// Expire faded presentation cue.
	if (
		creature.activeAnnouncementCue?.fadeStartedAt !== null &&
		creature.activeAnnouncementCue?.fadeStartedAt !== undefined &&
		timeSeconds - creature.activeAnnouncementCue.fadeStartedAt >=
			config.triggerFeatureCueFadeSeconds
	) {
		creature = { ...creature, activeAnnouncementCue: null };
	}

	// Not announcing: drop executor opportunity (cue may still fade).
	if (creature.intention !== 'announce_resource') {
		if (creature.activeAnnouncementOpportunity !== null) {
			creature = { ...creature, activeAnnouncementOpportunity: null };
		}
		return { creature, emissionRequest: null, endedPreparation: false };
	}

	const ensured = ensureExecutorOpportunity(creature, habitat, timeSeconds);
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
			activeAnnouncementOpportunity: active
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
			opportunityId: active.id,
			perceptionEpisodeId: active.perceptionEpisodeId,
			triggerFeatureId: active.triggerFeatureId,
			triggerFeaturePosition: { ...active.triggerFeaturePosition },
			discoveredAt: active.discoveredAt,
			clarityEvidence: clarity
		};

		const repositioningRequired =
			active.state === 'repositioning' ||
			(active.initialClarity !== null && !active.initialClarity.clear);

		const outcome = buildOutcome({
			opportunity: active,
			completedAt: timeSeconds,
			reason: 'emitted',
			finalClarity: clarity,
			repositioningRequired,
			finalEmitterPosition: { x: creature.position.x, y: creature.position.y },
			emittedSignalId: null,
			emittedSymbolId: null,
			productionMode: null
		});

		creature = {
			...creature,
			activeAnnouncementOpportunity: null,
			recentAnnouncementOutcomes: appendOutcome(
				creature.recentAnnouncementOutcomes,
				outcome,
				config.recentAnnouncementOutcomeHistoryLimit
			),
			activeAnnouncementCue: {
				opportunityId: active.id,
				triggerFeatureId: active.triggerFeatureId,
				triggerFeaturePosition: { ...active.triggerFeaturePosition },
				fadeStartedAt: timeSeconds
			}
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
		activeAnnouncementOpportunity: active,
		action: 'move',
		target: { kind: 'point', position: { ...speaking.position } },
		activeAnnouncementCue: {
			opportunityId: active.id,
			triggerFeatureId: active.triggerFeatureId,
			triggerFeaturePosition: { ...active.triggerFeaturePosition },
			fadeStartedAt: null
		}
	};

	return { creature, emissionRequest: null, endedPreparation: false };
}

function finalizeInvalid(
	creature: Creature,
	active: AnnouncementOpportunity,
	timeSeconds: number,
	reason: 'invalid_trigger_feature' | 'no_announced_kind_available' | 'no_valid_speaking_position',
	config: AnnouncementStepConfig
): AnnouncementStepResult {
	const outcome = buildOutcome({
		opportunity: active,
		completedAt: timeSeconds,
		reason,
		finalClarity: active.initialClarity,
		repositioningRequired: active.state === 'repositioning',
		finalEmitterPosition: { x: creature.position.x, y: creature.position.y },
		emittedSignalId: null,
		emittedSymbolId: null,
		productionMode: null
	});
	return {
		creature: {
			...creature,
			activeAnnouncementOpportunity: null,
			recentAnnouncementOutcomes: appendOutcome(
				creature.recentAnnouncementOutcomes,
				outcome,
				config.recentAnnouncementOutcomeHistoryLimit
			),
			activeAnnouncementCue:
				creature.activeAnnouncementCue?.opportunityId === active.id
					? null
					: creature.activeAnnouncementCue
		},
		emissionRequest: null,
		endedPreparation: true
	};
}
