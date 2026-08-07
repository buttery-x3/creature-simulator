/**
 * Emission construction: preferred-symbol cold-start, cooldown, ids, bounded histories.
 * Context-sensitive emission selection lives in symbol-selection.ts.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type {
	EmissionProvenance,
	HeardSignal,
	SignalEmission,
	SymbolId,
	SymbolSelectionEvidence
} from './types';

export function appendBounded<T>(history: readonly T[], entry: T, limit: number): T[] {
	const next = [...history, entry];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

/**
 * Deterministic preferred symbol for a creature at creation.
 * Uses only seed + creature id — never resource kind or emission context.
 */
export function selectPreferredSymbol(
	simulationSeed: string,
	creatureId: string,
	inventory: readonly SymbolId[]
): SymbolId {
	if (inventory.length === 0) {
		throw new Error('symbol inventory must be non-empty');
	}
	const stream = deriveSeed(simulationSeed, 'communication', 'preferred-symbol', creatureId);
	const rng = createSeededRng(stream);
	const index = rng.nextInt(0, inventory.length - 1);
	return inventory[index]!;
}

export function canEmit(
	lastEmissionAt: number,
	timeSeconds: number,
	cooldownSeconds: number
): boolean {
	if (lastEmissionAt < 0) {
		return true;
	}
	return timeSeconds - lastEmissionAt >= cooldownSeconds;
}

export function nextEmissionId(senderId: string, emissionCount: number): string {
	return `em-${senderId}-${emissionCount}`;
}

export type BuildEmissionInput = {
	id: string;
	symbolId: SymbolId;
	senderId: string;
	origin: { x: number; y: number };
	emittedAt: number;
	lifetimeSeconds: number;
	context: SignalEmission['context'];
	contextDetail: SignalEmission['contextDetail'];
	symbolSelectionReason: string;
	selectionEvidence: SymbolSelectionEvidence;
	/** Hidden announcement provenance; never copied to HeardSignal. */
	provenance?: EmissionProvenance | null;
};

export function buildEmission(input: BuildEmissionInput): SignalEmission {
	return {
		id: input.id,
		symbolId: input.symbolId,
		senderId: input.senderId,
		origin: { x: input.origin.x, y: input.origin.y },
		emittedAt: input.emittedAt,
		expiresAt: input.emittedAt + input.lifetimeSeconds,
		context: input.context,
		contextDetail: input.contextDetail,
		symbolSelectionReason: input.symbolSelectionReason,
		selectionEvidence: input.selectionEvidence,
		provenance: input.provenance ?? null
	};
}

export function toHeardSignal(emission: SignalEmission, heardAt: number): HeardSignal {
	return {
		emissionId: emission.id,
		symbolId: emission.symbolId,
		senderId: emission.senderId,
		origin: { x: emission.origin.x, y: emission.origin.y },
		emittedAt: emission.emittedAt,
		heardAt
	};
}
