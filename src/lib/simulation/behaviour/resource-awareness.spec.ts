import { describe, expect, it } from 'vitest';
import { featureRect } from '$lib/habitat';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import {
	foodTarget,
	isAtFeature,
	isTargetValid,
	selectNearestFeature,
	waterTarget
} from './resource-awareness';

const config = defaultSimulationConfig('resources');

describe('resource-awareness', () => {
	it('selects nearest feature among habitat list by distance with id tie-break', () => {
		const habitat = createSimulation(config).habitat;
		const origin = { x: 0, y: 0 };
		const nearest = selectNearestFeature(origin, habitat, 'food');
		expect(nearest).not.toBeNull();
		const again = selectNearestFeature(origin, habitat, 'food');
		expect(again).toEqual(nearest);
	});

	it('uses authoritative feature footprints for arrival (not presentation meshes)', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const rect = featureRect(food);
		expect(isAtFeature(food.position, food, config.arrivalDistance)).toBe(true);
		expect(
			isAtFeature(
				{ x: rect.maxX + config.arrivalDistance + 2, y: food.position.y },
				food,
				config.arrivalDistance
			)
		).toBe(false);
	});

	it('treats missing feature ids as invalid targets', () => {
		const habitat = createSimulation(config).habitat;
		expect(
			isTargetValid(habitat, {
				kind: 'feature',
				featureId: 'missing-food',
				featureKind: 'food'
			})
		).toBe(false);
		expect(
			isTargetValid(habitat, { kind: 'feature', featureId: habitat.home.id, featureKind: 'home' })
		).toBe(true);
	});

	it('validates food targets by habitat availability only (memory-driven pursuit)', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const target = {
			kind: 'feature' as const,
			featureId: food.id,
			featureKind: 'food' as const
		};
		expect(isTargetValid(habitat, target)).toBe(true);
		expect(
			isTargetValid(habitat, {
				kind: 'feature',
				featureId: 'gone',
				featureKind: 'food'
			})
		).toBe(false);
	});

	it('water arrival uses water-region footprints', () => {
		const habitat = createSimulation(config).habitat;
		const water = habitat.water[0]!;
		expect(isAtFeature(water.position, water, 0.1)).toBe(true);
	});

	it('rest home target resolves without perception', () => {
		const habitat = createSimulation(config).habitat;
		expect(
			isTargetValid(habitat, {
				kind: 'feature',
				featureId: habitat.home.id,
				featureKind: 'home'
			})
		).toBe(true);
	});

	it('foodTarget and waterTarget build feature targets by id', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const water = habitat.water[0]!;
		expect(foodTarget(food.id)).toEqual({
			kind: 'feature',
			featureId: food.id,
			featureKind: 'food'
		});
		expect(waterTarget(water.id)).toEqual({
			kind: 'feature',
			featureId: water.id,
			featureKind: 'water'
		});
		expect(isTargetValid(habitat, foodTarget(food.id))).toBe(true);
		expect(isTargetValid(habitat, waterTarget(water.id))).toBe(true);
	});

	it('point targets are valid when finite', () => {
		const habitat = createSimulation(config).habitat;
		expect(isTargetValid(habitat, { kind: 'point', position: { x: 1, y: 2 } })).toBe(true);
		expect(isTargetValid(habitat, { kind: 'point', position: { x: NaN, y: 0 } })).toBe(false);
		expect(isTargetValid(habitat, null)).toBe(false);
	});
});
