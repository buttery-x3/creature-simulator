/**
 * Habitat public entry point.
 *
 * Owns the authoritative two-dimensional habitat model and seeded generation.
 * Presentation (Three.js) must consume {@link Habitat} data and must not store
 * world state as the system of record.
 */

export type {
	Habitat,
	HabitatFeature,
	HabitatFeatureKind,
	HabitatGenerationConfig,
	HomeFeature,
	ResourceFeature,
	Size2,
	SizeRange,
	Vec2,
	WorldBounds
} from './types';

export { isResourceFeature } from './types';

export {
	DEFAULT_HABITAT_CONFIG,
	HabitatGenerationError,
	defaultHabitatConfig,
	generateHabitat,
	habitatSnapshot
} from './generate-habitat';

export { formatHabitatDiagnostics, habitatDiagnosticRecord } from './diagnostics';

export {
	expandRect,
	featureRect,
	featuresViolateSpacing,
	randomCentreForSize,
	rectInsideBounds,
	rectsOverlap,
	type Rect
} from './geometry';

export {
	placeFeatureOrThrow,
	sampleSize,
	tryPlaceFeature,
	type PlaceFeatureFailure,
	type PlaceFeatureResult,
	type PlaceFeatureSuccess,
	type PlacementFootprint
} from './place-feature';
