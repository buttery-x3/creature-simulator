/**
 * Deterministic speaking-position search for unclear resource announcements.
 *
 * Searches candidate points near same-kind resources (not required to stand on them)
 * within world interior bounds. Prefers the nearest valid point (to the creature)
 * that makes the announced kind clear at the configured margin.
 *
 * Search method:
 * 1. For each same-kind resource in scope, sample a polar grid of candidates
 *    around the feature centre (resolution rings × angular steps).
 * 2. Also consider the creature's current position (may already be clear).
 * 3. Reject points outside interior bounds or with non-finite coordinates.
 * 4. Keep candidates where evaluateKindClarity is clear.
 * 5. Choose minimum distance² from creature position; tie-break by x then y.
 */

import type { Habitat, Vec2 } from '$lib/habitat';
import { clampToInterior, distanceSquared } from '../creature-movement';
import { evaluateKindClarity, type ClarityResourceCandidate } from './clarity';

export type SpeakingPositionConfig = {
	clarityMargin: number;
	/** Max distance from a same-kind feature centre to place candidates. */
	searchRadius: number;
	/**
	 * Grid density: number of radial rings (excluding centre) and angular steps.
	 * Total candidates per feature ≈ 1 + rings * angularSteps.
	 */
	searchResolution: number;
	creatureRadius: number;
};

export type FindSpeakingPositionInput = {
	creaturePosition: Vec2;
	announcedKind: 'food' | 'water';
	/** Resources in clarity scope (must include opposite kinds for evaluation). */
	candidates: readonly ClarityResourceCandidate[];
	habitat: Habitat;
	config: SpeakingPositionConfig;
};

export type SpeakingPositionResult =
	| { ok: true; position: Vec2 }
	| { ok: false; reason: 'no_valid_speaking_position' | 'no_announced_kind_available' };

function sampleAroundFeature(centre: Vec2, radius: number, resolution: number): Vec2[] {
	const points: Vec2[] = [{ x: centre.x, y: centre.y }];
	const rings = Math.max(1, Math.floor(resolution));
	const angularSteps = Math.max(4, Math.floor(resolution) * 2);
	for (let ring = 1; ring <= rings; ring += 1) {
		const r = (radius * ring) / rings;
		for (let step = 0; step < angularSteps; step += 1) {
			const angle = (Math.PI * 2 * step) / angularSteps;
			points.push({
				x: centre.x + Math.cos(angle) * r,
				y: centre.y + Math.sin(angle) * r
			});
		}
	}
	return points;
}

/**
 * Find the nearest valid speaking position that establishes kind-level clarity.
 */
export function findSpeakingPosition(input: FindSpeakingPositionInput): SpeakingPositionResult {
	const { creaturePosition, announcedKind, candidates, habitat, config } = input;
	const sameKind = candidates.filter((c) => c.resourceKind === announcedKind);
	if (sameKind.length === 0) {
		return { ok: false, reason: 'no_announced_kind_available' };
	}

	const radius =
		Number.isFinite(config.searchRadius) && config.searchRadius > 0 ? config.searchRadius : 0;
	const resolution =
		Number.isFinite(config.searchResolution) && config.searchResolution >= 1
			? config.searchResolution
			: 1;

	const rawPoints: Vec2[] = [{ x: creaturePosition.x, y: creaturePosition.y }];
	// Deterministic feature order
	const ordered = [...sameKind].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);
	for (const feature of ordered) {
		rawPoints.push(...sampleAroundFeature(feature.position, radius, resolution));
	}

	let best: Vec2 | null = null;
	let bestDist = Number.POSITIVE_INFINITY;

	for (const raw of rawPoints) {
		if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
			continue;
		}
		const position = clampToInterior(raw, habitat.bounds, config.creatureRadius);
		const clarity = evaluateKindClarity({
			position,
			announcedKind,
			candidates,
			clarityMargin: config.clarityMargin
		});
		if (!clarity.clear) {
			continue;
		}
		const dist = distanceSquared(creaturePosition, position);
		if (
			dist < bestDist ||
			(dist === bestDist &&
				best !== null &&
				(position.x < best.x || (position.x === best.x && position.y < best.y))) ||
			(dist === bestDist && best === null)
		) {
			best = position;
			bestDist = dist;
		}
	}

	if (!best) {
		return { ok: false, reason: 'no_valid_speaking_position' };
	}
	return { ok: true, position: best };
}
