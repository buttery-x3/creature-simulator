import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMBOL_INVENTORY } from '$lib/simulation';
import {
	SYMBOL_PRESENTATIONS,
	formatSymbolLabel,
	getSymbolPresentation,
	hasSymbolPresentation,
	symbolColorCss
} from './symbol-presentation';

describe('symbol presentation registry', () => {
	it('resolves every default inventory symbol to a canonical shape and color', () => {
		const expectedShapes = {
			'glyph-0': 'star',
			'glyph-1': 'circle',
			'glyph-2': 'triangle',
			'glyph-3': 'square'
		} as const;

		for (const id of DEFAULT_SYMBOL_INVENTORY) {
			const entry = getSymbolPresentation(id);
			expect(entry.symbolId).toBe(id);
			expect(entry.shape).toBe(expectedShapes[id]);
			expect(Number.isFinite(entry.color)).toBe(true);
			expect(entry.label).toContain(id);
			expect(entry.mark.length).toBeGreaterThan(0);
			expect(hasSymbolPresentation(id)).toBe(true);
		}

		expect(SYMBOL_PRESENTATIONS).toHaveLength(DEFAULT_SYMBOL_INVENTORY.length);
		expect(SYMBOL_PRESENTATIONS.map((p) => p.symbolId)).toEqual([...DEFAULT_SYMBOL_INVENTORY]);
	});

	it('safely handles missing symbol presentation entries', () => {
		expect(hasSymbolPresentation('glyph-99')).toBe(false);
		const fallback = getSymbolPresentation('glyph-99');
		expect(fallback.mark).toBe('?');
		expect(fallback.label).toContain('glyph-99');
		expect(fallback.shape).toBe('circle');
		expect(formatSymbolLabel('glyph-99')).toBe('? glyph-99');
	});

	it('formats labels as mark plus stable id', () => {
		expect(formatSymbolLabel('glyph-0')).toBe('★ glyph-0');
		expect(formatSymbolLabel('glyph-1')).toBe('○ glyph-1');
		expect(formatSymbolLabel('glyph-2')).toBe('▲ glyph-2');
		expect(formatSymbolLabel('glyph-3')).toBe('■ glyph-3');
	});

	it('exposes CSS colors derived from the same registry colors', () => {
		expect(symbolColorCss('glyph-0')).toBe('#fbbf24');
		expect(symbolColorCss('glyph-1')).toBe('#34d399');
	});
});
