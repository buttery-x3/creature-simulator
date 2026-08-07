/**
 * Pure bounded feature placement shared by initial habitat generation and
 * runtime food spawning. Does not own resource amounts or simulation clocks.
 */

import type { SeededRng } from '$lib/determinism';
import {
	featureRect,
	featuresViolateSpacing,
	randomCentreForSize,
	rectInsideBounds
} from './geometry';
import type {
	HabitatFeature,
	HabitatFeatureKind,
	Size2,
	SizeRange,
	Vec2,
	WorldBounds
} from './types';

export type PlacementFootprint = Pick<HabitatFeature, 'position' | 'size'>;

export type PlaceFeatureSuccess = {
	ok: true;
	position: Vec2;
	size: Size2;
	attempts: number;
};

export type PlaceFeatureFailure = {
	ok: false;
	attempts: number;
};

export type PlaceFeatureResult = PlaceFeatureSuccess | PlaceFeatureFailure;

export function sampleSize(range: SizeRange, rng: SeededRng): Size2 {
	if (
		range.maxWidth < range.minWidth ||
		range.maxHeight < range.minHeight ||
		range.minWidth <= 0 ||
		range.minHeight <= 0
	) {
		throw new Error(
			`Invalid size range: width [${range.minWidth}, ${range.maxWidth}], height [${range.minHeight}, ${range.maxHeight}]`
		);
	}

	return {
		width: rng.nextRange(range.minWidth, range.maxWidth),
		height: rng.nextRange(range.minHeight, range.maxHeight)
	};
}

function conflictsWithPlaced(
	candidate: PlacementFootprint,
	placed: readonly PlacementFootprint[],
	minSpacing: number
): boolean {
	return placed.some((feature) => featuresViolateSpacing(candidate, feature, minSpacing));
}

/**
 * Attempt to place a feature footprint inside bounds with spacing against `placed`.
 * Returns structured success/failure after at most `maxPlacementAttempts` tries.
 * Does not throw on exhaustion — callers decide fail-hard vs skip.
 */
export function tryPlaceFeature(input: {
	sizeRange: SizeRange;
	bounds: WorldBounds;
	minSpacing: number;
	maxPlacementAttempts: number;
	placed: readonly PlacementFootprint[];
	rng: SeededRng;
	/** Edge margin for centre sampling (usually 0). */
	margin?: number;
}): PlaceFeatureResult {
	const margin = input.margin ?? 0;
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= input.maxPlacementAttempts; attempt += 1) {
		let size: Size2;
		try {
			size = sampleSize(input.sizeRange, input.rng);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			continue;
		}

		let position: Vec2;
		try {
			position = randomCentreForSize(input.bounds, size, margin, (min, max) =>
				input.rng.nextRange(min, max)
			);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			continue;
		}

		const candidate: PlacementFootprint = { position, size };
		const rect = featureRect(candidate);

		if (!rectInsideBounds(rect, input.bounds)) {
			continue;
		}
		if (conflictsWithPlaced(candidate, input.placed, input.minSpacing)) {
			continue;
		}

		return { ok: true, position, size, attempts: attempt };
	}

	if (lastError && input.maxPlacementAttempts === 0) {
		// Unreachable with validated attempts >= 1; kept for completeness.
		return { ok: false, attempts: 0 };
	}

	return { ok: false, attempts: input.maxPlacementAttempts };
}

/**
 * Convenience: place and build a bare geometry feature (no resource amounts).
 * Throws when placement fails after bounded attempts (initial generation).
 */
export function placeFeatureOrThrow(
	kind: HabitatFeatureKind,
	id: string,
	sizeRange: SizeRange,
	bounds: WorldBounds,
	minSpacing: number,
	maxPlacementAttempts: number,
	placed: readonly PlacementFootprint[],
	rng: SeededRng
): { id: string; kind: HabitatFeatureKind; position: Vec2; size: Size2 } {
	const result = tryPlaceFeature({
		sizeRange,
		bounds,
		minSpacing,
		maxPlacementAttempts,
		placed,
		rng
	});
	if (!result.ok) {
		throw new Error(
			`Failed to place ${kind} "${id}" after ${result.attempts} attempts ` +
				`(world ${bounds.width}×${bounds.height}, minSpacing ${minSpacing}, ` +
				`${placed.length} features already placed). Configuration may be impossible.`
		);
	}
	return { id, kind, position: result.position, size: result.size };
}
