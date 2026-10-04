import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { frameViewportCamera } from './camera';

describe('observer camera framing', () => {
	it('centers the selected position when following, then restores the full overview', () => {
		const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
		const bounds = { width: 20, height: 14 };
		const position = { x: 8, y: -5 };
		frameViewportCamera(camera, bounds, 1.4, position);
		const projected = new THREE.Vector3(position.x, position.y, 0).project(camera);
		expect(projected.x).toBeCloseTo(0);
		expect(projected.y).toBeCloseTo(0);
		expect(position).toEqual({ x: 8, y: -5 });
		expect(frameViewportCamera(camera, bounds, 1.4, null).fullyVisible).toBe(true);
	});
});
