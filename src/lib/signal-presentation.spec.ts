import { describe, expect, it } from 'vitest';
import type { ActiveSignalInvestigation, SignalEmission } from '$lib/simulation';
import {
	clearSignalPresentation,
	createSignalPresentationResources,
	reconcileSignals,
	updateInvestigationOverlay
} from './signal-presentation';

function emission(id: string, symbolId: SignalEmission['symbolId'] = 'glyph-0'): SignalEmission {
	return {
		id,
		symbolId,
		senderId: 'creature-0',
		origin: { x: 1, y: 2 },
		emittedAt: 1,
		expiresAt: 2.5,
		context: 'resource_discovered',
		contextDetail: 'food',
		symbolSelectionReason: 'exploratory',
		selectionEvidence: {
			emissionContext: 'food',
			selectedSymbolId: symbolId,
			assignedSymbolId: null,
			mode: 'exploratory',
			candidates: [{ symbolId, eligible: true, note: 'selected_exploratory' }],
			sample: 0.5,
			usedFallback: false,
			reason: 'exploratory_prefer_unassigned'
		}
	};
}

describe('reconcileSignals', () => {
	it('creates meshes for new emissions and removes expired ones without habitat churn', () => {
		const resources = createSignalPresentationResources();
		reconcileSignals(resources, [emission('em-a'), emission('em-b')], 1.2);
		expect(resources.byId.size).toBe(2);
		const version = resources.structureVersion;
		expect(version).toBeGreaterThan(0);

		// Same set: update in place
		reconcileSignals(resources, [emission('em-a'), emission('em-b')], 1.5);
		expect(resources.structureVersion).toBe(version);

		// Drop one emission (expired authoritatively)
		reconcileSignals(resources, [emission('em-a')], 2);
		expect(resources.byId.size).toBe(1);
		expect(resources.byId.has('em-a')).toBe(true);
		expect(resources.structureVersion).toBeGreaterThan(version);

		clearSignalPresentation(resources);
		expect(resources.byId.size).toBe(0);
	});

	it('shows a presentation-only investigation overlay without requiring emissions', () => {
		const resources = createSignalPresentationResources();
		const investigation: ActiveSignalInvestigation = {
			emissionId: 'em-inv',
			symbolId: 'glyph-1',
			senderId: 'creature-0',
			origin: { x: 4, y: 2 },
			startedAt: 1
		};
		updateInvestigationOverlay(resources, {
			creaturePosition: { x: 0, y: 0 },
			investigation
		});
		expect(resources.investigationOverlay?.visible).toBe(true);
		updateInvestigationOverlay(resources, { creaturePosition: null, investigation: null });
		expect(resources.investigationOverlay?.visible).toBe(false);
		clearSignalPresentation(resources);
	});
});
