import { createSeededRng, type SeededRng } from '$lib/determinism';
import { placeFeatureOrThrow, type PlacementFootprint } from './place-feature';
import type {
	Habitat,
	HabitatFeature,
	HabitatGenerationConfig,
	HomeFeature,
	ResourceFeature,
	SizeRange
} from './types';

export class HabitatGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'HabitatGenerationError';
	}
}

export const DEFAULT_HABITAT_CONFIG: Omit<HabitatGenerationConfig, 'seed'> = {
	worldWidth: 20,
	worldHeight: 14,
	foodCount: 5,
	waterCount: 2,
	homeSize: {
		minWidth: 2.2,
		maxWidth: 3.2,
		minHeight: 1.8,
		maxHeight: 2.6
	},
	foodSize: {
		minWidth: 0.7,
		maxWidth: 1.1,
		minHeight: 0.7,
		maxHeight: 1.1
	},
	waterSize: {
		minWidth: 1.6,
		maxWidth: 2.8,
		minHeight: 1.2,
		maxHeight: 2.2
	},
	minSpacing: 0.6,
	maxPlacementAttempts: 80,
	// Food is the scarce/volatile resource: a few full eat sessions deplete a bush.
	foodCapacity: 1.5,
	// Water is comparatively abundant but can still run dry under sustained use.
	waterCapacity: 12
};

/**
 * Independent habitat configuration for callers that may mutate size ranges.
 * Nested `homeSize` / `foodSize` / `waterSize` objects are cloned so mutations
 * cannot reach {@link DEFAULT_HABITAT_CONFIG} or other factory results.
 */
export function defaultHabitatConfig(seed = 'demo'): HabitatGenerationConfig {
	return {
		...DEFAULT_HABITAT_CONFIG,
		seed,
		homeSize: { ...DEFAULT_HABITAT_CONFIG.homeSize },
		foodSize: { ...DEFAULT_HABITAT_CONFIG.foodSize },
		waterSize: { ...DEFAULT_HABITAT_CONFIG.waterSize }
	};
}

function validateConfig(config: HabitatGenerationConfig): void {
	if (config.seed.length === 0) {
		throw new HabitatGenerationError('seed must be a non-empty string');
	}
	if (!(config.worldWidth > 0) || !(config.worldHeight > 0)) {
		throw new HabitatGenerationError(
			`world dimensions must be positive, received ${config.worldWidth}×${config.worldHeight}`
		);
	}
	if (!Number.isInteger(config.foodCount) || config.foodCount < 0) {
		throw new HabitatGenerationError(
			`foodCount must be a non-negative integer, received ${config.foodCount}`
		);
	}
	if (!Number.isInteger(config.waterCount) || config.waterCount < 0) {
		throw new HabitatGenerationError(
			`waterCount must be a non-negative integer, received ${config.waterCount}`
		);
	}
	if (!(config.minSpacing >= 0)) {
		throw new HabitatGenerationError(`minSpacing must be >= 0, received ${config.minSpacing}`);
	}
	if (!Number.isInteger(config.maxPlacementAttempts) || config.maxPlacementAttempts < 1) {
		throw new HabitatGenerationError(
			`maxPlacementAttempts must be a positive integer, received ${config.maxPlacementAttempts}`
		);
	}
	if (!(config.foodCapacity > 0) || !Number.isFinite(config.foodCapacity)) {
		throw new HabitatGenerationError(
			`foodCapacity must be a finite number > 0, received ${config.foodCapacity}`
		);
	}
	if (!(config.waterCapacity > 0) || !Number.isFinite(config.waterCapacity)) {
		throw new HabitatGenerationError(
			`waterCapacity must be a finite number > 0, received ${config.waterCapacity}`
		);
	}
}

function placeHome(
	sizeRange: SizeRange,
	config: HabitatGenerationConfig,
	rng: SeededRng,
	placed: PlacementFootprint[]
): HomeFeature {
	try {
		const bare = placeFeatureOrThrow(
			'home',
			'home',
			sizeRange,
			{ width: config.worldWidth, height: config.worldHeight },
			config.minSpacing,
			config.maxPlacementAttempts,
			placed,
			rng
		);
		return {
			id: bare.id,
			kind: 'home',
			position: bare.position,
			size: bare.size
		};
	} catch (error) {
		throw new HabitatGenerationError(error instanceof Error ? error.message : String(error));
	}
}

function placeResource(
	kind: 'food' | 'water',
	id: string,
	sizeRange: SizeRange,
	capacity: number,
	config: HabitatGenerationConfig,
	rng: SeededRng,
	placed: PlacementFootprint[]
): ResourceFeature {
	try {
		const bare = placeFeatureOrThrow(
			kind,
			id,
			sizeRange,
			{ width: config.worldWidth, height: config.worldHeight },
			config.minSpacing,
			config.maxPlacementAttempts,
			placed,
			rng
		);
		return {
			id: bare.id,
			kind,
			position: bare.position,
			size: bare.size,
			amount: capacity,
			capacity
		};
	} catch (error) {
		throw new HabitatGenerationError(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Generate a deterministic habitat from seed and configuration.
 *
 * Placement order: home, then water, then food. Features are axis-aligned
 * rectangles that must stay inside world bounds and respect minSpacing.
 * Impossible configurations fail with {@link HabitatGenerationError} after
 * bounded attempts — counts are never silently reduced.
 *
 * Food and water start at full capacity. Home has no resource quantity.
 */
export function generateHabitat(config: HabitatGenerationConfig): Habitat {
	validateConfig(config);

	const rng = createSeededRng(config.seed);
	const placed: PlacementFootprint[] = [];

	const home = placeHome(config.homeSize, config, rng, placed);
	placed.push(home);

	const water: ResourceFeature[] = [];
	for (let i = 0; i < config.waterCount; i += 1) {
		const feature = placeResource(
			'water',
			`water-${i}`,
			config.waterSize,
			config.waterCapacity,
			config,
			rng,
			placed
		);
		placed.push(feature);
		water.push(feature);
	}

	const food: ResourceFeature[] = [];
	for (let i = 0; i < config.foodCount; i += 1) {
		const feature = placeResource(
			'food',
			`food-${i}`,
			config.foodSize,
			config.foodCapacity,
			config,
			rng,
			placed
		);
		placed.push(feature);
		food.push(feature);
	}

	return {
		seed: config.seed,
		bounds: {
			width: config.worldWidth,
			height: config.worldHeight
		},
		home,
		food,
		water
	};
}

/** Stable snapshot for equality checks and diagnostics. */
export function habitatSnapshot(habitat: Habitat): string {
	return JSON.stringify(habitat);
}

/** @internal re-export for tests that inspect placement helpers indirectly */
export type { HabitatFeature };
