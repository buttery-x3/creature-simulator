/**
 * Exploration map construction and pure cell geometry.
 *
 * Grid begins at habitat minimum bounds (-width/2, -height/2).
 * Non-divisible dimensions produce a clipped final column/row ending at max bound.
 */

import type { Vec2, WorldBounds } from '$lib/habitat';
import type { ExplorationMap, ExplorationState } from './types';

/** Default exploration cell size in simulation units. */
export const DEFAULT_EXPLORATION_CELL_SIZE = 2;

/**
 * Axis-aligned clipped cell footprint for a flat index.
 * Corners and centre are derived from this rectangle.
 */
export type CellRect = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
};

export function worldMin(bounds: WorldBounds): Vec2 {
	return { x: -bounds.width / 2, y: -bounds.height / 2 };
}

export function worldMax(bounds: WorldBounds): Vec2 {
	return { x: bounds.width / 2, y: bounds.height / 2 };
}

/**
 * Column/row counts for a world of given size and cell size.
 * Partial edge cells are included via ceil.
 */
export function explorationGridDimensions(
	bounds: WorldBounds,
	cellSize: number
): { columns: number; rows: number } {
	if (!(cellSize > 0) || !Number.isFinite(cellSize)) {
		throw new Error(`exploration cellSize must be > 0, received ${cellSize}`);
	}
	if (!(bounds.width > 0) || !(bounds.height > 0)) {
		throw new Error(
			`exploration world bounds must be positive, received ${bounds.width}×${bounds.height}`
		);
	}
	return {
		columns: Math.ceil(bounds.width / cellSize),
		rows: Math.ceil(bounds.height / cellSize)
	};
}

/** Total cell count for the map. */
export function explorationCellCount(map: Pick<ExplorationMap, 'columns' | 'rows'>): number {
	return map.columns * map.rows;
}

/**
 * Build an empty exploration map (all cells never fully sensed).
 * Allocates a fresh lastFullySensedAt array.
 */
export function createExplorationMap(bounds: WorldBounds, cellSize: number): ExplorationMap {
	const { columns, rows } = explorationGridDimensions(bounds, cellSize);
	const count = columns * rows;
	const lastFullySensedAt: (number | null)[] = new Array(count);
	for (let i = 0; i < count; i += 1) {
		lastFullySensedAt[i] = null;
	}
	return {
		cellSize,
		columns,
		rows,
		lastFullySensedAt
	};
}

/**
 * Fresh per-creature exploration state with no active navigation cell.
 * Each call allocates independent map arrays.
 */
export function createExplorationState(bounds: WorldBounds, cellSize: number): ExplorationState {
	return {
		map: createExplorationMap(bounds, cellSize),
		activeCellIndex: null
	};
}

/** Flat index → (column, row). */
export function cellCoords(
	map: Pick<ExplorationMap, 'columns'>,
	index: number
): { column: number; row: number } {
	const column = index % map.columns;
	const row = Math.floor(index / map.columns);
	return { column, row };
}

/**
 * Clipped cell rectangle for a flat index inside habitat bounds.
 * Final column/row end exactly at the habitat maximum.
 */
export function cellRect(bounds: WorldBounds, map: ExplorationMap, index: number): CellRect {
	const count = explorationCellCount(map);
	if (!Number.isInteger(index) || index < 0 || index >= count) {
		throw new Error(
			`exploration cell index ${index} out of range [0, ${count}) for ${map.columns}×${map.rows}`
		);
	}
	const { column, row } = cellCoords(map, index);
	const origin = worldMin(bounds);
	const max = worldMax(bounds);
	const minX = origin.x + column * map.cellSize;
	const minY = origin.y + row * map.cellSize;
	const maxX = Math.min(origin.x + (column + 1) * map.cellSize, max.x);
	const maxY = Math.min(origin.y + (row + 1) * map.cellSize, max.y);
	return { minX, maxX, minY, maxY };
}

/** Geometric centre of the (possibly clipped) cell. */
export function cellCentre(bounds: WorldBounds, map: ExplorationMap, index: number): Vec2 {
	const rect = cellRect(bounds, map, index);
	return {
		x: (rect.minX + rect.maxX) / 2,
		y: (rect.minY + rect.maxY) / 2
	};
}

/**
 * Actual four corners of the (possibly clipped) cell, used for full-sense tests.
 * Order is stable but not significant for the all-corners predicate.
 */
export function cellCorners(bounds: WorldBounds, map: ExplorationMap, index: number): Vec2[] {
	const rect = cellRect(bounds, map, index);
	return [
		{ x: rect.minX, y: rect.minY },
		{ x: rect.maxX, y: rect.minY },
		{ x: rect.minX, y: rect.maxY },
		{ x: rect.maxX, y: rect.maxY }
	];
}

/** Count of cells with a finite lastFullySensedAt timestamp. */
export function countExploredCells(map: ExplorationMap): number {
	let n = 0;
	for (const t of map.lastFullySensedAt) {
		if (t !== null && Number.isFinite(t)) {
			n += 1;
		}
	}
	return n;
}
