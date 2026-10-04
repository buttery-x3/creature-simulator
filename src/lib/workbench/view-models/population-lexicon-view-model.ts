/** Living personal assignments only; generation is observer genealogy, not transmission evidence. */
import {
	LEXICON_MEANINGS,
	type Creature,
	type CreatureLexicon,
	type LexiconMeaning,
	type SymbolId
} from '$lib/simulation';
import { evidenceRowCount } from './creature-detail-view-model';

export type LexiconMatrixRow = {
	creatureId: string;
	generation: number;
	lexicon: CreatureLexicon;
	evidenceCount: number;
};
export type GenerationMeaning = {
	meaning: LexiconMeaning;
	assignments: { symbolId: SymbolId; count: number }[];
	unassigned: number;
};
export type LivingGenerationLexicons = {
	generation: number;
	creatureCount: number;
	meanings: GenerationMeaning[];
};
export type PopulationLexiconViewModel = {
	lexiconMatrix: LexiconMatrixRow[];
	generations: LivingGenerationLexicons[];
};

export function buildPopulationLexiconViewModel(
	creatures: readonly Creature[]
): PopulationLexiconViewModel {
	const lexiconMatrix = creatures.map((creature) => ({
		creatureId: creature.id,
		generation: creature.lifecycle.generation,
		lexicon: { ...creature.lexicon },
		evidenceCount: evidenceRowCount(creature)
	}));
	const cohorts = new Map<number, LexiconMatrixRow[]>();
	for (const row of lexiconMatrix) {
		const cohort = cohorts.get(row.generation) ?? [];
		cohort.push(row);
		cohorts.set(row.generation, cohort);
	}
	const generations = [...cohorts.entries()]
		.sort(([a], [b]) => a - b)
		.map(([generation, rows]) => ({
			generation,
			creatureCount: rows.length,
			meanings: LEXICON_MEANINGS.map((meaning) => {
				const counts = new Map<SymbolId, number>();
				let unassigned = 0;
				for (const row of rows) {
					const symbolId = row.lexicon[meaning];
					if (symbolId === null) unassigned++;
					else counts.set(symbolId, (counts.get(symbolId) ?? 0) + 1);
				}
				return {
					meaning,
					unassigned,
					assignments: [...counts.entries()]
						.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
						.map(([symbolId, count]) => ({ symbolId, count }))
				};
			})
		}));
	return { lexiconMatrix, generations };
}
