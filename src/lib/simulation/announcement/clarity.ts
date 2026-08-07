/**
 * Kind-level emitter-side clarity for resource announcements.
 *
 * Same-kind features never compete. Clarity compares the nearest resource of the
 * announced kind against the nearest opposite kind within the provided candidate set.
 *
 * Scope: callers supply candidate resource observations (documented in architecture —
 * perception snapshot plus habitat query within speaking-search radius when preparing).
 *
 * Rule:
 *   clear ⇔ no opposite in scope OR (d_opposite − d_announced ≥ clarityMargin)
 *
 * Ties and near-ties are unclear. Non-finite distances are rejected.
 */

import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../creature-movement';
import type { ClarityEvidence } from './types';

export type ClarityResourceCandidate = {
	featureId: string;
	resourceKind: 'food' | 'water';
	position: Vec2;
};

export type EvaluateKindClarityInput = {
	position: Vec2;
	announcedKind: 'food' | 'water';
	candidates: readonly ClarityResourceCandidate[];
	clarityMargin: number;
};

function oppositeKind(kind: 'food' | 'water'): 'food' | 'water' {
	return kind === 'food' ? 'water' : 'food';
}

/**
 * Nearest Euclidean distance among candidates of the given kind.
 * Returns null when none exist or all positions are invalid.
 */
export function nearestKindDistance(
	position: Vec2,
	candidates: readonly ClarityResourceCandidate[],
	kind: 'food' | 'water'
): number | null {
	if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
		return null;
	}
	let best: number | null = null;
	for (const candidate of candidates) {
		if (candidate.resourceKind !== kind) {
			continue;
		}
		if (!Number.isFinite(candidate.position.x) || !Number.isFinite(candidate.position.y)) {
			continue;
		}
		const dist = Math.sqrt(distanceSquared(position, candidate.position));
		if (!Number.isFinite(dist)) {
			continue;
		}
		if (best === null || dist < best) {
			best = dist;
		}
	}
	return best;
}

/**
 * Evaluate whether the announced resource kind is unambiguously nearest.
 */
export function evaluateKindClarity(input: EvaluateKindClarityInput): ClarityEvidence {
	const { position, announcedKind, candidates, clarityMargin } = input;
	const margin = Number.isFinite(clarityMargin) && clarityMargin >= 0 ? clarityMargin : Number.NaN;

	const announcedDistance = nearestKindDistance(position, candidates, announcedKind);
	const oppositeDistance = nearestKindDistance(position, candidates, oppositeKind(announcedKind));

	if (!Number.isFinite(margin)) {
		return {
			announcedKind,
			nearestAnnouncedKindDistance: announcedDistance,
			nearestOppositeKindDistance: oppositeDistance,
			clarityMargin: clarityMargin,
			clear: false,
			reason: 'invalid_clarity_margin'
		};
	}

	if (announcedDistance === null) {
		return {
			announcedKind,
			nearestAnnouncedKindDistance: null,
			nearestOppositeKindDistance: oppositeDistance,
			clarityMargin: margin,
			clear: false,
			reason: 'no_announced_kind_in_scope'
		};
	}

	if (oppositeDistance === null) {
		return {
			announcedKind,
			nearestAnnouncedKindDistance: announcedDistance,
			nearestOppositeKindDistance: null,
			clarityMargin: margin,
			clear: true,
			reason: 'clear_no_opposite'
		};
	}

	const delta = oppositeDistance - announcedDistance;
	if (!Number.isFinite(delta)) {
		return {
			announcedKind,
			nearestAnnouncedKindDistance: announcedDistance,
			nearestOppositeKindDistance: oppositeDistance,
			clarityMargin: margin,
			clear: false,
			reason: 'invalid_distance'
		};
	}

	if (delta >= margin) {
		return {
			announcedKind,
			nearestAnnouncedKindDistance: announcedDistance,
			nearestOppositeKindDistance: oppositeDistance,
			clarityMargin: margin,
			clear: true,
			reason: 'clear_margin'
		};
	}

	return {
		announcedKind,
		nearestAnnouncedKindDistance: announcedDistance,
		nearestOppositeKindDistance: oppositeDistance,
		clarityMargin: margin,
		clear: false,
		reason: delta <= 0 ? 'unclear_opposite_nearer_or_tie' : 'unclear_margin'
	};
}
