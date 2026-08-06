import {
	featureRect,
	featuresViolateSpacing,
	randomCentreForSize,
	rectInsideBounds
} from './geometry';
import { createSeededRng, type SeededRng } from './seeded-rng';
import type { Habitat, HabitatFeature, HabitatGenerationConfig, Size2, SizeRange } from './types';

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
	maxPlacementAttempts: 80
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

function sampleSize(range: SizeRange, rng: SeededRng): Size2 {
	if (
		range.maxWidth < range.minWidth ||
		range.maxHeight < range.minHeight ||
		range.minWidth <= 0 ||
		range.minHeight <= 0
	) {
		throw new HabitatGenerationError(
			`Invalid size range: width [${range.minWidth}, ${range.maxWidth}], height [${range.minHeight}, ${range.maxHeight}]`
		);
	}

	try {
		return {
			width: rng.nextRange(range.minWidth, range.maxWidth),
			height: rng.nextRange(range.minHeight, range.maxHeight)
		};
	} catch (error) {
		throw new HabitatGenerationError(
			error instanceof Error ? error.message : 'Failed to sample feature size'
		);
	}
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
}

function conflictsWithPlaced(
	candidate: Pick<HabitatFeature, 'position' | 'size'>,
	placed: HabitatFeature[],
	minSpacing: number
): boolean {
	return placed.some((feature) => featuresViolateSpacing(candidate, feature, minSpacing));
}

function placeFeature(
	kind: HabitatFeature['kind'],
	id: string,
	sizeRange: SizeRange,
	config: HabitatGenerationConfig,
	rng: SeededRng,
	placed: HabitatFeature[]
): HabitatFeature {
	const bounds = { width: config.worldWidth, height: config.worldHeight };
	const margin = 0;

	for (let attempt = 0; attempt < config.maxPlacementAttempts; attempt += 1) {
		const size = sampleSize(sizeRange, rng);
		let position;
		try {
			position = randomCentreForSize(bounds, size, margin, (min, max) => rng.nextRange(min, max));
		} catch (error) {
			throw new HabitatGenerationError(
				error instanceof Error
					? error.message
					: `Cannot place ${kind} ${id}: size does not fit world`
			);
		}

		const candidate: HabitatFeature = { id, kind, position, size };
		const rect = featureRect(candidate);

		if (!rectInsideBounds(rect, bounds)) {
			continue;
		}
		if (conflictsWithPlaced(candidate, placed, config.minSpacing)) {
			continue;
		}

		return candidate;
	}

	throw new HabitatGenerationError(
		`Failed to place ${kind} "${id}" after ${config.maxPlacementAttempts} attempts ` +
			`(world ${config.worldWidth}×${config.worldHeight}, minSpacing ${config.minSpacing}, ` +
			`${placed.length} features already placed). Configuration may be impossible.`
	);
}

/**
 * Generate a deterministic habitat from seed and configuration.
 *
 * Placement order: home, then water, then food. Features are axis-aligned
 * rectangles that must stay inside world bounds and respect minSpacing.
 * Impossible configurations fail with {@link HabitatGenerationError} after
 * bounded attempts — counts are never silently reduced.
 */
export function generateHabitat(config: HabitatGenerationConfig): Habitat {
	validateConfig(config);

	const rng = createSeededRng(config.seed);
	const placed: HabitatFeature[] = [];

	const home = placeFeature('home', 'home', config.homeSize, config, rng, placed);
	placed.push(home);

	const water: HabitatFeature[] = [];
	for (let i = 0; i < config.waterCount; i += 1) {
		const feature = placeFeature('water', `water-${i}`, config.waterSize, config, rng, placed);
		placed.push(feature);
		water.push(feature);
	}

	const food: HabitatFeature[] = [];
	for (let i = 0; i < config.foodCount; i += 1) {
		const feature = placeFeature('food', `food-${i}`, config.foodSize, config, rng, placed);
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
