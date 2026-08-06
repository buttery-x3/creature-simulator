/**
 * Context-sensitive deterministic symbol selection for emission.
 *
 * Uses the emitter's existing personal association strengths for the discovered
 * resource context (food → foodStrength, water → waterStrength) plus a configurable
 * exploration floor. There is no separate production-weight table and no speaker
 * success feedback.
 *
 * Algorithm (stable inventory order):
 * 1. For each symbol in inventory order:
 *    learnedStrength = association row strength for context (missing/non-finite → 0)
 *    effectiveWeight = max(0, explorationFloor + multiplier * learnedStrength)
 * 2. If sum(effectiveWeight) is not finite or ≤ 0 → fallback preferred (else first inventory)
 * 3. Else sample u ∈ [0,1) from seeded RNG and pick first candidate whose cumulative
 *    weight ≥ u * sum (inventory order breaks ties)
 *
 * Seed stream:
 *   deriveSeed(simulationSeed, 'communication', 'context-symbol', creatureId,
 *              String(emissionCount), contextDetail)
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type {
	ResourceDiscoveryDetail,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence
} from './types';

/** Minimal association row — data only; no learning module import. */
export type AssociationStrengthRow = {
	symbolId: SymbolId;
	foodStrength: number;
	waterStrength: number;
};

export type SymbolSelectionConfig = {
	emissionExplorationFloor: number;
	emissionAssociationWeightMultiplier: number;
};

export type SelectContextSymbolInput = {
	simulationSeed: string;
	creatureId: string;
	emissionCount: number;
	contextDetail: ResourceDiscoveryDetail;
	inventory: readonly SymbolId[];
	associations: readonly AssociationStrengthRow[];
	preferredSymbolId: SymbolId;
	config: SymbolSelectionConfig;
};

export type SelectContextSymbolResult = {
	symbolId: SymbolId;
	evidence: SymbolSelectionEvidence;
	/** Concise reason string for emission.symbolSelectionReason. */
	reasonText: string;
};

function learnedStrengthForContext(
	row: AssociationStrengthRow | undefined,
	contextDetail: ResourceDiscoveryDetail
): number {
	if (!row) {
		return 0;
	}
	const raw = contextDetail === 'food' ? row.foodStrength : row.waterStrength;
	if (!Number.isFinite(raw) || raw < 0) {
		return 0;
	}
	return raw;
}

/**
 * Build effective emission weights for a context from association strengths.
 * Reuses association values directly (no separate production table).
 */
export function buildEmissionWeights(
	inventory: readonly SymbolId[],
	associations: readonly AssociationStrengthRow[],
	contextDetail: ResourceDiscoveryDetail,
	config: SymbolSelectionConfig
): SymbolSelectionCandidateEvidence[] {
	const byId = new Map(associations.map((a) => [a.symbolId, a]));
	const floor = config.emissionExplorationFloor;
	const multiplier = config.emissionAssociationWeightMultiplier;

	return inventory.map((symbolId) => {
		const learnedStrength = learnedStrengthForContext(byId.get(symbolId), contextDetail);
		const raw = floor + multiplier * learnedStrength;
		const effectiveWeight = Number.isFinite(raw) && raw > 0 ? raw : 0;
		return {
			symbolId,
			learnedStrength,
			explorationFloor: floor,
			effectiveWeight
		};
	});
}

function formatReasonText(evidence: SymbolSelectionEvidence): string {
	if (evidence.usedFallback) {
		return `${evidence.reason} (${evidence.selectedSymbolId}, context=${evidence.emissionContext})`;
	}
	return `weighted_association context=${evidence.emissionContext} sample=${evidence.sample?.toFixed(4) ?? 'n/a'}`;
}

/**
 * Deterministic weighted symbol selection for a resource-discovery emission.
 */
export function selectContextSymbol(input: SelectContextSymbolInput): SelectContextSymbolResult {
	const {
		simulationSeed,
		creatureId,
		emissionCount,
		contextDetail,
		inventory,
		associations,
		preferredSymbolId,
		config
	} = input;

	if (inventory.length === 0) {
		throw new Error('symbol inventory must be non-empty for context-sensitive emission');
	}

	const candidates = buildEmissionWeights(inventory, associations, contextDetail, config);
	const totalWeight = candidates.reduce((sum, c) => sum + c.effectiveWeight, 0);

	if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
		const fallbackInInventory = inventory.includes(preferredSymbolId);
		const selectedSymbolId = fallbackInInventory ? preferredSymbolId : inventory[0]!;
		const evidence: SymbolSelectionEvidence = {
			emissionContext: contextDetail,
			selectedSymbolId,
			candidates,
			sample: null,
			usedFallback: true,
			reason: fallbackInInventory ? 'fallback_preferred' : 'fallback_inventory'
		};
		return {
			symbolId: selectedSymbolId,
			evidence,
			reasonText: formatReasonText(evidence)
		};
	}

	const stream = deriveSeed(
		simulationSeed,
		'communication',
		'context-symbol',
		creatureId,
		String(emissionCount),
		contextDetail
	);
	const rng = createSeededRng(stream);
	const sample = rng.next();
	const target = sample * totalWeight;

	let cumulative = 0;
	let selectedSymbolId = candidates[candidates.length - 1]!.symbolId;
	for (const candidate of candidates) {
		cumulative += candidate.effectiveWeight;
		if (cumulative >= target) {
			selectedSymbolId = candidate.symbolId;
			break;
		}
	}

	const evidence: SymbolSelectionEvidence = {
		emissionContext: contextDetail,
		selectedSymbolId,
		candidates,
		sample,
		usedFallback: false,
		reason: 'weighted_association'
	};

	return {
		symbolId: selectedSymbolId,
		evidence,
		reasonText: formatReasonText(evidence)
	};
}
