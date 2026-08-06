import { describe, expect, it } from 'vitest';
import { orthographicFrustum } from './orthographic-frustum';

describe('orthographicFrustum', () => {
	it('matches a square viewport', () => {
		expect(orthographicFrustum(1, 2)).toEqual({
			left: -1,
			right: 1,
			top: 1,
			bottom: -1
		});
	});

	it('widens the frustum for landscape aspect ratios', () => {
		expect(orthographicFrustum(2, 1)).toEqual({
			left: -1,
			right: 1,
			top: 0.5,
			bottom: -0.5
		});
	});

	it('rejects non-positive aspect ratios', () => {
		expect(() => orthographicFrustum(0)).toThrow(/aspect/);
	});
});
