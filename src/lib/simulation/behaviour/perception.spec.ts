import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import {
	emptyPerception,
	isTrackedUsable,
	selectNearestPerceived,
	senseAt,
	startTracking,
	updatePerception
} from './perception';

const config = defaultSimulationConfig('perception');

describe('perception', () => {
	it('does not perceive food outside the sensing radius', () => {
		const habitat = createSimulation(config).habitat;
		// Far from all features at a corner far from home/food
		const position = { x: 9, y: 9 };
		const p = senseAt(position, habitat, 0, { sensingRadius: 1 });
		expect(p.perceivedFoodIds).toHaveLength(0);
		expect(p.perceivedWaterIds).toHaveLength(0);
		expect(p.observations).toHaveLength(0);
	});

	it('perceives food when footprint intersects the sensing circle', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const p = senseAt(food.position, habitat, 1, { sensingRadius: config.sensingRadius });
		expect(p.perceivedFoodIds).toContain(food.id);
		expect(p.observations.some((o) => o.featureId === food.id && o.featureKind === 'food')).toBe(
			true
		);
	});

	it('updates only when the perception interval elapses', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		let p = emptyPerception();
		p = updatePerception(p, food.position, habitat, 0, config);
		expect(p.lastUpdatedAt).toBe(0);
		const firstIds = [...p.perceivedFoodIds];
		// Move far away but interval not elapsed
		p = updatePerception(p, { x: 9, y: 9 }, habitat, 0.1, config);
		expect(p.lastUpdatedAt).toBe(0);
		expect(p.perceivedFoodIds).toEqual(firstIds);
		// Interval elapsed
		p = updatePerception(p, { x: 9, y: 9 }, habitat, config.perceptionIntervalSeconds, config);
		expect(p.lastUpdatedAt).toBe(config.perceptionIntervalSeconds);
		expect(p.perceivedFoodIds).toHaveLength(0);
	});

	it('selects nearest perceived resource deterministically', () => {
		const perception = {
			lastUpdatedAt: 0,
			perceivedFoodIds: ['food-b', 'food-a'],
			perceivedWaterIds: [],
			observations: [
				{
					featureId: 'food-b',
					featureKind: 'food' as const,
					position: { x: 2, y: 0 },
					observedAt: 0
				},
				{
					featureId: 'food-a',
					featureKind: 'food' as const,
					position: { x: 3, y: 0 },
					observedAt: 0
				}
			],
			tracked: null
		};
		const nearest = selectNearestPerceived({ x: 0, y: 0 }, perception, 'food');
		expect(nearest?.featureId).toBe('food-b');
	});

	it('keeps a tracked observation usable until duration expires', () => {
		const tracked = {
			featureId: 'food-1',
			featureKind: 'food' as const,
			position: { x: 1, y: 1 },
			observedAt: 5
		};
		expect(
			isTrackedUsable(
				tracked,
				5 + config.trackedObservationDurationSeconds,
				config.trackedObservationDurationSeconds
			)
		).toBe(true);
		expect(
			isTrackedUsable(
				tracked,
				5 + config.trackedObservationDurationSeconds + 0.01,
				config.trackedObservationDurationSeconds
			)
		).toBe(false);
	});

	it('reacquiring a tracked target refreshes observedAt', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		let p = senseAt(food.position, habitat, 1, { sensingRadius: config.sensingRadius });
		p = startTracking(p, {
			featureId: food.id,
			featureKind: 'food',
			position: { ...food.position },
			observedAt: 1
		});
		// Leave and return after interval
		p = updatePerception(p, { x: 9, y: 9 }, habitat, 1 + config.perceptionIntervalSeconds, config);
		p = updatePerception(
			p,
			food.position,
			habitat,
			1 + config.perceptionIntervalSeconds * 2,
			config
		);
		expect(p.tracked?.featureId).toBe(food.id);
		expect(p.tracked?.observedAt).toBe(1 + config.perceptionIntervalSeconds * 2);
	});

	it('does not create a permanent resource-memory collection', () => {
		const p = emptyPerception();
		expect(p).not.toHaveProperty('memory');
		expect(p).not.toHaveProperty('discovered');
		expect(Array.isArray(p.observations)).toBe(true);
		expect(p.tracked === null || typeof p.tracked === 'object').toBe(true);
	});
});
