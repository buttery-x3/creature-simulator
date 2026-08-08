/**
 * Deterministic exploration target selection: distance + staleness, no RNG.
 *
 * Exact score ties resolve to the lowest flat cell index.
 */

import type { Vec2, WorldBounds } from '$lib/habitat';
import { cellCentre, explorationCellCount } from './create-exploration';
import type {
	ExplorationMap,
	ExplorationScoreBreakdown,
	ExplorationScoreConfig,
	ExplorationTargetSelection
} from './types';

function clamp01(value: number): number {
	if (value <= 0) return 0;
	if (value >= 1) return 1;
	return value;
}

function distance(a: Vec2, b: Vec2): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Distance desirability: nearer cells score higher (1 at creature, 0 at world diagonal).
 */
export function distanceFactor(
	creaturePosition: Vec2,
	cellCentrePos: Vec2,
	bounds: WorldBounds
): number {
	const worldDiagonal = Math.hypot(bounds.width, bounds.height);
	if (!(worldDiagonal > 0) || !Number.isFinite(worldDiagonal)) {
		return 0;
	}
	return 1 - clamp01(distance(creaturePosition, cellCentrePos) / worldDiagonal);
}

/**
 * Staleness desirability: never sensed → 1; just sensed → 0; asymptotes to 1 with age.
 */
export function stalenessFactor(
	lastFullySensedAt: number | null,
	currentTime: number,
	stalenessScaleSeconds: number
): number {
	if (lastFullySensedAt === null || !Number.isFinite(lastFullySensedAt)) {
		return 1;
	}
	const scale =
		stalenessScaleSeconds > 0 && Number.isFinite(stalenessScaleSeconds)
			? stalenessScaleSeconds
			: 1;
	const age = Math.max(0, currentTime - lastFullySensedAt);
	return age / (age + scale);
}

/**
 * Score a single cell and return a diagnostic breakdown.
 */
export function scoreExplorationCell(
	map: ExplorationMap,
	bounds: WorldBounds,
	index: number,
	creaturePosition: Vec2,
	currentTime: number,
	config: ExplorationScoreConfig
): ExplorationScoreBreakdown {
	const centre = cellCentre(bounds, map, index);
	const dFactor = distanceFactor(creaturePosition, centre, bounds);
	const sFactor = stalenessFactor(
		map.lastFullySensedAt[index] ?? null,
		currentTime,
		config.explorationStalenessScaleSeconds
	);
	const distanceContribution = config.explorationDistanceWeight * dFactor;
	const stalenessContribution = config.explorationStalenessWeight * sFactor;
	return {
		cellIndex: index,
		centre,
		distanceFactor: dFactor,
		stalenessFactor: sFactor,
		distanceContribution,
		stalenessContribution,
		score: distanceContribution + stalenessContribution
	};
}

/**
 * Select the single highest-scoring cell. Deterministic; no seed or decision index.
 * Ties break to lowest flat index (scan order is ascending index).
 */
export function selectExplorationTarget(
	map: ExplorationMap,
	bounds: WorldBounds,
	creaturePosition: Vec2,
	currentTime: number,
	config: ExplorationScoreConfig
): ExplorationTargetSelection {
	const count = explorationCellCount(map);
	if (count === 0) {
		throw new Error('exploration map has zero cells');
	}

	let best = scoreExplorationCell(map, bounds, 0, creaturePosition, currentTime, config);
	for (let i = 1; i < count; i += 1) {
		const candidate = scoreExplorationCell(map, bounds, i, creaturePosition, currentTime, config);
		// Strict greater only — equal scores keep the lower index already held.
		if (candidate.score > best.score) {
			best = candidate;
		}
	}

	return {
		cellIndex: best.cellIndex,
		centre: best.centre,
		breakdown: best
	};
}
