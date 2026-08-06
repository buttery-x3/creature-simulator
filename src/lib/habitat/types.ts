/**
 * Authoritative habitat model.
 *
 * Simulation positions use two coordinates on the ground plane (x, y).
 * Three.js maps those onto its horizontal XY plane; vertical extent (Z) is
 * presentation-only and never appears in this model.
 */

/** Ground-plane position in simulation units. */
export type Vec2 = {
	x: number;
	y: number;
};

/** Axis-aligned footprint: width along x, height along y. */
export type Size2 = {
	width: number;
	height: number;
};

export type HabitatFeatureKind = 'home' | 'food' | 'water';

/**
 * A flat region or source on the ground plane.
 * `position` is the centre of the axis-aligned footprint.
 */
export type HabitatFeature = {
	id: string;
	kind: HabitatFeatureKind;
	position: Vec2;
	size: Size2;
};

/**
 * Rectangular world bounds centred on the origin.
 * The usable ground plane covers
 * x ∈ [-width/2, width/2], y ∈ [-height/2, height/2].
 */
export type WorldBounds = {
	width: number;
	height: number;
};

/** Inclusive size range used during generation. */
export type SizeRange = {
	minWidth: number;
	maxWidth: number;
	minHeight: number;
	maxHeight: number;
};

/**
 * Configuration accepted by the seeded habitat generator.
 * The same seed and config must always produce the same habitat.
 */
export type HabitatGenerationConfig = {
	seed: string;
	worldWidth: number;
	worldHeight: number;
	foodCount: number;
	waterCount: number;
	homeSize: SizeRange;
	foodSize: SizeRange;
	waterSize: SizeRange;
	/** Minimum gap between feature edges (simulation units). */
	minSpacing: number;
	/** Placement attempts per feature before generation fails. */
	maxPlacementAttempts: number;
};

/**
 * Plain serialisable habitat state. Three.js must not own this data.
 */
export type Habitat = {
	seed: string;
	bounds: WorldBounds;
	home: HabitatFeature;
	food: HabitatFeature[];
	water: HabitatFeature[];
};
