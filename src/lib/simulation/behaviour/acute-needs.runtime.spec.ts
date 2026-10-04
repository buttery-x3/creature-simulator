import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { testCreature } from '../test-creature';
import { stepCreatureBehaviour } from './step-creature-behaviour';

function fixture() {
	const config = defaultSimulationConfig('acute-recovery');
	config.ecology.wildlifeCount = 0;
	const state = createSimulation(config);
	return { config, habitat: state.habitat };
}

describe('acute competition through actual recovery', () => {
	it.each(['eat', 'sleep'] as const)(
		'permits critical thirst to reconsider %s on its bounded clock',
		(action) => {
			const { config, habitat } = fixture();
			const feature = action === 'eat' ? habitat.food[0] : habitat.home;
			const creature = testCreature({
				position: feature.position,
				hunger: 0.5,
				thirst: 1,
				energy: 0.5,
				action,
				intention: action === 'eat' ? 'satisfy_hunger' : 'rest',
				target: { kind: 'feature', featureId: feature.id, featureKind: feature.kind },
				nextReconsiderAt: 10
			});
			const world = { ...habitat, water: [] };
			const before = stepCreatureBehaviour(
				creature,
				config.fixedDt,
				9,
				'acute',
				world,
				config
			).creature;
			expect(before.action).toBe(action);
			const after = stepCreatureBehaviour(
				before,
				config.fixedDt,
				10,
				'acute',
				world,
				config
			).creature;
			expect(after.intention).toBe('satisfy_thirst');
			expect(after.action).toBe('search');
			expect(after.lastArbitration?.trigger).toBe('periodic');
			expect(after.nextReconsiderAt).toBeGreaterThan(10);
		}
	);

	it('may continue drinking after considering acute hunger and waits before reconsidering again', () => {
		const { config, habitat } = fixture();
		const water = habitat.water[0];
		const creature = testCreature({
			position: water.position,
			hunger: 1,
			thirst: 1,
			energy: 0.8,
			action: 'drink',
			intention: 'satisfy_thirst',
			target: { kind: 'feature', featureId: water.id, featureKind: 'water' },
			nextReconsiderAt: 10
		});
		const world = { ...habitat, food: [] };
		const after = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			10,
			'acute',
			world,
			config
		).creature;
		expect(after.intention).toBe('satisfy_thirst');
		expect(after.action).toBe('drink');
		expect(after.lastArbitration?.trigger).toBe('periodic');
		const next = stepCreatureBehaviour(
			after,
			config.fixedDt,
			10 + config.fixedDt,
			'acute',
			world,
			config
		).creature;
		expect(next.lastArbitration).toBe(after.lastArbitration);
	});
});
