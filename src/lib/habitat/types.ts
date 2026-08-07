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
 * Home region on the ground plane.
 * `position` is the centre of the axis-aligned footprint.
 * Home has no resource quantity.
 */
export type HomeFeature = {
	id: string;
	kind: 'home';
	position: Vec2;
	size: Size2;
};

/**
 * Food or water feature with finite renewable quantity.
 * Invariant: `0 <= amount <= capacity`, capacity > 0.
 * Food at amount 0 is removed from the habitat; water basins remain when empty.
 */
export type ResourceFeature = {
	id: string;
	kind: 'food' | 'water';
	position: Vec2;
	size: Size2;
	/** Current consumable quantity (abstract units, 1:1 with need recovery). */
	amount: number;
	/** Maximum quantity; refill and initial fill clamp to this. */
	capacity: number;
};

/**
 * A flat region or source on the ground plane.
 * `position` is the centre of the axis-aligned footprint.
 */
export type HabitatFeature = HomeFeature | ResourceFeature;

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
	/**
	 * Initial and maximum food quantity per bush (abstract units).
	 * Runtime spawns use the same capacity from simulation config.
	 */
	foodCapacity: number;
	/** Initial and maximum water quantity per basin. */
	waterCapacity: number;
};

/**
 * Plain serialisable habitat state. Three.js must not own this data.
 */
export type Habitat = {
	seed: string;
	bounds: WorldBounds;
	home: HomeFeature;
	food: ResourceFeature[];
	water: ResourceFeature[];
};

/** True when a feature carries finite resource quantity. */
export function isResourceFeature(feature: HabitatFeature): feature is ResourceFeature {
	return feature.kind === 'food' || feature.kind === 'water';
}
