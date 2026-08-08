/**
 * Announcement execution helpers: outcome construction and empty-state defaults.
 *
 * Pure state helpers — movement and emission handoff live in step-announcement.
 * Does not own discovery, opportunity queues, or intention selection.
 */

import type { Vec2 } from '$lib/habitat';
import type {
	ActiveAnnouncementExecution,
	AnnouncementExecutionOutcome,
	AnnouncementOutcomeReason,
	ClarityEvidence
} from './types';

export function getActiveExecution(
	active: ActiveAnnouncementExecution | null | undefined
): ActiveAnnouncementExecution | null {
	return active ?? null;
}

export function buildOutcome(input: {
	execution: ActiveAnnouncementExecution;
	completedAt: number;
	reason: AnnouncementOutcomeReason;
	finalClarity: ClarityEvidence | null;
	repositioningRequired: boolean;
	finalEmitterPosition: Vec2 | null;
}): AnnouncementExecutionOutcome {
	const { execution } = input;
	return {
		executionId: execution.id,
		creatureId: execution.creatureId,
		triggerFeatureId: execution.triggerFeatureId,
		resourceKind: execution.resourceKind,
		triggerFeaturePosition: { ...execution.triggerFeaturePosition },
		initialClarity: execution.initialClarity,
		finalClarity: input.finalClarity,
		repositioningRequired: input.repositioningRequired,
		speakingTarget: execution.speakingTarget ? { ...execution.speakingTarget } : null,
		finalEmitterPosition: input.finalEmitterPosition ? { ...input.finalEmitterPosition } : null,
		completedAt: input.completedAt,
		reason: input.reason
	};
}

export function appendOutcome(
	history: readonly AnnouncementExecutionOutcome[],
	outcome: AnnouncementExecutionOutcome,
	limit: number
): AnnouncementExecutionOutcome[] {
	const next = [...history, outcome];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

/** Clear all announcement execution state (reset / regeneration). */
export function emptyAnnouncementState(): {
	activeAnnouncementExecution: ActiveAnnouncementExecution | null;
	announcementExecutionCounter: number;
	recentAnnouncementOutcomes: AnnouncementExecutionOutcome[];
} {
	return {
		activeAnnouncementExecution: null,
		announcementExecutionCounter: 0,
		recentAnnouncementOutcomes: []
	};
}
