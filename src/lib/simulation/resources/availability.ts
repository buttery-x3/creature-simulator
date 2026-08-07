/**
 * Shared authoritative resource availability.
 * available ⇔ amount > 0
 */

import type { HabitatFeature, ResourceFeature } from '$lib/habitat';
import { isResourceFeature } from '$lib/habitat';

/**
 * True when a food/water feature currently has consumable quantity.
 * Home is never a resource; empty water basins exist but are unavailable.
 */
export function isResourceAvailable(feature: HabitatFeature | null | undefined): boolean {
	if (!feature || !isResourceFeature(feature)) {
		return false;
	}
	return feature.amount > 0 && Number.isFinite(feature.amount);
}

/** Filter to currently available resource features (amount > 0). */
export function filterAvailableResources(features: readonly ResourceFeature[]): ResourceFeature[] {
	return features.filter((f) => isResourceAvailable(f));
}
