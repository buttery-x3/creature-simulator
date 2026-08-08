/**
 * Sensing-driven exploration map updates.
 *
 * A cell is fully sensed only when all four actual corners lie inside or on
 * the creature's sensing circle in the same sensing pass. Partial coverage
 * is never accumulated across passes.
 */

import type { Vec2, WorldBounds } from '$lib/habitat';
import { cellCorners, explorationCellCount } from './create-exploration';
import type { ExplorationMap } from './types';

function distanceSquared(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

/**
 * True when every corner of the cell is within sensingRadius of position.
 */
export function isCellFullySensed(
	bounds: WorldBounds,
	map: ExplorationMap,
	index: number,
	position: Vec2,
	sensingRadius: number
): boolean {
	if (!(sensingRadius >= 0) || !Number.isFinite(sensingRadius)) {
		return false;
	}
	const radiusSq = sensingRadius * sensingRadius;
	const corners = cellCorners(bounds, map, index);
	for (const corner of corners) {
		if (distanceSquared(position, corner) > radiusSq) {
			return false;
		}
	}
	return true;
}

/**
 * Refresh lastFullySensedAt for every cell fully covered by this sensing pass.
 * Returns a new map when any timestamp changes; otherwise returns the same reference.
 *
 * Does not accumulate partial corner coverage. Call only when a real sensing
 * pass occurred (not on every fixed step).
 */
export function updateExplorationFromSensing(
	map: ExplorationMap,
	bounds: WorldBounds,
	position: Vec2,
	sensingRadius: number,
	timeSeconds: number
): ExplorationMap {
	const count = explorationCellCount(map);
	let nextTimestamps: (number | null)[] | null = null;

	for (let i = 0; i < count; i += 1) {
		if (!isCellFullySensed(bounds, map, i, position, sensingRadius)) {
			continue;
		}
		if (map.lastFullySensedAt[i] === timeSeconds) {
			continue;
		}
		if (nextTimestamps === null) {
			nextTimestamps = map.lastFullySensedAt.slice();
		}
		nextTimestamps[i] = timeSeconds;
	}

	if (nextTimestamps === null) {
		return map;
	}
	return {
		...map,
		lastFullySensedAt: nextTimestamps
	};
}
