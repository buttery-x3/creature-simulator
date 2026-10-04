/** Personal bounded symbol evidence; no shared global dictionary. */
import type { SymbolId } from '../communication/types';
import {
	LEXICON_MEANINGS,
	type LexiconMeaning,
	type MeaningStrengths,
	type SymbolAssociation
} from './types';

/** Bounded independent danger-confirmation provenance per symbol. */
export const DANGER_EPISODE_HISTORY_LIMIT = 8;
export type AssociationClampConfig = {
	associationStrengthMin: number;
	associationStrengthMax: number;
};

/** Construct every declared meaning in its stable semantic order. */
export function mapMeanings<T>(value: (meaning: LexiconMeaning) => T): Record<LexiconMeaning, T> {
	return Object.fromEntries(LEXICON_MEANINGS.map((meaning) => [meaning, value(meaning)])) as Record<
		LexiconMeaning,
		T
	>;
}

export function clampStrength(value: number, config: AssociationClampConfig): number {
	if (!Number.isFinite(value)) return config.associationStrengthMin;
	return Math.max(config.associationStrengthMin, Math.min(config.associationStrengthMax, value));
}

export function emptyAssociation(symbolId: SymbolId): SymbolAssociation {
	return {
		symbolId,
		evidence: mapMeanings(() => ({ strength: 0, count: 0 })),
		dangerEvidenceEpisodes: []
	};
}

/** Every creature, symbol and meaning receives independent evidence objects. */
export function createEmptyAssociations(symbolInventory: readonly SymbolId[]): SymbolAssociation[] {
	return symbolInventory.map(emptyAssociation);
}

export function findAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId
): SymbolAssociation | undefined {
	return associations.find((row) => row.symbolId === symbolId);
}

export function getOrCreateAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId
): { associations: SymbolAssociation[]; association: SymbolAssociation; index: number } {
	const index = associations.findIndex((row) => row.symbolId === symbolId);
	if (index >= 0) {
		const row = associations[index]!;
		return {
			associations: [...associations],
			association: { ...row, evidence: mapMeanings((meaning) => ({ ...row.evidence[meaning] })) },
			index
		};
	}
	const association = emptyAssociation(symbolId);
	return { associations: [...associations, association], association, index: associations.length };
}

export function snapshotAssociationStrengths(row?: SymbolAssociation): MeaningStrengths {
	return mapMeanings((meaning) => row?.evidence[meaning].strength ?? 0);
}

export type ReinforceResult = {
	associations: SymbolAssociation[];
	before: MeaningStrengths;
	after: MeaningStrengths;
};

/** Only requested meanings change; danger requires an uncredited local episode. */
export function reinforceAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId,
	options: {
		meanings: Partial<Record<LexiconMeaning, boolean>>;
		dangerEpisodes?: readonly string[];
		amount: number;
	},
	config: AssociationClampConfig
): ReinforceResult {
	const { associations: next, association, index } = getOrCreateAssociation(associations, symbolId);
	const before = snapshotAssociationStrengths(association);
	const newEpisodes = (options.dangerEpisodes ?? [])
		.slice(0, DANGER_EPISODE_HISTORY_LIMIT)
		.filter((episode) => !association.dangerEvidenceEpisodes.includes(episode));
	for (const meaning of LEXICON_MEANINGS) {
		if (!options.meanings[meaning] || (meaning === 'danger' && newEpisodes.length === 0)) continue;
		const evidence = association.evidence[meaning];
		evidence.strength = clampStrength(evidence.strength + options.amount, config);
		evidence.count += 1;
	}
	if (options.meanings.danger && newEpisodes.length > 0) {
		association.dangerEvidenceEpisodes = [
			...association.dangerEvidenceEpisodes,
			...newEpisodes
		].slice(-DANGER_EPISODE_HISTORY_LIMIT);
	}
	next[index] = association;
	return { associations: next, before, after: snapshotAssociationStrengths(association) };
}

/** Existing arrival policy reduces all three physical meanings, when configured. */
export function applyNoEvidenceReduction(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId,
	amount: number,
	config: AssociationClampConfig
): ReinforceResult {
	const { associations: next, association, index } = getOrCreateAssociation(associations, symbolId);
	const before = snapshotAssociationStrengths(association);
	if (amount > 0) {
		for (const meaning of LEXICON_MEANINGS)
			association.evidence[meaning].strength = clampStrength(
				association.evidence[meaning].strength - amount,
				config
			);
	}
	next[index] = association;
	return { associations: next, before, after: snapshotAssociationStrengths(association) };
}
