import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { emptyPerception, selectNearestPerceived, senseAt, updatePerception } from './perception';

const config = defaultSimulationConfig('perception');

describe('perception', () => {
	it('does not perceive food outside the sensing radius', () => {
		const habitat = createSimulation(config).habitat;
		const position = { x: 9, y: 9 };
		const p = senseAt(position, habitat, 0, { sensingRadius: 1 }).perception;
		expect(p.perceivedFoodIds).toHaveLength(0);
		expect(p.perceivedWaterIds).toHaveLength(0);
		expect(p.observations).toHaveLength(0);
	});

	it('perceives food when footprint intersects the sensing circle', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const p = senseAt(food.position, habitat, 1, {
			sensingRadius: config.sensingRadius
		}).perception;
		expect(p.perceivedFoodIds).toContain(food.id);
		expect(p.observations.some((o) => o.featureId === food.id && o.featureKind === 'food')).toBe(
			true
		);
	});

	it('updates only when the perception interval elapses', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		let p = emptyPerception();
		const first = updatePerception(p, food.position, habitat, 0, config);
		p = first.perception;
		expect(first.sensed).toBe(true);
		expect(p.lastUpdatedAt).toBe(0);
		const firstIds = [...p.perceivedFoodIds];
		const skipped = updatePerception(p, { x: 9, y: 9 }, habitat, 0.1, config);
		p = skipped.perception;
		expect(skipped.sensed).toBe(false);
		expect(p.lastUpdatedAt).toBe(0);
		expect(p.perceivedFoodIds).toEqual(firstIds);
		const later = updatePerception(
			p,
			{ x: 9, y: 9 },
			habitat,
			config.perceptionIntervalSeconds,
			config
		);
		p = later.perception;
		expect(later.sensed).toBe(true);
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
			]
		};
		const nearest = selectNearestPerceived({ x: 0, y: 0 }, perception, 'food');
		expect(nearest?.featureId).toBe('food-b');
	});

	it('does not create a permanent resource-memory collection on perception', () => {
		const p = emptyPerception();
		expect(p).not.toHaveProperty('memory');
		expect(p).not.toHaveProperty('discovered');
		expect(p).not.toHaveProperty('tracked');
		expect(p).not.toHaveProperty('activeEpisodes');
		expect(Array.isArray(p.observations)).toBe(true);
	});

	it('senseAt returns a full snapshot of food/water within radius', () => {
		const habitat = createSimulation(config).habitat;
		const food = habitat.food[0]!;
		const result = senseAt(food.position, habitat, 2, {
			sensingRadius: config.sensingRadius
		});
		expect(result.sensed).toBe(true);
		expect(result.perception.lastUpdatedAt).toBe(2);
		expect(result.perception.perceivedFoodIds).toContain(food.id);
		const obs = result.perception.observations.find((o) => o.featureId === food.id);
		expect(obs?.observedAt).toBe(2);
		expect(obs?.position.x).toBeCloseTo(food.position.x);
	});
});
