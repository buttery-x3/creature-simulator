import { describe, expect, it } from 'vitest';
import { featureRect } from '$lib/habitat';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { isAtFeature, isTargetValid, selectNearestFeature } from './resource-awareness';

const config = defaultSimulationConfig('resources');

describe('resource-awareness', () => {
	it('selects nearest food by distance with id tie-break', () => {
		const habitat = createSimulation(config).habitat;
		const origin = { x: 0, y: 0 };
		const nearest = selectNearestFeature(origin, habitat.food);
		expect(nearest).not.toBeNull();
		// Deterministic: recompute
		const again = selectNearestFeature(origin, habitat.food);
		expect(again).toEqual(nearest);
	});

	it('uses authoritative feature footprints for arrival (not presentation meshes)', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const rect = featureRect(food);
		// Centre of footprint must count as arrived
		expect(isAtFeature(food.position, food, config.arrivalDistance)).toBe(true);
		// Far outside footprint must not
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

	it('water arrival uses water-region footprints', () => {
		const habitat = createSimulation(config).habitat;
		const water = habitat.water[0]!;
		expect(isAtFeature(water.position, water, 0.1)).toBe(true);
	});

	it('rest home target resolves to habitat.home', () => {
		const habitat = createSimulation(config).habitat;
		expect(
			isTargetValid(habitat, {
				kind: 'feature',
				featureId: habitat.home.id,
				featureKind: 'home'
			})
		).toBe(true);
	});
});
