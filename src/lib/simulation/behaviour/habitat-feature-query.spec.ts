import { describe, expect, it } from 'vitest';
import type { Habitat, ResourceFeature } from '$lib/habitat';
import { circleIntersectsRect, queryFeaturesNear } from './habitat-feature-query';
import { featureRect } from '$lib/habitat';

function feature(
	id: string,
	kind: 'food' | 'water',
	x: number,
	y: number,
	w = 1,
	h = 1,
	amount = 1
): ResourceFeature {
	return {
		id,
		kind,
		position: { x, y },
		size: { width: w, height: h },
		amount,
		capacity: Math.max(amount, 1)
	};
}

function miniHabitat(food: ResourceFeature[], water: ResourceFeature[] = []): Habitat {
	const home = {
		id: 'home-0',
		kind: 'home' as const,
		position: { x: 0, y: 0 },
		size: { width: 2, height: 2 }
	};
	return {
		seed: 'q',
		bounds: { width: 40, height: 40 },
		home,
		food,
		water
	};
}

describe('circleIntersectsRect', () => {
	it('detects when a circle intersects a footprint edge, not only centres', () => {
		const rect = { minX: 2, minY: -0.5, maxX: 4, maxY: 0.5 };
		// Centre outside rect; radius reaches the left edge at x=2
		expect(circleIntersectsRect({ x: 0, y: 0 }, 2.1, rect)).toBe(true);
		expect(circleIntersectsRect({ x: 0, y: 0 }, 1.9, rect)).toBe(false);
	});
});

describe('queryFeaturesNear', () => {
	it('does not return food outside the sensing radius', () => {
		const food = [feature('food-far', 'food', 10, 0)];
		const habitat = miniHabitat(food);
		const near = queryFeaturesNear(habitat, { x: 0, y: 0 }, 2, ['food']);
		expect(near).toHaveLength(0);
	});

	it('returns food whose footprint intersects the sensing circle', () => {
		// Footprint extends from x=1.5..2.5; circle r=2 from origin intersects
		const food = [feature('food-edge', 'food', 2, 0, 1, 1)];
		const habitat = miniHabitat(food);
		const near = queryFeaturesNear(habitat, { x: 0, y: 0 }, 2, ['food']);
		expect(near.map((f) => f.id)).toEqual(['food-edge']);
		expect(circleIntersectsRect({ x: 0, y: 0 }, 2, featureRect(food[0]!))).toBe(true);
	});

	it('sorts results deterministically by kind then id', () => {
		const habitat = miniHabitat(
			[feature('food-b', 'food', 0, 0), feature('food-a', 'food', 0.1, 0)],
			[feature('water-a', 'water', 0, 0.1)]
		);
		const near = queryFeaturesNear(habitat, { x: 0, y: 0 }, 5);
		expect(near.map((f) => f.id)).toEqual(['food-a', 'food-b', 'water-a']);
	});

	it('excludes empty water and depleted food by default', () => {
		const habitat = miniHabitat(
			[feature('food-empty', 'food', 0, 0, 1, 1, 0)],
			[feature('water-empty', 'water', 0, 0, 1, 1, 0)]
		);
		const near = queryFeaturesNear(habitat, { x: 0, y: 0 }, 5);
		expect(near).toHaveLength(0);
		const all = queryFeaturesNear(habitat, { x: 0, y: 0 }, 5, ['food', 'water'], {
			availableOnly: false
		});
		expect(all.map((f) => f.id).sort()).toEqual(['food-empty', 'water-empty']);
	});
});
