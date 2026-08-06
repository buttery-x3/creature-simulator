import { describe, expect, it } from 'vitest';
import {
	expandRect,
	featureRect,
	featuresViolateSpacing,
	rectInsideBounds,
	rectsOverlap
} from './geometry';

describe('geometry', () => {
	it('builds a centred feature rect', () => {
		expect(
			featureRect({
				position: { x: 0, y: 0 },
				size: { width: 4, height: 2 }
			})
		).toEqual({ minX: -2, minY: -1, maxX: 2, maxY: 1 });
	});

	it('detects overlap and separation', () => {
		const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
		const b = { minX: 1, minY: 1, maxX: 3, maxY: 3 };
		const c = { minX: 3, minY: 0, maxX: 4, maxY: 1 };
		expect(rectsOverlap(a, b)).toBe(true);
		expect(rectsOverlap(a, c)).toBe(false);
	});

	it('checks bounds containment', () => {
		const bounds = { width: 10, height: 10 };
		expect(rectInsideBounds({ minX: -4, minY: -4, maxX: 4, maxY: 4 }, bounds)).toBe(true);
		expect(rectInsideBounds({ minX: -6, minY: -1, maxX: 0, maxY: 1 }, bounds)).toBe(false);
	});

	it('expands rects for spacing checks', () => {
		const base = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
		expect(expandRect(base, 0.5)).toEqual({ minX: -0.5, minY: -0.5, maxX: 1.5, maxY: 1.5 });
	});

	it('flags features closer than minSpacing', () => {
		const left = {
			position: { x: 0, y: 0 },
			size: { width: 2, height: 2 }
		};
		const right = {
			position: { x: 2.4, y: 0 },
			size: { width: 2, height: 2 }
		};
		// Edge gap is 0.4; minSpacing 0.5 should violate.
		expect(featuresViolateSpacing(left, right, 0.5)).toBe(true);
		expect(featuresViolateSpacing(left, right, 0.3)).toBe(false);
	});
});
