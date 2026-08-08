import { describe, expect, it } from 'vitest';
import type { WorldBounds } from '$lib/habitat';
import {
	cellCentre,
	cellCorners,
	cellRect,
	countExploredCells,
	createExplorationMap,
	createExplorationState,
	explorationCellCount,
	explorationGridDimensions
} from './create-exploration';

const DEFAULT_BOUNDS: WorldBounds = { width: 20, height: 14 };

describe('exploration grid geometry', () => {
	it('default 20×14 habitat with cell size 2 → 10×7 / 70 cells', () => {
		const dims = explorationGridDimensions(DEFAULT_BOUNDS, 2);
		expect(dims).toEqual({ columns: 10, rows: 7 });
		const map = createExplorationMap(DEFAULT_BOUNDS, 2);
		expect(map.columns).toBe(10);
		expect(map.rows).toBe(7);
		expect(explorationCellCount(map)).toBe(70);
		expect(map.lastFullySensedAt).toHaveLength(70);
		expect(map.lastFullySensedAt.every((t) => t === null)).toBe(true);
	});

	it('clips final column/row exactly to habitat bounds for non-divisible sizes', () => {
		// 5 × 3 with cell size 2 → ceil(5/2)=3 cols, ceil(3/2)=2 rows
		const bounds: WorldBounds = { width: 5, height: 3 };
		const map = createExplorationMap(bounds, 2);
		expect(map.columns).toBe(3);
		expect(map.rows).toBe(2);

		// Full interior cell (0,0): [-2.5, -0.5] × [-1.5, 0.5]
		const full = cellRect(bounds, map, 0);
		expect(full).toEqual({ minX: -2.5, maxX: -0.5, minY: -1.5, maxY: 0.5 });
		expect(cellCentre(bounds, map, 0)).toEqual({ x: -1.5, y: -0.5 });

		// Last column of first row (index 2): clipped maxX to 2.5
		const edgeCol = cellRect(bounds, map, 2);
		expect(edgeCol.minX).toBeCloseTo(1.5, 10);
		expect(edgeCol.maxX).toBeCloseTo(2.5, 10);
		expect(edgeCol.minY).toBeCloseTo(-1.5, 10);
		expect(edgeCol.maxY).toBeCloseTo(0.5, 10);
		expect(cellCentre(bounds, map, 2).x).toBeCloseTo(2, 10);

		// Last row first column (index 3): clipped maxY to 1.5
		const edgeRow = cellRect(bounds, map, 3);
		expect(edgeRow.minY).toBeCloseTo(0.5, 10);
		expect(edgeRow.maxY).toBeCloseTo(1.5, 10);

		// Corner cell (index 5 = row1 col2): both clipped
		const corner = cellRect(bounds, map, 5);
		expect(corner.minX).toBeCloseTo(1.5, 10);
		expect(corner.maxX).toBeCloseTo(2.5, 10);
		expect(corner.minY).toBeCloseTo(0.5, 10);
		expect(corner.maxY).toBeCloseTo(1.5, 10);
		const corners = cellCorners(bounds, map, 5);
		expect(corners).toHaveLength(4);
		expect(corners[0]).toEqual({ x: corner.minX, y: corner.minY });
		expect(corners[3]).toEqual({ x: corner.maxX, y: corner.maxY });
	});

	it('creates independent exploration arrays per creature state', () => {
		const a = createExplorationState(DEFAULT_BOUNDS, 2);
		const b = createExplorationState(DEFAULT_BOUNDS, 2);
		expect(a.map.lastFullySensedAt).not.toBe(b.map.lastFullySensedAt);
		a.map.lastFullySensedAt[0] = 1.5;
		expect(b.map.lastFullySensedAt[0]).toBeNull();
		expect(a.activeCellIndex).toBeNull();
		expect(countExploredCells(a.map)).toBe(1);
		expect(countExploredCells(b.map)).toBe(0);
	});
});
