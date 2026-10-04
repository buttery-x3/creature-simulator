import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, LEXICON_MEANINGS } from '$lib/simulation';
import { buildPopulationLexiconViewModel } from '../view-models/population-lexicon-view-model';
import PopulationLexicons from './PopulationLexicons.svelte';

describe('living generation presentation', () => {
	it('shows all meanings, personal glyph variation and generation labels while preserving individual navigation', () => {
		const creatures = createSimulation(defaultSimulationConfig('cohort-render')).creatures.slice(
			0,
			2
		);
		creatures[0].lifecycle.generation = 2;
		creatures[1].lifecycle.generation = 2;
		creatures[0].lexicon.food = 'glyph-0';
		creatures[1].lexicon.food = 'glyph-2';
		const before = JSON.stringify(creatures);
		const vm = buildPopulationLexiconViewModel(creatures);
		const { body } = render(PopulationLexicons, {
			props: { rows: vm.lexiconMatrix, generations: vm.generations, onNavigate: () => {} }
		});
		expect(body).toContain('Generation 2 · 2 alive');
		for (const meaning of LEXICON_MEANINGS) expect(body).toContain('generation-2-' + meaning);
		expect(body).toContain('glyph-0');
		expect(body).toContain('glyph-2');
		expect(body).toContain('unassigned 0');
		expect(body).toContain('unassigned 2');
		for (const creature of creatures) {
			expect(body).toContain('lexicon-matrix-' + creature.id);
			expect(body).toContain('lexicon-generation-' + creature.id);
		}
		expect(body).toMatch(/not a shared translation\s+or evidence of inheritance/);
		expect(JSON.stringify(creatures)).toBe(before);
	});
	it('filters individual rows without changing the living cohort count', () => {
		const creatures = createSimulation(defaultSimulationConfig('cohort-filter')).creatures.slice(
			0,
			2
		);
		const vm = buildPopulationLexiconViewModel(creatures);
		const { body } = render(PopulationLexicons, {
			props: {
				rows: vm.lexiconMatrix,
				generations: vm.generations,
				filterCreatureId: creatures[1].id,
				onNavigate: () => {}
			}
		});
		expect(body).toContain('Generation 0 · 2 alive');
		expect(body).not.toContain('lexicon-matrix-' + creatures[0].id);
		expect(body).toContain('lexicon-matrix-' + creatures[1].id);
	});
	it('states that the population is empty', () => {
		const { body } = render(PopulationLexicons, {
			props: { rows: [], generations: [], onNavigate: () => {} }
		});
		expect(body).toContain('No living creatures.');
		expect(body).not.toContain('data-testid="living-generation-');
	});
});
