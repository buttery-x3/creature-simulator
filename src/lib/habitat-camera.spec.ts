import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
	assessHabitatVisibility,
	frameHabitatPerspectiveCamera,
	habitatGroundCorners,
	isNdcVisible,
	projectWorldToNdc
} from './habitat-camera';

describe('habitat-camera', () => {
	it('places ground and elevated corners for the fit volume', () => {
		const corners = habitatGroundCorners({ width: 20, height: 14 }, 2);
		expect(corners).toHaveLength(8);
		expect(corners.some((c) => c.id === 'sw-ground' && c.point.z === 0)).toBe(true);
		expect(corners.some((c) => c.id === 'ne-top' && c.point.z === 2)).toBe(true);
	});

	it('frames the default habitat so every corner stays in the NDC margin', () => {
		const camera = new THREE.PerspectiveCamera();
		const report = frameHabitatPerspectiveCamera(camera, { width: 20, height: 14 }, 16 / 9);

		expect(report.fullyVisible).toBe(true);
		expect(report.corners.every((corner) => corner.visible)).toBe(true);
		// Elevated angle: camera must not sit on the top-down axis.
		expect(Math.abs(camera.position.z)).toBeGreaterThan(0);
		expect(Math.hypot(camera.position.x, camera.position.y)).toBeGreaterThan(0);
	});

	it('keeps the habitat fully visible across common desktop aspects', () => {
		const camera = new THREE.PerspectiveCamera();
		for (const aspect of [1, 4 / 3, 16 / 9, 21 / 9, 3 / 4]) {
			const report = frameHabitatPerspectiveCamera(camera, { width: 20, height: 14 }, aspect);
			expect(report.fullyVisible, `aspect ${aspect}`).toBe(true);
		}
	});

	it('reports partial visibility when the camera is too close', () => {
		const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
		camera.up.set(0, 0, 1);
		camera.position.set(0, -2, 2);
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);

		const report = assessHabitatVisibility(camera, { width: 20, height: 14 });
		expect(report.fullyVisible).toBe(false);
		expect(report.corners.some((corner) => !corner.visible)).toBe(true);
	});

	it('projects world points into NDC space', () => {
		const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
		camera.position.set(0, 0, 10);
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);

		const origin = projectWorldToNdc(camera, new THREE.Vector3(0, 0, 0));
		expect(origin.x).toBeCloseTo(0, 5);
		expect(origin.y).toBeCloseTo(0, 5);
		expect(isNdcVisible(origin, 0.05)).toBe(true);
	});
});
