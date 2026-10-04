import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, LEXICON_MEANINGS } from '$lib/simulation';
import { buildPopulationLexiconViewModel } from './population-lexicon-view-model';

function population() {
	const creatures = createSimulation(defaultSimulationConfig('generation-view')).creatures.slice(
		0,
		5
	);
	const generations = [10, 2, 0, 2, 2];
	for (const [i, creature] of creatures.entries()) creature.lifecycle.generation = generations[i];
	creatures[0].lexicon = {
		food: 'glyph-1',
		water: 'glyph-2',
		danger: 'glyph-3',
		approach: 'glyph-0'
	};
	creatures[1].lexicon.food = 'glyph-2';
	creatures[3].lexicon.food = 'glyph-0';
	return creatures;
}

describe('living generation lexicons', () => {
	it('groups living cohorts in numeric order while preserving every competing personal glyph and unassigned member', () => {
		const creatures = population();
		const before = JSON.stringify(creatures);
		const vm = buildPopulationLexiconViewModel(creatures);
		expect(vm.generations.map((cohort) => cohort.generation)).toEqual([0, 2, 10]);
		expect(vm.generations.map((cohort) => cohort.creatureCount)).toEqual([1, 3, 1]);
		expect(vm.generations[1].meanings[0]).toEqual({
			meaning: 'food',
			assignments: [
				{ symbolId: 'glyph-0', count: 1 },
				{ symbolId: 'glyph-2', count: 1 }
			],
			unassigned: 1
		});
		for (const cohort of vm.generations) {
			expect(cohort.meanings.map((row) => row.meaning)).toEqual(LEXICON_MEANINGS);
			for (const row of cohort.meanings)
				expect(row.unassigned + row.assignments.reduce((sum, entry) => sum + entry.count, 0)).toBe(
					cohort.creatureCount
				);
		}
		expect(vm.lexiconMatrix.map((row) => row.creatureId)).toEqual(
			creatures.map((creature) => creature.id)
		);
		expect(vm.lexiconMatrix[0].generation).toBe(10);
		expect(JSON.stringify(creatures)).toBe(before);
		vm.lexiconMatrix[0].lexicon.food = null;
		expect(creatures[0].lexicon.food).toBe('glyph-1');
	});
	it('counts repeated assignments and gives the same cohort ordering after input reorder', () => {
		const creatures = population();
		creatures[4].lexicon.food = 'glyph-2';
		const forward = buildPopulationLexiconViewModel(creatures).generations;
		expect(forward[1].meanings[0].assignments).toEqual([
			{ symbolId: 'glyph-0', count: 1 },
			{ symbolId: 'glyph-2', count: 2 }
		]);
		expect(buildPopulationLexiconViewModel([...creatures].reverse()).generations).toEqual(forward);
	});
	it('removes dead members and absent generations rather than preserving historical assignments', () => {
		const creatures = population();
		const alive = creatures.filter((_, index) => index !== 0 && index !== 1);
		const vm = buildPopulationLexiconViewModel(alive);
		expect(vm.generations.map((cohort) => cohort.generation)).toEqual([0, 2]);
		expect(vm.generations[1].creatureCount).toBe(2);
		expect(vm.generations[1].meanings[0]).toEqual({
			meaning: 'food',
			assignments: [{ symbolId: 'glyph-0', count: 1 }],
			unassigned: 1
		});
		expect(vm.lexiconMatrix).toHaveLength(3);
	});
	it('returns an empty living snapshot', () => {
		expect(buildPopulationLexiconViewModel([])).toEqual({ lexiconMatrix: [], generations: [] });
	});
});
