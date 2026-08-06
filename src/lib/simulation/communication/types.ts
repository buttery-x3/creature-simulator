/**
 * Communication subdomain types: arbitrary symbols, emissions, reception records.
 * Symbols have no global semantic meaning.
 */

import type { Vec2 } from '$lib/habitat';

/** Arbitrary symbol identity. Visual form is presentation-only; no built-in meaning. */
export type SymbolId = 'glyph-0' | 'glyph-1' | 'glyph-2' | 'glyph-3';

export const DEFAULT_SYMBOL_INVENTORY: readonly SymbolId[] = [
	'glyph-0',
	'glyph-1',
	'glyph-2',
	'glyph-3'
] as const;

/** Why an emission was requested (developer context — not symbol meaning). */
export type EmissionContext = 'resource_discovered';

export type ResourceDiscoveryDetail = 'food' | 'water';

/**
 * Authoritative transient signal event.
 * Plain serialisable; no Three.js/UI objects.
 */
export type SignalEmission = {
	id: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	emittedAt: number;
	expiresAt: number;
	/** Developer inspection context; must not be treated as symbol semantics. */
	context: EmissionContext;
	contextDetail: ResourceDiscoveryDetail;
	symbolSelectionReason: string;
};

/** Per-receiver record of a heard emission. Plain serialisable. */
export type HeardSignal = {
	emissionId: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	emittedAt: number;
	heardAt: number;
};

/**
 * Behaviour → communication handoff. Not stored on SimulationState.
 * Communication owns transmission, reception and lifetime.
 */
export type EmissionRequest = {
	senderId: string;
	origin: Vec2;
	context: EmissionContext;
	contextDetail: ResourceDiscoveryDetail;
};
