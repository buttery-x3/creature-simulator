/**
 * Announcement opportunity creation, completion and invalidation.
 *
 * Pure state transitions — movement and emission handoff live in step-announcement.
 * Memory storage lives in simulation/memory/; this module only consults it.
 *
 * At most one active opportunity per creature. Discoveries that cannot become the
 * current announcement are recorded as local diagnostics only — never deferred tasks.
 */

import type { Vec2 } from '$lib/habitat';
import type {
	AnnouncementOpportunity,
	AnnouncementOpportunityOutcome,
	AnnouncementOutcomeReason,
	ClarityEvidence,
	NewlyPerceivedResource
} from './types';
import type { SymbolId, SymbolSelectionMode } from '../communication/types';
import type { AnnouncementOpportunityDecision, CreatureMemory } from '../memory/types';
import { hasResourceAnnouncementMemory } from '../memory/query';

export type CreateOpportunitiesResult = {
	/** Single current opportunity after applying discoveries (unchanged if none created). */
	activeOpportunity: AnnouncementOpportunity | null;
	/** Next opportunity sequence counter. */
	opportunityCounter: number;
	/** Structured create/suppress decisions for local diagnostics. */
	decisions: AnnouncementOpportunityDecision[];
};

function nextOpportunityId(creatureId: string, counter: number): string {
	return `ann-${creatureId}-${counter}`;
}

/**
 * Try to create at most one active opportunity from newly perceived features
 * in deterministic feature-ID order.
 *
 * Decision order per discovery:
 * 1. same feature is already the active opportunity → already_active
 * 2. retained resource_announcement memory for the feature → skip
 * 3. same continuous perception episode already handled → skip
 * 4. active slot already filled (this pass or prior) → announcement_busy /
 *    not_selected_same_perception_pass
 * 5. else create the single active opportunity
 *
 * Does not retain additional discoveries as future tasks.
 */
export function createOpportunitiesFromDiscoveries(input: {
	creatureId: string;
	creaturePosition: Vec2;
	newlyPerceived: readonly NewlyPerceivedResource[];
	activeOpportunity: AnnouncementOpportunity | null;
	opportunityCounter: number;
	/** Creature memory consulted for announcement recall (not mutated here). */
	memory: CreatureMemory;
}): CreateOpportunitiesResult {
	const { creatureId, creaturePosition, memory } = input;
	let counter = input.opportunityCounter;
	let active = input.activeOpportunity;
	const decisions: AnnouncementOpportunityDecision[] = [];

	const sorted = [...input.newlyPerceived].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);

	/** True once this pass has selected or already holds an active opportunity. */
	let slotFilled = active !== null;
	/** Feature/episode of the opportunity created this pass (for same_episode). */
	let createdEpisodeId: string | null = active?.perceptionEpisodeId ?? null;

	for (const discovery of sorted) {
		if (active && active.triggerFeatureId === discovery.featureId) {
			decisions.push({
				timeSeconds: discovery.discoveredAt,
				featureId: discovery.featureId,
				resourceKind: discovery.resourceKind,
				perceptionEpisodeId: discovery.perceptionEpisodeId,
				reason: 'already_active',
				opportunityId: active.id
			});
			continue;
		}

		if (hasResourceAnnouncementMemory(memory, discovery.featureId)) {
			decisions.push({
				timeSeconds: discovery.discoveredAt,
				featureId: discovery.featureId,
				resourceKind: discovery.resourceKind,
				perceptionEpisodeId: discovery.perceptionEpisodeId,
				reason: 'announcement_remembered',
				opportunityId: null
			});
			continue;
		}

		if (createdEpisodeId !== null && discovery.perceptionEpisodeId === createdEpisodeId) {
			decisions.push({
				timeSeconds: discovery.discoveredAt,
				featureId: discovery.featureId,
				resourceKind: discovery.resourceKind,
				perceptionEpisodeId: discovery.perceptionEpisodeId,
				reason: 'same_episode',
				opportunityId: null
			});
			continue;
		}

		if (slotFilled) {
			// Distinguish: prior active work vs same-pass multi-discovery not chosen.
			const reason =
				input.activeOpportunity !== null && active === input.activeOpportunity
					? 'announcement_busy'
					: 'not_selected_same_perception_pass';
			decisions.push({
				timeSeconds: discovery.discoveredAt,
				featureId: discovery.featureId,
				resourceKind: discovery.resourceKind,
				perceptionEpisodeId: discovery.perceptionEpisodeId,
				reason,
				opportunityId: null
			});
			continue;
		}

		const id = nextOpportunityId(creatureId, counter);
		counter += 1;

		active = {
			id,
			creatureId,
			triggerFeatureId: discovery.featureId,
			resourceKind: discovery.resourceKind,
			triggerFeaturePosition: {
				x: discovery.position.x,
				y: discovery.position.y
			},
			perceptionEpisodeId: discovery.perceptionEpisodeId,
			discoveredAt: discovery.discoveredAt,
			discoveryCreaturePosition: {
				x: creaturePosition.x,
				y: creaturePosition.y
			},
			state: 'ready',
			speakingTarget: null,
			initialClarity: null
		};
		slotFilled = true;
		createdEpisodeId = discovery.perceptionEpisodeId;
		decisions.push({
			timeSeconds: discovery.discoveredAt,
			featureId: discovery.featureId,
			resourceKind: discovery.resourceKind,
			perceptionEpisodeId: discovery.perceptionEpisodeId,
			reason: 'created',
			opportunityId: id
		});
	}

	return {
		activeOpportunity: active,
		opportunityCounter: counter,
		decisions
	};
}

export function getActiveOpportunity(
	active: AnnouncementOpportunity | null | undefined
): AnnouncementOpportunity | null {
	return active ?? null;
}

export function buildOutcome(input: {
	opportunity: AnnouncementOpportunity;
	completedAt: number;
	reason: AnnouncementOutcomeReason;
	finalClarity: ClarityEvidence | null;
	repositioningRequired: boolean;
	finalEmitterPosition: Vec2 | null;
	emittedSignalId: string | null;
	emittedSymbolId: SymbolId | null;
	productionMode: SymbolSelectionMode | null;
}): AnnouncementOpportunityOutcome {
	const { opportunity } = input;
	return {
		opportunityId: opportunity.id,
		creatureId: opportunity.creatureId,
		triggerFeatureId: opportunity.triggerFeatureId,
		resourceKind: opportunity.resourceKind,
		perceptionEpisodeId: opportunity.perceptionEpisodeId,
		discoveredAt: opportunity.discoveredAt,
		discoveryCreaturePosition: { ...opportunity.discoveryCreaturePosition },
		triggerFeaturePosition: { ...opportunity.triggerFeaturePosition },
		initialClarity: opportunity.initialClarity,
		finalClarity: input.finalClarity,
		repositioningRequired: input.repositioningRequired,
		speakingTarget: opportunity.speakingTarget ? { ...opportunity.speakingTarget } : null,
		finalEmitterPosition: input.finalEmitterPosition ? { ...input.finalEmitterPosition } : null,
		emittedSignalId: input.emittedSignalId,
		emittedSymbolId: input.emittedSymbolId,
		productionMode: input.productionMode,
		completedAt: input.completedAt,
		reason: input.reason
	};
}

export function appendOutcome(
	history: readonly AnnouncementOpportunityOutcome[],
	outcome: AnnouncementOpportunityOutcome,
	limit: number
): AnnouncementOpportunityOutcome[] {
	const next = [...history, outcome];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

export function appendOpportunityDecisions(
	history: readonly AnnouncementOpportunityDecision[] | null | undefined,
	decisions: readonly AnnouncementOpportunityDecision[],
	limit: number
): AnnouncementOpportunityDecision[] {
	const base = Array.isArray(history) ? history : [];
	if (decisions.length === 0) {
		return base as AnnouncementOpportunityDecision[];
	}
	const next = [...base, ...decisions];
	const safeLimit = Number.isInteger(limit) && limit >= 1 ? limit : next.length;
	if (next.length <= safeLimit) {
		return next;
	}
	return next.slice(next.length - safeLimit);
}

/** Clear all opportunity state (reset / regeneration). */
export function emptyAnnouncementState(): {
	activeAnnouncementOpportunity: AnnouncementOpportunity | null;
	announcementOpportunityCounter: number;
	recentAnnouncementOutcomes: AnnouncementOpportunityOutcome[];
} {
	return {
		activeAnnouncementOpportunity: null,
		announcementOpportunityCounter: 0,
		recentAnnouncementOutcomes: []
	};
}
