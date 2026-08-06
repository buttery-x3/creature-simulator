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
	Size2,
	SizeRange,
	Vec2,
	WorldBounds
} from './types';

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
