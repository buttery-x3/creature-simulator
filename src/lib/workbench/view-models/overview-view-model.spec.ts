import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import { buildOverviewViewModel } from './overview-view-model';

describe('buildOverviewViewModel', () => {
	it('aggregates wellbeing, intention counts and world snapshot from structured state', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		const vm = buildOverviewViewModel(state);

		expect(vm.wellbeing.creatureCount).toBe(state.creatures.length);
		expect(vm.wellbeing.averageHunger).toBeGreaterThanOrEqual(0);
		expect(vm.wellbeing.highestHunger?.creatureId).toMatch(/^creature-/);
		expect(
			vm.behaviour.byIntention.explore + vm.behaviour.byIntention.satisfy_hunger
		).toBeGreaterThanOrEqual(0);
		expect(Object.keys(vm.behaviour.byIntention)).toEqual(
			expect.arrayContaining([
				'explore',
				'satisfy_hunger',
				'satisfy_thirst',
				'rest',
				'investigate_signal',
				'announce_resource'
			])
		);
		expect(vm.world.foodCount).toBe(state.habitat.food.length);
		expect(vm.world.waterCount).toBe(state.habitat.water.length);
		expect(vm.world.homeCount).toBe(1);
		expect(vm.world.activeAnnouncementCount).toBe(state.activeEmissions.length);
	});

	it('does not invent predator counts', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		expect(buildOverviewViewModel(state).world.predatorCount).toBe(0);
	});
});
