/**
 * Per-creature resource-announcement step: create at most one active opportunity
 * from discoveries, evaluate kind-level clarity, reposition when unclear, and
 * request emission.
 *
 * Policy:
 * - Opportunities are independent of need/goal (created from perception only).
 * - At most one current opportunity — no deferred announcement queue.
 * - Active preparation is committed against ordinary replan (like investigation).
 * - While investigating a signal, ordinary discovery is frozen by the behaviour
 *   orchestrator; this step must not invent deferred tasks.
 * - Cooldown may delay emission of the current opportunity; it is not discarded.
 */

import type { Habitat } from '$lib/habitat';
import type { EmissionRequest } from '../communication/types';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import type { Creature, SimulationConfig } from '../types';
import { evaluateKindClarity, type ClarityResourceCandidate } from './clarity';
import { ensureCreatureMemory } from '../memory/create-memory';
import {
	appendOpportunityDecisions,
	appendOutcome,
	buildOutcome,
	createOpportunitiesFromDiscoveries,
	getActiveOpportunity
} from './opportunity-lifecycle';
import { findSpeakingPosition } from './speaking-position';
import type { AnnouncementOpportunity, NewlyPerceivedResource } from './types';

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
 * Ingest newly perceived resources and advance the single active announcement opportunity.
 */
export function stepAnnouncement(input: {
	creature: Creature;
	habitat: Habitat;
	timeSeconds: number;
	newlyPerceived: readonly NewlyPerceivedResource[];
	config: AnnouncementStepConfig;
}): AnnouncementStepResult {
	const { habitat, timeSeconds, config } = input;
	// Repair missing memory / decision history (HMR-stale or incomplete factories).
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

	// 1. Create at most one opportunity from discoveries (need-independent; consults memory).
	//    While investigation-locked, orchestrator should pass empty newlyPerceived.
	if (input.newlyPerceived.length > 0) {
		const created = createOpportunitiesFromDiscoveries({
			creatureId: creature.id,
			creaturePosition: creature.position,
			newlyPerceived: input.newlyPerceived,
			activeOpportunity: creature.activeAnnouncementOpportunity,
			opportunityCounter: creature.announcementOpportunityCounter,
			memory: creature.memory
		});
		creature = {
			...creature,
			activeAnnouncementOpportunity: created.activeOpportunity,
			announcementOpportunityCounter: created.opportunityCounter,
			recentAnnouncementOpportunityDecisions: appendOpportunityDecisions(
				creature.recentAnnouncementOpportunityDecisions,
				created.decisions,
				config.recentAnnouncementOpportunityDecisionHistoryLimit
			)
		};
	}

	// 2. Do not start/advance preparation while investigation travel/inspect is locked.
	if (isInvestigationLocked(creature) && !isAnnouncementLocked(creature)) {
		return { creature, emissionRequest: null, endedPreparation: false };
	}

	let active = getActiveOpportunity(creature.activeAnnouncementOpportunity);
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

	// Local scope only — no expanded world search for stale/deferred triggers.
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
			finalClarity: clarity,
			repositioningRequired,
			finalEmitterPosition: { x: creature.position.x, y: creature.position.y },
			// Signal id/symbol filled after communication; leave null for local outcome.
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
			// Keep prepare_announcement until orchestrator runs action_complete replan.
		};

		return { creature, emissionRequest, endedPreparation: wasPreparing };
	}

	// 5. Unclear / no announced kind in local scope.
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

	creature = {
		...creature,
		activeAnnouncementOpportunity: active,
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
	const wasPreparing = creature.goal === 'prepare_announcement';
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
			// Keep prepare_announcement until orchestrator runs action_complete replan.
		},
		emissionRequest: null,
		endedPreparation: wasPreparing
	};
}

export { isAnnouncementLocked };
