import type { HabitatFeature, Size2, Vec2, WorldBounds } from './types';

/** Axis-aligned rectangle in ground-plane coordinates. */
export type Rect = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export function featureRect(feature: Pick<HabitatFeature, 'position' | 'size'>): Rect {
	const halfW = feature.size.width / 2;
	const halfH = feature.size.height / 2;
	return {
		minX: feature.position.x - halfW,
		minY: feature.position.y - halfH,
		maxX: feature.position.x + halfW,
		maxY: feature.position.y + halfH
	};
}

export function expandRect(rect: Rect, padding: number): Rect {
	return {
		minX: rect.minX - padding,
		minY: rect.minY - padding,
		maxX: rect.maxX + padding,
		maxY: rect.maxY + padding
	};
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
	return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * True when `inner` lies entirely inside world bounds centred on the origin.
 */
export function rectInsideBounds(rect: Rect, bounds: WorldBounds): boolean {
	const halfW = bounds.width / 2;
	const halfH = bounds.height / 2;
	return rect.minX >= -halfW && rect.maxX <= halfW && rect.minY >= -halfH && rect.maxY <= halfH;
}

/**
 * Sample a centre position so a footprint of `size` fits inside the world
 * with the given edge margin (typically half of minSpacing, or 0).
 */
export function randomCentreForSize(
	bounds: WorldBounds,
	size: Size2,
	margin: number,
	nextRange: (min: number, max: number) => number
): Vec2 {
	const halfW = bounds.width / 2;
	const halfH = bounds.height / 2;
	const halfSizeW = size.width / 2;
	const halfSizeH = size.height / 2;

	const minX = -halfW + halfSizeW + margin;
	const maxX = halfW - halfSizeW - margin;
	const minY = -halfH + halfSizeH + margin;
	const maxY = halfH - halfSizeH - margin;

	if (minX > maxX || minY > maxY) {
		throw new Error(
			`Feature size ${size.width}×${size.height} with margin ${margin} cannot fit in world ${bounds.width}×${bounds.height}`
		);
	}

	return {
		x: nextRange(minX, maxX),
		y: nextRange(minY, maxY)
	};
}

/**
 * True when two features violate separation: their footprints (expanded by
 * half of minSpacing on each side, i.e. full minSpacing between edges) overlap.
 */
export function featuresViolateSpacing(
	a: Pick<HabitatFeature, 'position' | 'size'>,
	b: Pick<HabitatFeature, 'position' | 'size'>,
	minSpacing: number
): boolean {
	const padding = minSpacing / 2;
	return rectsOverlap(expandRect(featureRect(a), padding), expandRect(featureRect(b), padding));
}
