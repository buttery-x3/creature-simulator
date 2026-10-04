import * as THREE from 'three';
import type { Vec2, WorldBounds } from '$lib/habitat';
import { assessHabitatVisibility, frameHabitatPerspectiveCamera } from '../habitat-camera';

/** Optional observer camera tracking. Coordinates never feed back into simulation. */
export function frameViewportCamera(
	camera: THREE.PerspectiveCamera,
	bounds: WorldBounds,
	aspect: number,
	follow: Vec2 | null
) {
	if (!follow) return frameHabitatPerspectiveCamera(camera, bounds, aspect);
	frameHabitatPerspectiveCamera(
		camera,
		{ width: bounds.width * 0.45, height: bounds.height * 0.45 },
		aspect
	);
	camera.position.x += follow.x;
	camera.position.y += follow.y;
	camera.lookAt(follow.x, follow.y, 0);
	camera.updateMatrixWorld(true);
	return assessHabitatVisibility(camera, bounds);
}
