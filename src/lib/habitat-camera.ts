import * as THREE from 'three';
import type { WorldBounds } from '$lib/habitat';

/**
 * Presentation camera framing for the bounded habitat.
 *
 * Simulation ground remains XY; presentation height is +Z (future creature
 * capsules stand along Z). The default view is nearly top-down (~80° elevation
 * from the ground plane) with a slight single-axis tilt and no side yaw, so
 * upright volumes read as 3D while the layout stays map-like.
 */

export type HabitatCameraOptions = {
	/** Vertical field of view in degrees. */
	fovDegrees?: number;
	/**
	 * Unit-ish offset from the look-at target toward the camera before
	 * normalisation. Z is elevation above the ground plane.
	 */
	offset?: THREE.Vector3;
	/** NDC inset required on each side (0–0.45). */
	ndcMargin?: number;
	/** Extra world height above the ground included when fitting. */
	presentationHeight?: number;
	/** Multiplier applied after the minimum fit distance. */
	fitPadding?: number;
};

/** Elevation from the ground plane in degrees (90 = pure top-down). */
export const HABITAT_CAMERA_ELEVATION_DEGREES = 80;

export type ProjectedCorner = {
	/** Ground-plane corner label. */
	id: string;
	/** Normalised device coordinates after projection. */
	ndc: { x: number; y: number; z: number };
	/** True when inside the frustum with the configured margin. */
	visible: boolean;
};

export type HabitatVisibilityReport = {
	fullyVisible: boolean;
	corners: ProjectedCorner[];
};

/**
 * Nearly top-down: 80° above the ground, tilted only along -Y (no X/side offset).
 * horizontal = cos(80°) ≈ 0.174, vertical = sin(80°) ≈ 0.985
 */
function defaultNearTopDownOffset(): THREE.Vector3 {
	const elevation = (HABITAT_CAMERA_ELEVATION_DEGREES * Math.PI) / 180;
	return new THREE.Vector3(0, -Math.cos(elevation), Math.sin(elevation));
}

const DEFAULT_FOV = 40;
const DEFAULT_NDC_MARGIN = 0.06;
const DEFAULT_PRESENTATION_HEIGHT = 2.4;
const DEFAULT_FIT_PADDING = 1.04;

export function habitatGroundCorners(
	bounds: WorldBounds,
	presentationHeight: number
): Array<{ id: string; point: THREE.Vector3 }> {
	const halfW = bounds.width / 2;
	const halfH = bounds.height / 2;
	const base = [
		{ id: 'sw', x: -halfW, y: -halfH },
		{ id: 'se', x: halfW, y: -halfH },
		{ id: 'nw', x: -halfW, y: halfH },
		{ id: 'ne', x: halfW, y: halfH }
	] as const;

	const points: Array<{ id: string; point: THREE.Vector3 }> = [];
	for (const corner of base) {
		points.push({
			id: `${corner.id}-ground`,
			point: new THREE.Vector3(corner.x, corner.y, 0)
		});
		points.push({
			id: `${corner.id}-top`,
			point: new THREE.Vector3(corner.x, corner.y, presentationHeight)
		});
	}
	return points;
}

export function projectWorldToNdc(
	camera: THREE.PerspectiveCamera,
	worldPoint: THREE.Vector3
): { x: number; y: number; z: number } {
	const projected = worldPoint.clone().project(camera);
	return { x: projected.x, y: projected.y, z: projected.z };
}

export function isNdcVisible(ndc: { x: number; y: number; z: number }, margin: number): boolean {
	return (
		ndc.x >= -1 + margin &&
		ndc.x <= 1 - margin &&
		ndc.y >= -1 + margin &&
		ndc.y <= 1 - margin &&
		ndc.z >= -1 &&
		ndc.z <= 1
	);
}

export function assessHabitatVisibility(
	camera: THREE.PerspectiveCamera,
	bounds: WorldBounds,
	options: Pick<HabitatCameraOptions, 'ndcMargin' | 'presentationHeight'> = {}
): HabitatVisibilityReport {
	const margin = options.ndcMargin ?? DEFAULT_NDC_MARGIN;
	const presentationHeight = options.presentationHeight ?? DEFAULT_PRESENTATION_HEIGHT;
	const corners = habitatGroundCorners(bounds, presentationHeight).map(({ id, point }) => {
		const ndc = projectWorldToNdc(camera, point);
		return {
			id,
			ndc,
			visible: isNdcVisible(ndc, margin)
		};
	});

	return {
		fullyVisible: corners.every((corner) => corner.visible),
		corners
	};
}

/**
 * Place a perspective camera on a near-top-down tilt and pull it back far
 * enough that every habitat corner (ground + presentation height) fits in the
 * viewport with the configured NDC margin.
 */
export function frameHabitatPerspectiveCamera(
	camera: THREE.PerspectiveCamera,
	bounds: WorldBounds,
	aspect: number,
	options: HabitatCameraOptions = {}
): HabitatVisibilityReport {
	if (!(aspect > 0) || !Number.isFinite(aspect)) {
		throw new Error(`aspect must be a positive finite number, received ${aspect}`);
	}
	if (!(bounds.width > 0) || !(bounds.height > 0)) {
		throw new Error(`habitat bounds must be positive, received ${bounds.width}×${bounds.height}`);
	}

	const fovDegrees = options.fovDegrees ?? DEFAULT_FOV;
	const ndcMargin = options.ndcMargin ?? DEFAULT_NDC_MARGIN;
	const presentationHeight = options.presentationHeight ?? DEFAULT_PRESENTATION_HEIGHT;
	const fitPadding = options.fitPadding ?? DEFAULT_FIT_PADDING;
	const offset = (options.offset ?? defaultNearTopDownOffset()).clone().normalize();

	const target = new THREE.Vector3(0, 0, 0);
	// Screen-up follows ground +Y so a near-top-down look stays stable
	// (camera look direction is nearly -Z; world +Z cannot be used as up).
	const up = new THREE.Vector3(0, 1, 0);

	camera.fov = fovDegrees;
	camera.aspect = aspect;
	camera.near = 0.1;
	camera.far = 500;
	camera.up.copy(up);

	const corners = habitatGroundCorners(bounds, presentationHeight).map((c) => c.point);

	// Binary-search the smallest distance that keeps every fit point visible.
	let lo = 1;
	let hi = Math.max(bounds.width, bounds.height) * 8;
	let best = hi;

	for (let i = 0; i < 28; i += 1) {
		const mid = (lo + hi) / 2;
		camera.position.copy(offset).multiplyScalar(mid).add(target);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);

		const visible = corners.every((point) =>
			isNdcVisible(projectWorldToNdc(camera, point), ndcMargin)
		);

		if (visible) {
			best = mid;
			hi = mid;
		} else {
			lo = mid;
		}
	}

	camera.position
		.copy(offset)
		.multiplyScalar(best * fitPadding)
		.add(target);
	camera.lookAt(target);
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld(true);

	return assessHabitatVisibility(camera, bounds, { ndcMargin, presentationHeight });
}
