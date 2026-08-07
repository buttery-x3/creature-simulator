/**
 * Named spatial query boundary for nearby habitat features.
 *
 * Perception must use this API rather than scanning habitat arrays ad hoc.
 * Implementation is a straightforward linear scan — no spatial index until
 * entity counts demonstrate a real need.
 *
 * By default only **available** food/water (amount > 0) are returned so
 * empty basins and depleted sources do not participate in perception,
 * announcement clarity, or learning evidence. Pass `availableOnly: false`
 * only for geography-only callers that need empty basin footprints.
 */

import {
	featureRect,
	type Habitat,
	type HabitatFeature,
	type HabitatFeatureKind,
	type Rect,
	type Vec2
} from '$lib/habitat';
import { isResourceAvailable } from '../resources/availability';

export type QueryableFeatureKind = Extract<HabitatFeatureKind, 'food' | 'water'>;

export type QueryFeaturesNearOptions = {
	/**
	 * When true (default), only features with amount > 0 are returned.
	 * Empty water basins remain in habitat geography but are excluded.
	 */
	availableOnly?: boolean;
};

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
 * Defaults to currently available resources only (`amount > 0`).
 */
export function queryFeaturesNear(
	habitat: Habitat,
	centre: Vec2,
	radius: number,
	kinds: readonly QueryableFeatureKind[] = ['food', 'water'],
	options: QueryFeaturesNearOptions = {}
): HabitatFeature[] {
	const availableOnly = options.availableOnly !== false;
	const found: HabitatFeature[] = [];
	const kindOrder: QueryableFeatureKind[] = ['food', 'water'];
	for (const kind of kindOrder) {
		if (!kinds.includes(kind)) {
			continue;
		}
		for (const feature of featuresOfKind(habitat, kind)) {
			if (availableOnly && !isResourceAvailable(feature)) {
				continue;
			}
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
