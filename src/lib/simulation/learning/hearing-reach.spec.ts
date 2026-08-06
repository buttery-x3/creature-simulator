import { describe, expect, it } from 'vitest';
import { selectReceivers } from '../communication/reception';
import type { SignalEmission } from '../communication/types';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';

const emission = (origin: { x: number; y: number }): SignalEmission => ({
	id: 'em-reach',
	symbolId: 'glyph-0',
	senderId: 'creature-0',
	origin,
	emittedAt: 1,
	expiresAt: 2.5,
	context: 'resource_discovered',
	contextDetail: 'food',
	symbolSelectionReason: 'exploratory',
	selectionEvidence: {
		emissionContext: 'food',
		selectedSymbolId: 'glyph-0',
		assignedSymbolId: null,
		mode: 'exploratory',
		candidates: [{ symbolId: 'glyph-0', eligible: true, note: 'selected_exploratory' }],
		sample: 0.5,
		usedFallback: false,
		reason: 'exploratory_prefer_unassigned'
	}
});

describe('finite hearing radius default', () => {
	it('reaches a meaningful portion of a 20×20 habitat without being global', () => {
		const radius = DEFAULT_SIMULATION_CONFIG.hearingRadius;
		expect(radius).toBe(12);
		expect(radius).toBeGreaterThan(DEFAULT_SIMULATION_CONFIG.sensingRadius);
		// Not structural global: corner-to-corner of 20×20 is ~28 > 12
		expect(radius).toBeLessThan(28);

		const receivers = selectReceivers(
			emission({ x: 0, y: 0 }),
			[
				{ id: 'creature-0', position: { x: 0, y: 0 } },
				{ id: 'near', position: { x: 10, y: 0 } },
				{ id: 'edge', position: { x: 11.5, y: 0 } },
				{ id: 'outside', position: { x: 13, y: 0 } }
			],
			radius
		);
		const ids = receivers.map((r) => r.id);
		expect(ids).toContain('near');
		expect(ids).toContain('edge');
		expect(ids).not.toContain('outside');
		expect(ids).not.toContain('creature-0'); // sender excluded
	});

	it('still excludes creatures outside the configured radius', () => {
		const receivers = selectReceivers(
			emission({ x: 0, y: 0 }),
			[{ id: 'far', position: { x: 15, y: 0 } }],
			DEFAULT_SIMULATION_CONFIG.hearingRadius
		);
		expect(receivers).toHaveLength(0);
	});
});
