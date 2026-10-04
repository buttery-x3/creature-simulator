import { featureRect, type HomeFeature, type Vec2 } from '$lib/habitat';

/** Home is a more restorative location, never a prerequisite for sleep. */
export const OUTDOOR_REST_RECOVERY = 0.75;

export function distanceToHome(
	position: Vec2,
	home: Pick<HomeFeature, 'position' | 'size'>
): number {
	const rect = featureRect(home);
	return Math.hypot(
		Math.max(rect.minX - position.x, 0, position.x - rect.maxX),
		Math.max(rect.minY - position.y, 0, position.y - rect.maxY)
	);
}

/** Location alone determines recovery; the arrival tolerance matches home navigation. */
export function restRecoveryMultiplier(
	position: Vec2,
	home: Pick<HomeFeature, 'position' | 'size'>,
	arrivalDistance = 0
): number {
	const rect = featureRect(home);
	const atHome =
		position.x >= rect.minX - arrivalDistance &&
		position.x <= rect.maxX + arrivalDistance &&
		position.y >= rect.minY - arrivalDistance &&
		position.y <= rect.maxY + arrivalDistance;
	return atHome ? 1 : OUTDOOR_REST_RECOVERY;
}
