/**
 * Shared presentation metadata for arbitrary symbol ids.
 *
 * Shape and color are presentation-only identity cues and carry no built-in
 * resource meaning. Simulation communication never imports this module.
 */

import type { SymbolId } from '$lib/simulation';
import { DEFAULT_SYMBOL_INVENTORY } from '$lib/simulation';

export type SymbolShape = 'star' | 'circle' | 'triangle' | 'square';

export type SymbolPresentation = {
	symbolId: SymbolId;
	/** Short unicode mark used in text labels (e.g. "★ glyph-0"). */
	mark: string;
	/** Human-readable label: mark + stable id. */
	label: string;
	shape: SymbolShape;
	/** Three.js hex color; secondary reinforcement only. */
	color: number;
};

const PRESENTATION_BY_ID: Record<SymbolId, SymbolPresentation> = {
	'glyph-0': {
		symbolId: 'glyph-0',
		mark: '★',
		label: '★ glyph-0',
		shape: 'star',
		color: 0xfbbf24
	},
	'glyph-1': {
		symbolId: 'glyph-1',
		mark: '○',
		label: '○ glyph-1',
		shape: 'circle',
		color: 0x34d399
	},
	'glyph-2': {
		symbolId: 'glyph-2',
		mark: '▲',
		label: '▲ glyph-2',
		shape: 'triangle',
		color: 0x60a5fa
	},
	'glyph-3': {
		symbolId: 'glyph-3',
		mark: '■',
		label: '■ glyph-3',
		shape: 'square',
		color: 0xf472b6
	}
};

/** Canonical ordered registry for the default inventory (legend + tests). */
export const SYMBOL_PRESENTATIONS: readonly SymbolPresentation[] = DEFAULT_SYMBOL_INVENTORY.map(
	(id) => PRESENTATION_BY_ID[id]
);

const FALLBACK_PRESENTATION: SymbolPresentation = {
	symbolId: 'glyph-0',
	mark: '?',
	label: '? unknown',
	shape: 'circle',
	color: 0xffffff
};

/**
 * Resolve presentation metadata for a symbol id.
 * Known inventory ids return the canonical entry; unknown ids return a safe
 * neutral fallback so UI never crashes on unexpected strings.
 */
export function getSymbolPresentation(symbolId: string): SymbolPresentation {
	if (symbolId in PRESENTATION_BY_ID) {
		return PRESENTATION_BY_ID[symbolId as SymbolId];
	}
	return {
		...FALLBACK_PRESENTATION,
		label: `? ${symbolId}`,
		// Preserve the raw id for diagnostics without claiming a glyph mapping.
		symbolId: 'glyph-0'
	};
}

/** True when the id has a canonical registry entry. */
export function hasSymbolPresentation(symbolId: string): boolean {
	return symbolId in PRESENTATION_BY_ID;
}

/** Icon mark + stable id for compact text (e.g. "★ glyph-0"). */
export function formatSymbolLabel(symbolId: string): string {
	if (symbolId in PRESENTATION_BY_ID) {
		return PRESENTATION_BY_ID[symbolId as SymbolId].label;
	}
	return `? ${symbolId}`;
}

/** CSS hex string for Svelte (secondary color reinforcement). */
export function symbolColorCss(symbolId: string): string {
	const color = getSymbolPresentation(symbolId).color;
	return `#${color.toString(16).padStart(6, '0')}`;
}
