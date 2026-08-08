import { describe, expect, it } from 'vitest';
import type { WorldBounds } from '$lib/habitat';
import { cellCentre, createExplorationMap } from './create-exploration';
import {
	distanceFactor,
	scoreExplorationCell,
	selectExplorationTarget,
	stalenessFactor
} from './select-exploration-target';
import type { ExplorationScoreConfig } from './types';

const BOUNDS: WorldBounds = { width: 20, height: 14 };
const CONFIG: ExplorationScoreConfig = {
	explorationDistanceWeight: 1,
	explorationStalenessWeight: 1,
	explorationStalenessScaleSeconds: 30
};

describe('exploration scoring factors', () => {
	it('distance factor is monotonic: nearer scores at least as high as farther', () => {
		const origin = { x: 0, y: 0 };
		const near = { x: 1, y: 0 };
		const far = { x: 8, y: 0 };
		expect(distanceFactor(origin, near, BOUNDS)).toBeGreaterThan(
			distanceFactor(origin, far, BOUNDS)
		);
		expect(distanceFactor(origin, origin, BOUNDS)).toBe(1);
	});

	it('staleness: never sensed is 1; older scores higher than recent; just sensed is 0', () => {
		expect(stalenessFactor(null, 100, 30)).toBe(1);
		expect(stalenessFactor(100, 100, 30)).toBe(0);
		expect(stalenessFactor(70, 100, 30)).toBeCloseTo(30 / 60, 10); // age 30 → 0.5
		expect(stalenessFactor(40, 100, 30)).toBeGreaterThan(stalenessFactor(70, 100, 30));
	});
});

describe('selectExplorationTarget', () => {
	it('is deterministic for the same state', () => {
		const map = createExplorationMap(BOUNDS, 2);
		const pos = { x: -3, y: 2 };
		const a = selectExplorationTarget(map, BOUNDS, pos, 10, CONFIG);
		const b = selectExplorationTarget(map, BOUNDS, pos, 10, CONFIG);
		expect(a.cellIndex).toBe(b.cellIndex);
		expect(a.breakdown.score).toBe(b.breakdown.score);
		expect(a.centre).toEqual(b.centre);
	});

	it('exact score ties select the lowest flat index', () => {
		// All cells never sensed + equal weights: pick by distance only.
		// Place creature at world origin; many cells may differ by distance.
		// Force equal scores by zeroing distance weight and leaving all never-sensed.
		const map = createExplorationMap(BOUNDS, 2);
		const equalConfig: ExplorationScoreConfig = {
			...CONFIG,
			explorationDistanceWeight: 0,
			explorationStalenessWeight: 1
		};
		const result = selectExplorationTarget(map, BOUNDS, { x: 0, y: 0 }, 0, equalConfig);
		// All staleness = 1 → all scores equal → lowest index 0
		expect(result.cellIndex).toBe(0);
		expect(result.breakdown.stalenessFactor).toBe(1);
	});

	it('does not depend on seed or decision index (API has none)', () => {
		// Structural: selectExplorationTarget only takes map/bounds/position/time/config.
		const map = createExplorationMap(BOUNDS, 2);
		const result = selectExplorationTarget(map, BOUNDS, { x: 1, y: 1 }, 5, CONFIG);
		expect(typeof result.cellIndex).toBe('number');
		expect(result.centre).toEqual(cellCentre(BOUNDS, map, result.cellIndex));
	});

	it('selected cell produces its geometric centre as the point target', () => {
		const map = createExplorationMap(BOUNDS, 2);
		const result = selectExplorationTarget(map, BOUNDS, { x: -8, y: -5 }, 0, CONFIG);
		expect(result.centre).toEqual(cellCentre(BOUNDS, map, result.cellIndex));
		expect(result.breakdown.cellIndex).toBe(result.cellIndex);
	});

	it('prefers never-sensed nearby over recently sensed nearby when weights equal', () => {
		const map = createExplorationMap(BOUNDS, 2);
		const pos = cellCentre(BOUNDS, map, 0);
		// Mark cell 0 as just sensed — otherwise it would win by proximity + staleness.
		map.lastFullySensedAt[0] = 100;
		const result = selectExplorationTarget(map, BOUNDS, pos, 100, CONFIG);
		expect(result.cellIndex).not.toBe(0);
		const scored0 = scoreExplorationCell(map, BOUNDS, 0, pos, 100, CONFIG);
		const scoredPick = scoreExplorationCell(map, BOUNDS, result.cellIndex, pos, 100, CONFIG);
		expect(scoredPick.score).toBeGreaterThanOrEqual(scored0.score);
	});
});
