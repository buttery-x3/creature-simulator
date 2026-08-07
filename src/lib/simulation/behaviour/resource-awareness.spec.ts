import { describe, expect, it } from 'vitest';
import { featureRect } from '$lib/habitat';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { emptyPerception, senseAt, startTracking } from './perception';
import {
	foodTarget,
	isAtFeature,
	isTargetValid,
	selectNearestFeature,
	waterTarget
} from './resource-awareness';

const config = defaultSimulationConfig('resources');

describe('resource-awareness', () => {
	it('selects nearest feature among a pre-filtered list by distance with id tie-break', () => {
		const habitat = createSimulation(config).habitat;
		const origin = { x: 0, y: 0 };
		const nearest = selectNearestFeature(origin, habitat.food);
		expect(nearest).not.toBeNull();
		const again = selectNearestFeature(origin, habitat.food);
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

	it('requires perception or tracking for food targets when perception is supplied', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const target = {
			kind: 'feature' as const,
			featureId: food.id,
			featureKind: 'food' as const
		};
		expect(
			isTargetValid(habitat, target, emptyPerception(), 0, config.trackedObservationDurationSeconds)
		).toBe(false);
		const perceived = senseAt(food.position, habitat, 0, {
			sensingRadius: config.sensingRadius
		}).perception;
		expect(
			isTargetValid(habitat, target, perceived, 0, config.trackedObservationDurationSeconds)
		).toBe(true);
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

	it('foodTarget returns null without perception and a feature when perceived', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		expect(
			foodTarget(
				{ x: 0, y: 0 },
				habitat,
				emptyPerception(),
				0,
				config.trackedObservationDurationSeconds
			)
		).toBeNull();
		const perceived = senseAt(food.position, habitat, 1, {
			sensingRadius: config.sensingRadius
		}).perception;
		const target = foodTarget(
			food.position,
			habitat,
			perceived,
			1,
			config.trackedObservationDurationSeconds
		);
		expect(target).toEqual({
			kind: 'feature',
			featureId: food.id,
			featureKind: 'food'
		});
	});

	it('prefers a still-valid tracked observation over an empty snapshot', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		let perception = emptyPerception(0);
		perception = startTracking(perception, {
			featureId: food.id,
			featureKind: 'food',
			position: { ...food.position },
			observedAt: 0
		});
		const target = foodTarget(
			{ x: 0, y: 0 },
			habitat,
			perception,
			1,
			config.trackedObservationDurationSeconds
		);
		expect(target?.kind).toBe('feature');
		if (target?.kind === 'feature') {
			expect(target.featureId).toBe(food.id);
		}
	});

	it('waterTarget is perception-scoped', () => {
		const habitat = createSimulation(config).habitat;
		const water = habitat.water[0]!;
		expect(
			waterTarget(
				water.position,
				habitat,
				emptyPerception(),
				0,
				config.trackedObservationDurationSeconds
			)
		).toBeNull();
		const perceived = senseAt(water.position, habitat, 0, {
			sensingRadius: config.sensingRadius
		}).perception;
		const target = waterTarget(
			water.position,
			habitat,
			perceived,
			0,
			config.trackedObservationDurationSeconds
		);
		expect(target?.kind).toBe('feature');
		if (target?.kind === 'feature') {
			expect(target.featureId).toBe(water.id);
		}
	});
});
