/**
 * Per-creature resource-announcement step: create opportunities from discoveries,
 * evaluate kind-level clarity, reposition when unclear, and request emission.
 *
 * Policy:
 * - Opportunities are independent of need/goal (created from perception only).
 * - Active preparation is committed against ordinary replan (like investigation).
 * - While investigating a signal, new opportunities may queue but preparation
 *   does not start until investigation is not locked.
 * - Cooldown may delay emission; opportunities are not discarded for cooldown.
 */

import type { Habitat } from '$lib/habitat';
import type { EmissionRequest } from '../communication/types';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import type { Creature, SimulationConfig } from '../types';
import { evaluateKindClarity, type ClarityResourceCandidate } from './clarity';
import {
	appendOpportunityDecisions,
	appendOutcome,
	buildOutcome,
	createOpportunitiesFromDiscoveries,
	getActiveOpportunity,
	removeOpportunityAndPromote,
	updateOpportunity
} from './opportunity-lifecycle';
import { findSpeakingPosition } from './speaking-position';
import type { NewlyPerceivedResource } from './types';

export type AnnouncementStepConfig = Pick<
	SimulationConfig,
	| 'resourceAnnouncementClarityMargin'
	| 'speakingPositionSearchRadius'
	| 'speakingPositionSearchResolution'
	| 'maxQueuedAnnouncementOpportunitiesPerCreature'
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
	 * True when this step ended `prepare_announcement` (emit, invalidate, or stuck).
	 * Orchestrator must run an `action_complete` replan so normal decision timing resumes.
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
 * Same-kind and opposite-kind features in that set participate; same-kind never compete.
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
		byId.set(feature.id, {
			featureId: feature.id,
			resourceKind: feature.kind,
			position: { x: feature.position.x, y: feature.position.y }
		});
	}
	return [...byId.values()].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);
}

function featureStillExists(habitat: Habitat, featureId: string, kind: 'food' | 'water'): boolean {
	const list = kind === 'food' ? habitat.food : habitat.water;
	return list.some((f) => f.id === featureId);
}

function isInvestigationLocked(creature: Creature): boolean {
	return (
		creature.goal === 'investigate_signal' &&
		creature.activeInvestigation !== null &&
		(creature.action === 'move' || creature.action === 'investigate')
	);
}

function isAnnouncementLocked(creature: Creature): boolean {
	return creature.goal === 'prepare_announcement';
}

/**
 * Ingest newly perceived resources and advance the active announcement opportunity.
 */
export function stepAnnouncement(input: {
	creature: Creature;
	habitat: Habitat;
	timeSeconds: number;
	newlyPerceived: readonly NewlyPerceivedResource[];
	config: AnnouncementStepConfig;
}): AnnouncementStepResult {
	const { habitat, timeSeconds, config } = input;
	let creature = input.creature;

	// Expire faded presentation cue.
	if (
		creature.activeAnnouncementCue?.fadeStartedAt !== null &&
		creature.activeAnnouncementCue?.fadeStartedAt !== undefined &&
		timeSeconds - creature.activeAnnouncementCue.fadeStartedAt >=
			config.triggerFeatureCueFadeSeconds
	) {
		creature = { ...creature, activeAnnouncementCue: null };
	}

	// 1. Create opportunities from discoveries (need-independent; consults memory).
	if (input.newlyPerceived.length > 0) {
		const created = createOpportunitiesFromDiscoveries({
			creatureId: creature.id,
			creaturePosition: creature.position,
			newlyPerceived: input.newlyPerceived,
			existing: creature.announcementOpportunities,
			opportunityCounter: creature.announcementOpportunityCounter,
			memory: creature.memory,
			config
		});
		let outcomes = creature.recentAnnouncementOutcomes;
		for (const overflow of created.overflowOutcomes) {
			outcomes = appendOutcome(outcomes, overflow, config.recentAnnouncementOutcomeHistoryLimit);
		}
		creature = {
			...creature,
			announcementOpportunities: created.opportunities,
			announcementOpportunityCounter: created.opportunityCounter,
			recentAnnouncementOutcomes: outcomes,
			recentAnnouncementOpportunityDecisions: appendOpportunityDecisions(
				creature.recentAnnouncementOpportunityDecisions,
				created.decisions,
				config.recentAnnouncementOpportunityDecisionHistoryLimit
			)
		};
	}

	// 2. Do not start/advance preparation while investigation travel/inspect is locked.
	//    Queued opportunities remain; preparation waits.
	if (isInvestigationLocked(creature) && !isAnnouncementLocked(creature)) {
		return { creature, emissionRequest: null, endedPreparation: false };
	}

	let active = getActiveOpportunity(creature.announcementOpportunities);
	if (!active) {
		// Stuck prepare without an open opportunity — leave goal for action_complete replan.
		if (creature.goal === 'prepare_announcement') {
			return { creature, emissionRequest: null, endedPreparation: true };
		}
		return { creature, emissionRequest: null, endedPreparation: false };
	}

	// 3. Invalidate if trigger gone or no announced-kind resources remain in habitat.
	if (!featureStillExists(habitat, active.triggerFeatureId, active.resourceKind)) {
		return finalizeInvalid(creature, active, timeSeconds, 'invalid_trigger_feature', config);
	}
	const kindList = active.resourceKind === 'food' ? habitat.food : habitat.water;
	if (kindList.length === 0) {
		return finalizeInvalid(creature, active, timeSeconds, 'no_announced_kind_available', config);
	}

	const scopeRadius = Math.max(
		config.sensingRadius,
		config.speakingPositionSearchRadius,
		config.resourceAnnouncementClarityMargin * 4
	);
	const candidates = collectClarityCandidates(
		creature.position,
		habitat,
		creature.perception.observations,
		scopeRadius
	);

	let clarity = evaluateKindClarity({
		position: creature.position,
		announcedKind: active.resourceKind,
		candidates,
		clarityMargin: config.resourceAnnouncementClarityMargin
	});

	if (!active.initialClarity) {
		active = { ...active, initialClarity: clarity };
		creature = {
			...creature,
			announcementOpportunities: updateOpportunity(creature.announcementOpportunities, active)
		};
	}

	// 4. Clear at current position → emit when cooldown allows.
	if (clarity.clear) {
		if (!canEmitNow(creature.lastEmissionAt, timeSeconds, config.emissionCooldownSeconds)) {
			// Stay committed if already preparing; otherwise hold ready without force-moving.
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
		const wasPreparing = creature.goal === 'prepare_announcement';

		const outcome = buildOutcome({
			opportunity: active,
			completedAt: timeSeconds,
			reason: 'emitted',
			queuePosition: null,
			finalClarity: clarity,
			repositioningRequired,
			finalEmitterPosition: { x: creature.position.x, y: creature.position.y },
			// Signal id/symbol filled after communication; leave null for local outcome.
			emittedSignalId: null,
			emittedSymbolId: null,
			productionMode: null
		});

		const remaining = removeOpportunityAndPromote(creature.announcementOpportunities, active.id);

		creature = {
			...creature,
			announcementOpportunities: remaining,
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
			// Keep prepare_announcement until orchestrator runs action_complete replan.
		};

		return { creature, emissionRequest, endedPreparation: wasPreparing };
	}

	// 5. Unclear → find speaking position and commit to preparation.
	if (clarity.reason === 'no_announced_kind_in_scope') {
		// Expand candidates: re-query at larger radius using habitat only.
		const expanded = collectClarityCandidates(
			creature.position,
			habitat,
			creature.perception.observations,
			Math.max(scopeRadius, config.speakingPositionSearchRadius * 2)
		);
		clarity = evaluateKindClarity({
			position: creature.position,
			announcedKind: active.resourceKind,
			candidates: expanded,
			clarityMargin: config.resourceAnnouncementClarityMargin
		});
		if (clarity.clear) {
			// Fall through by re-entering emit path next step; update candidates scope below.
		} else if (clarity.reason === 'no_announced_kind_in_scope') {
			return finalizeInvalid(creature, active, timeSeconds, 'no_announced_kind_available', config);
		}
	}

	const speaking = findSpeakingPosition({
		creaturePosition: creature.position,
		announcedKind: active.resourceKind,
		candidates: collectClarityCandidates(
			creature.position,
			habitat,
			creature.perception.observations,
			Math.max(scopeRadius, config.speakingPositionSearchRadius * 2)
		),
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

	creature = {
		...creature,
		announcementOpportunities: updateOpportunity(creature.announcementOpportunities, active),
		goal: 'prepare_announcement',
		action: 'move',
		target: { kind: 'point', position: { ...speaking.position } },
		goalStartedAt: creature.goal === 'prepare_announcement' ? creature.goalStartedAt : timeSeconds,
		actionStartedAt:
			creature.goal === 'prepare_announcement' && creature.action === 'move'
				? creature.actionStartedAt
				: timeSeconds,
		// Commitment is the prepare_announcement lock only — do not push nextReconsiderAt.
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
	active: NonNullable<ReturnType<typeof getActiveOpportunity>>,
	timeSeconds: number,
	reason: 'invalid_trigger_feature' | 'no_announced_kind_available' | 'no_valid_speaking_position',
	config: AnnouncementStepConfig
): AnnouncementStepResult {
	const outcome = buildOutcome({
		opportunity: active,
		completedAt: timeSeconds,
		reason,
		queuePosition: null,
		finalClarity: active.initialClarity,
		repositioningRequired: active.state === 'repositioning',
		finalEmitterPosition: { x: creature.position.x, y: creature.position.y },
		emittedSignalId: null,
		emittedSymbolId: null,
		productionMode: null
	});
	const remaining = removeOpportunityAndPromote(creature.announcementOpportunities, active.id);
	const wasPreparing = creature.goal === 'prepare_announcement';
	return {
		creature: {
			...creature,
			announcementOpportunities: remaining,
			recentAnnouncementOutcomes: appendOutcome(
				creature.recentAnnouncementOutcomes,
				outcome,
				config.recentAnnouncementOutcomeHistoryLimit
			),
			activeAnnouncementCue:
				creature.activeAnnouncementCue?.opportunityId === active.id
					? null
					: creature.activeAnnouncementCue
			// Keep prepare_announcement until orchestrator runs action_complete replan.
		},
		emissionRequest: null,
		endedPreparation: wasPreparing
	};
}

export { isAnnouncementLocked };
