import { describe, expect, it } from 'vitest';
import type { WorldBounds } from '$lib/habitat';
import { cellCentre, cellCorners, createExplorationMap } from './create-exploration';
import { isCellFullySensed, updateExplorationFromSensing } from './update-exploration';

const BOUNDS: WorldBounds = { width: 20, height: 14 };

describe('updateExplorationFromSensing', () => {
	it('does not accumulate partial corner coverage', () => {
		const map = createExplorationMap(BOUNDS, 2);
		const corners = cellCorners(BOUNDS, map, 0);
		const c0 = corners[0]!;
		const c1 = corners[1]!;
		const c2 = corners[2]!;
		const c3 = corners[3]!;
		// Midpoint of three corners — fourth is farther for a tight radius.
		const pos = {
			x: (c0.x + c1.x + c2.x) / 3,
			y: (c0.y + c1.y + c2.y) / 3
		};
		const d0 = Math.hypot(pos.x - c0.x, pos.y - c0.y);
		const d1 = Math.hypot(pos.x - c1.x, pos.y - c1.y);
		const d2 = Math.hypot(pos.x - c2.x, pos.y - c2.y);
		const d3 = Math.hypot(pos.x - c3.x, pos.y - c3.y);
		const radiusThree = Math.max(d0, d1, d2) + 1e-6;
		expect(radiusThree).toBeLessThan(d3);

		const afterPartial = updateExplorationFromSensing(map, BOUNDS, pos, radiusThree, 10);
		expect(afterPartial.lastFullySensedAt[0]).toBeNull();
		expect(afterPartial).toBe(map); // no mutation / no clone when unchanged

		// Later sensing only the fourth corner still does not complete the cell.
		const onlyFourth = updateExplorationFromSensing(map, BOUNDS, c3, 0.01, 20);
		expect(onlyFourth.lastFullySensedAt[0]).toBeNull();
	});

	it('refreshes timestamp when all four corners are inside the same sensing pass', () => {
		const map = createExplorationMap(BOUNDS, 2);
		const centre = cellCentre(BOUNDS, map, 0);
		// Half-diagonal of 2×2 is √2 ≈ 1.41; radius 2 covers all corners from centre.
		expect(isCellFullySensed(BOUNDS, map, 0, centre, 2)).toBe(true);

		const next = updateExplorationFromSensing(map, BOUNDS, centre, 2, 5.25);
		expect(next).not.toBe(map);
		expect(next.lastFullySensedAt[0]).toBe(5.25);
		// Other cells farther away should remain null with radius 2.
		expect(next.lastFullySensedAt[69]).toBeNull();
	});

	it('refreshes a previously explored cell with a later timestamp', () => {
		let map = createExplorationMap(BOUNDS, 2);
		const centre = cellCentre(BOUNDS, map, 5);
		map = updateExplorationFromSensing(map, BOUNDS, centre, 2, 1);
		expect(map.lastFullySensedAt[5]).toBe(1);
		map = updateExplorationFromSensing(map, BOUNDS, centre, 2, 12);
		expect(map.lastFullySensedAt[5]).toBe(12);
	});

	it('returns same map reference when sensing covers no new cells', () => {
		const map = createExplorationMap(BOUNDS, 2);
		// Outside world far away
		const far = { x: 100, y: 100 };
		const next = updateExplorationFromSensing(map, BOUNDS, far, 0.1, 3);
		expect(next).toBe(map);
	});
});
