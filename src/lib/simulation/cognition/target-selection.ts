/**
 * Pure target selection for cognition candidates (FLAME-79).
 *
 * Resource order: currently perceived usable → newest usable memory → none
 * (search_fallback). Feature targets when featureId is known; signal origins
 * use point targets.
 */

import type { Vec2 } from '$lib/habitat';
import {
	findNewestUsableResourceObservation,
	hasResourceAnnouncementMemory,
	listHeardSignalMemories
} from '../memory/query';
import type { CreatureMemory, HeardSignalMemory } from '../memory/types';
import type { CreatureTarget } from '../types';
import type { CandidateReasonCode, PerceivedResource } from './types';

function distanceSquared(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

/** Nearest perceived resource; ties broken by featureId ascending. */
export function selectNearestPerceivedResource(
	position: Vec2,
	resources: readonly PerceivedResource[]
): PerceivedResource | null {
	if (resources.length === 0) {
		return null;
	}
	let best = resources[0]!;
	let bestDist = distanceSquared(position, best.position);
	for (let i = 1; i < resources.length; i += 1) {
		const candidate = resources[i]!;
		const dist = distanceSquared(position, candidate.position);
		if (dist < bestDist || (dist === bestDist && candidate.featureId < best.featureId)) {
			best = candidate;
			bestDist = dist;
		}
	}
	return best;
}

export type ResourceTargetResult = {
	target: CreatureTarget | null;
	featureId: string | null;
	source: 'visible' | 'remembered' | 'none';
	reasonCodes: CandidateReasonCode[];
};

/**
 * Hunger/thirst target: perception first, then newest usable memory, else null.
 * Preferred open decision: feature target when featureId is known; null +
 * search_fallback when no useful knowledge (executor samples search).
 */
export function selectResourceNeedTarget(
	position: Vec2,
	perceived: readonly PerceivedResource[],
	memory: CreatureMemory,
	resourceKind: 'food' | 'water'
): ResourceTargetResult {
	const visible = selectNearestPerceivedResource(position, perceived);
	if (visible) {
		return {
			target: {
				kind: 'feature',
				featureId: visible.featureId,
				featureKind: resourceKind
			},
			featureId: visible.featureId,
			source: 'visible',
			reasonCodes: ['visible_resource']
		};
	}

	const remembered = findNewestUsableResourceObservation(memory, resourceKind);
	if (remembered) {
		return {
			target: {
				kind: 'feature',
				featureId: remembered.featureId,
				featureKind: resourceKind
			},
			featureId: remembered.featureId,
			source: 'remembered',
			reasonCodes: ['remembered_resource']
		};
	}

	return {
		target: null,
		featureId: null,
		source: 'none',
		reasonCodes: ['search_fallback']
	};
}

export type SignalTargetResult = {
	target: CreatureTarget | null;
	memory: HeardSignalMemory | null;
	/** 0…1 recency factor from sequence vs memory stream. */
	recencyFactor: number;
};

/**
 * Newest heard_signal memory by sequence. Point target at stored origin.
 * Lexicon / symbol meaning are intentionally ignored.
 */
export function selectSignalInvestigationTarget(memory: CreatureMemory): SignalTargetResult {
	const signals = listHeardSignalMemories(memory);
	const newest = signals[0] ?? null;
	if (!newest) {
		return { target: null, memory: null, recencyFactor: 0 };
	}
	const denom = Math.max(1, memory.nextSequence - 1);
	const recencyFactor = Math.min(1, Math.max(0, newest.sequence / denom));
	return {
		target: {
			kind: 'point',
			position: { x: newest.origin.x, y: newest.origin.y }
		},
		memory: newest,
		recencyFactor
	};
}

export type AnnounceTargetResult = {
	target: CreatureTarget | null;
	featureId: string | null;
	resourceKind: 'food' | 'water' | null;
};

/**
 * Currently perceived available resource not suppressed by announcement memory.
 * Deterministic pick: featureId ascending (no opportunity queue).
 */
export function selectAnnounceTarget(
	availableFood: readonly PerceivedResource[],
	availableWater: readonly PerceivedResource[],
	memory: CreatureMemory
): AnnounceTargetResult {
	const candidates: PerceivedResource[] = [];
	for (const food of availableFood) {
		if (!hasResourceAnnouncementMemory(memory, food.featureId)) {
			candidates.push(food);
		}
	}
	for (const water of availableWater) {
		if (!hasResourceAnnouncementMemory(memory, water.featureId)) {
			candidates.push(water);
		}
	}
	if (candidates.length === 0) {
		return { target: null, featureId: null, resourceKind: null };
	}
	candidates.sort((a, b) => {
		if (a.featureId < b.featureId) return -1;
		if (a.featureId > b.featureId) return 1;
		return 0;
	});
	const chosen = candidates[0]!;
	return {
		target: {
			kind: 'feature',
			featureId: chosen.featureId,
			featureKind: chosen.resourceKind
		},
		featureId: chosen.featureId,
		resourceKind: chosen.resourceKind
	};
}

export function homeTarget(homeFeatureId: string): CreatureTarget {
	return {
		kind: 'feature',
		featureId: homeFeatureId,
		featureKind: 'home'
	};
}
