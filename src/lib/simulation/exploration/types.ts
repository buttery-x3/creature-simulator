/**
 * Per-creature spatial exploration state (not CreatureMemory).
 *
 * A cell is explored when lastFullySensedAt[index] is a finite timestamp;
 * null means never fully sensed. Cell geometry is derived from habitat bounds
 * + index — never stored per creature.
 */

import type { Vec2 } from '$lib/habitat';

/** Regular exploration grid over habitat bounds. */
export type ExplorationMap = {
	cellSize: number;
	columns: number;
	rows: number;
	/**
	 * Row-major flat array: index = row * columns + column.
	 * null = never fully sensed; finite = most recent full-sense simulation time.
	 */
	lastFullySensedAt: (number | null)[];
};

/** Serializable per-creature exploration substrate. */
export type ExplorationState = {
	map: ExplorationMap;
	/** Active navigation cell while intention is explore; null when not exploring. */
	activeCellIndex: number | null;
};

/** Weights and scale for deterministic exploration cell scoring. */
export type ExplorationScoreConfig = {
	explorationDistanceWeight: number;
	explorationStalenessWeight: number;
	explorationStalenessScaleSeconds: number;
};

/** Factor breakdown for diagnostics (not decision authority). */
export type ExplorationScoreBreakdown = {
	cellIndex: number;
	centre: Vec2;
	distanceFactor: number;
	stalenessFactor: number;
	distanceContribution: number;
	stalenessContribution: number;
	score: number;
};

/** Result of pure exploration target selection. */
export type ExplorationTargetSelection = {
	cellIndex: number;
	centre: Vec2;
	breakdown: ExplorationScoreBreakdown;
};
