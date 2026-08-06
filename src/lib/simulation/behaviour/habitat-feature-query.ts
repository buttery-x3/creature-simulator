/**
 * Named spatial query boundary for nearby habitat features.
 *
 * Perception must use this API rather than scanning habitat arrays ad hoc.
 * Implementation is a straightforward linear scan — no spatial index until
 * entity counts demonstrate a real need.
 */

import {
	featureRect,
	type Habitat,
	type HabitatFeature,
	type HabitatFeatureKind,
	type Rect,
	type Vec2
} from '$lib/habitat';

export type QueryableFeatureKind = Extract<HabitatFeatureKind, 'food' | 'water'>;

/**
 * True when the axis-aligned feature footprint intersects a circle of
 * `radius` about `centre` (ground plane). Uses authoritative footprints only.
 */
export function circleIntersectsRect(centre: Vec2, radius: number, rect: Rect): boolean {
	if (!(radius >= 0) || !Number.isFinite(radius)) {
		return false;
	}
	// Closest point on rect to centre
	const closestX = Math.max(rect.minX, Math.min(centre.x, rect.maxX));
	const closestY = Math.max(rect.minY, Math.min(centre.y, rect.maxY));
	const dx = centre.x - closestX;
	const dy = centre.y - closestY;
	return dx * dx + dy * dy <= radius * radius;
}

function featuresOfKind(habitat: Habitat, kind: QueryableFeatureKind): readonly HabitatFeature[] {
	return kind === 'food' ? habitat.food : habitat.water;
}

/**
 * Features of the requested kinds whose footprints intersect the sensing circle.
 * Results are sorted by kind (food before water) then lexicographic id for determinism.
 */
export function queryFeaturesNear(
	habitat: Habitat,
	centre: Vec2,
	radius: number,
	kinds: readonly QueryableFeatureKind[] = ['food', 'water']
): HabitatFeature[] {
	const found: HabitatFeature[] = [];
	const kindOrder: QueryableFeatureKind[] = ['food', 'water'];
	for (const kind of kindOrder) {
		if (!kinds.includes(kind)) {
			continue;
		}
		for (const feature of featuresOfKind(habitat, kind)) {
			if (circleIntersectsRect(centre, radius, featureRect(feature))) {
				found.push(feature);
			}
		}
	}
	found.sort((a, b) => {
		if (a.kind !== b.kind) {
			return a.kind === 'food' ? -1 : 1;
		}
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
	return found;
}
