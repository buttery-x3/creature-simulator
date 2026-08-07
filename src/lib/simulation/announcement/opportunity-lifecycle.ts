/**
 * Announcement opportunity creation, queueing, completion and invalidation.
 *
 * Pure state transitions — movement and emission handoff live in step-announcement.
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

export type CreateOpportunitiesConfig = {
	maxQueuedAnnouncementOpportunitiesPerCreature: number;
};

export type CreateOpportunitiesResult = {
	/** Full queue after applying new discoveries (active + queued). */
	opportunities: AnnouncementOpportunity[];
	/** Overflow outcomes for opportunities that could not be enqueued. */
	overflowOutcomes: AnnouncementOpportunityOutcome[];
	/** Next opportunity sequence counter. */
	opportunityCounter: number;
};

function nextOpportunityId(creatureId: string, counter: number): string {
	return `ann-${creatureId}-${counter}`;
}

/**
 * Create opportunities for newly perceived features in deterministic feature-ID order.
 * Skips features that already have an open opportunity for the same episode.
 * Does not collapse same-kind features.
 */
export function createOpportunitiesFromDiscoveries(input: {
	creatureId: string;
	creaturePosition: Vec2;
	newlyPerceived: readonly NewlyPerceivedResource[];
	existing: readonly AnnouncementOpportunity[];
	opportunityCounter: number;
	config: CreateOpportunitiesConfig;
}): CreateOpportunitiesResult {
	const { creatureId, creaturePosition, existing, config } = input;
	let counter = input.opportunityCounter;
	const opportunities = [...existing];
	const overflowOutcomes: AnnouncementOpportunityOutcome[] = [];

	const openEpisodeIds = new Set(existing.map((o) => o.perceptionEpisodeId));

	const sorted = [...input.newlyPerceived].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);

	const maxQueue = config.maxQueuedAnnouncementOpportunitiesPerCreature;

	for (const discovery of sorted) {
		// One opportunity per continuous perception episode (no duplicates).
		if (openEpisodeIds.has(discovery.perceptionEpisodeId)) {
			continue;
		}

		const id = nextOpportunityId(creatureId, counter);
		counter += 1;

		const hasActive = opportunities.some((o) => o.state === 'ready' || o.state === 'repositioning');
		const opportunity: AnnouncementOpportunity = {
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
			state: hasActive ? 'queued' : 'ready',
			speakingTarget: null,
			initialClarity: null
		};

		if (opportunities.length >= maxQueue) {
			overflowOutcomes.push(
				buildOutcome({
					opportunity,
					completedAt: discovery.discoveredAt,
					reason: 'queue_overflow',
					queuePosition: opportunities.length,
					finalClarity: null,
					repositioningRequired: false,
					finalEmitterPosition: null,
					emittedSignalId: null,
					emittedSymbolId: null,
					productionMode: null
				})
			);
			continue;
		}

		opportunities.push(opportunity);
		openEpisodeIds.add(discovery.perceptionEpisodeId);
	}

	return promoteQueuedHead(opportunities, counter, overflowOutcomes);
}

function promoteQueuedHead(
	opportunities: AnnouncementOpportunity[],
	opportunityCounter: number,
	overflowOutcomes: AnnouncementOpportunityOutcome[]
): CreateOpportunitiesResult {
	const hasActive = opportunities.some((o) => o.state === 'ready' || o.state === 'repositioning');
	if (!hasActive) {
		const headIndex = opportunities.findIndex((o) => o.state === 'queued');
		if (headIndex >= 0) {
			const head = opportunities[headIndex]!;
			opportunities[headIndex] = { ...head, state: 'ready' };
		}
	}
	return { opportunities, overflowOutcomes, opportunityCounter };
}

/**
 * After completing/invalidating the active opportunity, promote the next queued item.
 */
export function removeOpportunityAndPromote(
	opportunities: readonly AnnouncementOpportunity[],
	opportunityId: string
): AnnouncementOpportunity[] {
	const remaining = opportunities.filter((o) => o.id !== opportunityId);
	const hasActive = remaining.some((o) => o.state === 'ready' || o.state === 'repositioning');
	if (hasActive) {
		return remaining;
	}
	const headIndex = remaining.findIndex((o) => o.state === 'queued');
	if (headIndex < 0) {
		return remaining;
	}
	const next = [...remaining];
	next[headIndex] = { ...next[headIndex]!, state: 'ready' };
	return next;
}

export function getActiveOpportunity(
	opportunities: readonly AnnouncementOpportunity[]
): AnnouncementOpportunity | null {
	return opportunities.find((o) => o.state === 'ready' || o.state === 'repositioning') ?? null;
}

export function updateOpportunity(
	opportunities: readonly AnnouncementOpportunity[],
	updated: AnnouncementOpportunity
): AnnouncementOpportunity[] {
	return opportunities.map((o) => (o.id === updated.id ? updated : o));
}

export function buildOutcome(input: {
	opportunity: AnnouncementOpportunity;
	completedAt: number;
	reason: AnnouncementOutcomeReason;
	queuePosition: number | null;
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
		queuePosition: input.queuePosition,
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

/** Clear all opportunity state (reset / regeneration). */
export function emptyAnnouncementState(): {
	announcementOpportunities: AnnouncementOpportunity[];
	announcementOpportunityCounter: number;
	recentAnnouncementOutcomes: AnnouncementOpportunityOutcome[];
	activeAnnouncementCue: {
		opportunityId: string;
		triggerFeatureId: string;
		triggerFeaturePosition: Vec2;
		fadeStartedAt: number | null;
	} | null;
} {
	return {
		announcementOpportunities: [],
		announcementOpportunityCounter: 0,
		recentAnnouncementOutcomes: [],
		activeAnnouncementCue: null
	};
}
