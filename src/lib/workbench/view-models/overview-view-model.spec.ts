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

	it('counts authoritative living wildlife', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		expect(buildOverviewViewModel(state).world.wildlifeCount).toBe(
			state.wildlife.filter((animal) => animal.health > 0).length
		);
	});
});

describe('population lifecycle observations', () => {
	it('reports living age/generation and bounded event counts without including dead creatures', () => {
		const state = createSimulation(defaultSimulationConfig('lifecycle-observer'));
		state.creatures = state.creatures.slice(0, 2).map((creature, index) => ({
			...creature,
			lifecycle: {
				...creature.lifecycle,
				ageSeconds: index ? 150 : 10,
				generation: index ? 0 : 1
			}
		}));
		state.recentLifeEvents = [
			{
				kind: 'birth',
				time: 10,
				creatureId: 'offspring',
				parentIds: ['parent-a', 'parent-b'],
				generation: 1
			},
			{ kind: 'death', time: 11, creatureId: 'removed', cause: 'age' },
			{
				kind: 'courtship_failed',
				time: 12,
				creatureIds: ['parent-a', 'parent-b'],
				reason: 'population_cap'
			}
		];
		const before = JSON.stringify(state);
		expect(buildOverviewViewModel(state).population).toEqual({
			averageAgeSeconds: 80,
			youngestAgeSeconds: 10,
			oldestAgeSeconds: 150,
			highestGeneration: 1,
			recentBirthCount: 1,
			recentDeathCount: 1,
			recentCourtshipFailureCount: 1
		});
		expect(JSON.stringify(state)).toBe(before);
		state.recentLifeEvents = [];
		expect(buildOverviewViewModel(state).population.recentBirthCount).toBe(0);
	});
	it('represents extinction with absent age range and generation', () => {
		const state = createSimulation(defaultSimulationConfig('empty-life'));
		state.creatures = [];
		expect(buildOverviewViewModel(state).population).toEqual({
			averageAgeSeconds: 0,
			youngestAgeSeconds: null,
			oldestAgeSeconds: null,
			highestGeneration: null,
			recentBirthCount: 0,
			recentDeathCount: 0,
			recentCourtshipFailureCount: 0
		});
	});
});

it('counts physical follow intentions separately from approach and learned meanings', () => {
	const state = createSimulation(defaultSimulationConfig('follow-overview'));
	state.creatures[0].intention = 'follow_peer';
	const vm = buildOverviewViewModel(state);
	expect(vm.behaviour.byIntention.follow_peer).toBe(1);
	expect(Object.values(vm.behaviour.byIntention).reduce((sum, count) => sum + count, 0)).toBe(
		state.creatures.length
	);
});
