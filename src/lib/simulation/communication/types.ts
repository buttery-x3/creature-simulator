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

/** How the emitter chose its symbol (developer diagnostics only). */
export type SymbolSelectionMode =
	| 'learned_lexicon'
	| 'exploratory'
	| 'fallback_preferred'
	| 'fallback_inventory';

/**
 * Per-candidate notes used when selecting an emission symbol.
 * Developer diagnostics only — never part of listener-facing HeardSignal.
 */
export type SymbolSelectionCandidateEvidence = {
	symbolId: SymbolId;
	/** Whether this symbol was eligible in the selection pool. */
	eligible: boolean;
	/** Short reason: assigned_context | assigned_other | unassigned | selected | … */
	note: string;
};

/**
 * Structured evidence for deterministic context-sensitive symbol selection.
 * Authoritative developer diagnostics; not a global dictionary entry.
 */
export type SymbolSelectionEvidence = {
	/** Resource context that drove selection (food vs water lexicon slot). */
	emissionContext: ResourceDiscoveryDetail;
	selectedSymbolId: SymbolId;
	/** Learned lexicon assignment for this context at emit time (null if unassigned). */
	assignedSymbolId: SymbolId | null;
	mode: SymbolSelectionMode;
	candidates: SymbolSelectionCandidateEvidence[];
	/** Uniform sample in [0, 1) for exploratory multi-symbol pick; null otherwise. */
	sample: number | null;
	usedFallback: boolean;
	/** Machine-readable reason string. */
	reason: string;
};

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
	/** Concise human-readable selection summary for lists/diagnostics. */
	symbolSelectionReason: string;
	/** Full selection evidence for inspection; never heard by listeners. */
	selectionEvidence: SymbolSelectionEvidence;
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
