/**
 * Personal symbol association init, clamp and reinforcement.
 * Deterministic bounded additive updates; no shared global dictionary.
 */

import type { SymbolId } from '../communication/types';
import type { SymbolAssociation } from './types';

/** Bounded independent danger-confirmation provenance per symbol. */
export const DANGER_EPISODE_HISTORY_LIMIT = 8;

export type AssociationClampConfig = {
	associationStrengthMin: number;
	associationStrengthMax: number;
};

export function clampStrength(value: number, config: AssociationClampConfig): number {
	if (!Number.isFinite(value)) {
		return config.associationStrengthMin;
	}
	return Math.max(config.associationStrengthMin, Math.min(config.associationStrengthMax, value));
}

/** One empty association row for a symbol (no semantic knowledge). */
export function emptyAssociation(symbolId: SymbolId): SymbolAssociation {
	return {
		symbolId,
		foodStrength: 0,
		waterStrength: 0,
		dangerStrength: 0,
		foodEvidenceCount: 0,
		waterEvidenceCount: 0,
		dangerEvidenceCount: 0,
		dangerEvidenceEpisodes: []
	};
}

/**
 * Fresh independent association array for every configured symbol.
 * Callers must not share the returned array or row objects across creatures.
 */
export function createEmptyAssociations(symbolInventory: readonly SymbolId[]): SymbolAssociation[] {
	return symbolInventory.map((symbolId) => emptyAssociation(symbolId));
}

export function findAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId
): SymbolAssociation | undefined {
	return associations.find((a) => a.symbolId === symbolId);
}

export function getOrCreateAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId
): { associations: SymbolAssociation[]; association: SymbolAssociation; index: number } {
	const index = associations.findIndex((a) => a.symbolId === symbolId);
	if (index >= 0) {
		const association = associations[index]!;
		return { associations: [...associations], association: { ...association }, index };
	}
	const association = emptyAssociation(symbolId);
	return {
		associations: [...associations, association],
		association,
		index: associations.length
	};
}

export type ReinforceResult = {
	associations: SymbolAssociation[];
	foodStrengthBefore: number;
	foodStrengthAfter: number;
	waterStrengthBefore: number;
	waterStrengthAfter: number;
	dangerStrengthBefore: number;
	dangerStrengthAfter: number;
};

/**
 * Strengthen food and/or water association for a symbol (bounded additive).
 * Only the kinds with `reinforceFood` / `reinforceWater` true are updated.
 */
export function reinforceAssociation(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId,
	options: {
		reinforceFood: boolean;
		reinforceWater: boolean;
		reinforceDanger?: boolean;
		dangerEpisodes?: readonly string[];
		amount: number;
	},
	config: AssociationClampConfig
): ReinforceResult {
	const { associations: next, association, index } = getOrCreateAssociation(associations, symbolId);
	const foodStrengthBefore = association.foodStrength;
	const waterStrengthBefore = association.waterStrength;
	const dangerStrengthBefore = association.dangerStrength;

	if (options.reinforceFood) {
		association.foodStrength = clampStrength(association.foodStrength + options.amount, config);
		association.foodEvidenceCount += 1;
	}
	if (options.reinforceWater) {
		association.waterStrength = clampStrength(association.waterStrength + options.amount, config);
		association.waterEvidenceCount += 1;
	}

	const newEpisodes = (options.dangerEpisodes ?? [])
		.slice(0, DANGER_EPISODE_HISTORY_LIMIT)
		.filter((episode) => !association.dangerEvidenceEpisodes.includes(episode));
	if (options.reinforceDanger && newEpisodes.length > 0) {
		association.dangerStrength = clampStrength(association.dangerStrength + options.amount, config);
		association.dangerEvidenceCount += 1;
		association.dangerEvidenceEpisodes = [
			...association.dangerEvidenceEpisodes,
			...newEpisodes
		].slice(-DANGER_EPISODE_HISTORY_LIMIT);
	}

	next[index] = association;
	return {
		associations: next,
		foodStrengthBefore,
		foodStrengthAfter: association.foodStrength,
		waterStrengthBefore,
		waterStrengthAfter: association.waterStrength,
		dangerStrengthBefore,
		dangerStrengthAfter: association.dangerStrength
	};
}

/**
 * Optional mild confidence reduction when an investigation ends with no evidence.
 * Default config uses amount 0 (associations unchanged).
 */
export function applyNoEvidenceReduction(
	associations: readonly SymbolAssociation[],
	symbolId: SymbolId,
	amount: number,
	config: AssociationClampConfig
): ReinforceResult {
	const { associations: next, association, index } = getOrCreateAssociation(associations, symbolId);
	const foodStrengthBefore = association.foodStrength;
	const waterStrengthBefore = association.waterStrength;
	const dangerStrengthBefore = association.dangerStrength;

	if (amount > 0) {
		association.foodStrength = clampStrength(association.foodStrength - amount, config);
		association.waterStrength = clampStrength(association.waterStrength - amount, config);
		association.dangerStrength = clampStrength(association.dangerStrength - amount, config);
	}

	next[index] = association;
	return {
		associations: next,
		foodStrengthBefore,
		foodStrengthAfter: association.foodStrength,
		waterStrengthBefore,
		waterStrengthAfter: association.waterStrength,
		dangerStrengthBefore,
		dangerStrengthAfter: association.dangerStrength
	};
}
