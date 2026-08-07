import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ActiveSignalInvestigation, SignalEmission } from '$lib/simulation';
import { distanceFalloffFactor } from '$lib/simulation';
import {
	RING_BAND_THICKNESS,
	clearSignalPresentation,
	computeRingPresentation,
	createSignalPresentationResources,
	reconcileSignals,
	updateInvestigationOverlay,
	type SignalReconcileOptions
} from './signal-presentation';
import { getSymbolPresentation } from './symbol-presentation';

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
		},
		provenance: null
	};
}

function options(
	partial?: Partial<SignalReconcileOptions> & {
		positions?: Record<string, { x: number; y: number }>;
	}
): SignalReconcileOptions {
	return {
		hearingRadius: partial?.hearingRadius ?? 12,
		investigationDistanceScale: partial?.investigationDistanceScale ?? 8,
		creaturePositions: partial?.creaturePositions ?? partial?.positions ?? {}
	};
}

describe('reconcileSignals', () => {
	it('creates one bubble group per emission with the canonical shape and disposes expired', () => {
		const resources = createSignalPresentationResources();
		const positions = { 'creature-0': { x: 5, y: 6 } };
		reconcileSignals(
			resources,
			[emission('em-a', 'glyph-2'), emission('em-b')],
			1.2,
			options({ positions })
		);
		expect(resources.byId.size).toBe(2);
		const version = resources.structureVersion;
		expect(version).toBeGreaterThan(0);

		const groupA = resources.byId.get('em-a')!;
		expect(groupA.userData.shape).toBe(getSymbolPresentation('glyph-2').shape);
		const glyph = groupA.getObjectByName('em-a-glyph');
		expect(glyph).toBeTruthy();
		const bubble = groupA.getObjectByName('em-a-bubble');
		expect(bubble).toBeTruthy();

		// Same set: update in place
		reconcileSignals(
			resources,
			[emission('em-a', 'glyph-2'), emission('em-b')],
			1.5,
			options({ positions })
		);
		expect(resources.structureVersion).toBe(version);

		// Drop one emission (expired authoritatively)
		reconcileSignals(resources, [emission('em-a', 'glyph-2')], 2, options({ positions }));
		expect(resources.byId.size).toBe(1);
		expect(resources.byId.has('em-a')).toBe(true);
		expect(resources.structureVersion).toBeGreaterThan(version);

		clearSignalPresentation(resources);
		expect(resources.byId.size).toBe(0);
		expect(resources.ringGeometryById.size).toBe(0);
	});

	it('follows the sender presentation position for bubbles and keeps rings on emission origin', () => {
		const resources = createSignalPresentationResources();
		const positions = { 'creature-0': { x: 9, y: -3 } };
		const em = emission('em-follow');
		reconcileSignals(resources, [em], 1.5, options({ positions }));
		const group = resources.byId.get('em-follow')!;
		const bubbleAnchor = group.getObjectByName('em-follow-bubble-anchor')!;
		const ringAnchor = group.getObjectByName('em-follow-ring-anchor')!;
		expect(bubbleAnchor.position.x).toBeCloseTo(9);
		expect(bubbleAnchor.position.y).toBeCloseTo(-3);
		expect(ringAnchor.position.x).toBeCloseTo(em.origin.x);
		expect(ringAnchor.position.y).toBeCloseTo(em.origin.y);
		clearSignalPresentation(resources);
	});

	it('falls back to emission origin when the sender is missing', () => {
		const resources = createSignalPresentationResources();
		const em = emission('em-fallback');
		reconcileSignals(resources, [em], 1.5, options());
		const group = resources.byId.get('em-fallback')!;
		const bubbleAnchor = group.getObjectByName('em-fallback-bubble-anchor')!;
		expect(bubbleAnchor.position.x).toBeCloseTo(em.origin.x);
		expect(bubbleAnchor.position.y).toBeCloseTo(em.origin.y);
		clearSignalPresentation(resources);
	});

	it('derives ring max radius from hearingRadius and uses shared distance falloff for opacity', () => {
		const em = emission('em-ring');
		// Mid-life
		const midTime = (em.emittedAt + em.expiresAt) / 2;
		const small = computeRingPresentation(em, midTime, 4, 8);
		const large = computeRingPresentation(em, midTime, 20, 8);
		expect(large.outerRadius).toBeGreaterThan(small.outerRadius);
		expect(large.outerRadius).toBeCloseTo(0.5 * 20);
		expect(small.outerRadius).toBeCloseTo(0.5 * 4);

		const expectedFactor = distanceFalloffFactor(large.outerRadius, 8);
		expect(large.distanceFactor).toBeCloseTo(expectedFactor);
		expect(large.opacity).toBeCloseTo(0.55 * expectedFactor * (1 - large.lifetimeT));

		// At lifetime end, outer radius reaches hearingRadius.
		const end = computeRingPresentation(em, em.expiresAt, 12, 8);
		expect(end.outerRadius).toBeCloseTo(12);
		expect(end.opacity).toBeCloseTo(0);

		// Thickness constant: geometry band is RING_BAND_THICKNESS regardless of radius.
		const resources = createSignalPresentationResources();
		reconcileSignals(resources, [em], midTime, options({ hearingRadius: 30 }));
		const ring = resources.byId.get('em-ring')!.getObjectByName('em-ring-ring') as
			{ geometry: { parameters?: { innerRadius?: number; outerRadius?: number } } } | undefined;
		// RingGeometry stores parameters on the geometry in three.js
		const geom = resources.ringGeometryById.get('em-ring') as THREE.RingGeometry | undefined;
		void ring;
		expect(geom).toBeTruthy();
		const params = (geom as unknown as { parameters: { innerRadius: number; outerRadius: number } })
			.parameters;
		expect(params.outerRadius - params.innerRadius).toBeCloseTo(RING_BAND_THICKNESS, 5);
		expect(params.outerRadius - params.innerRadius).toBeLessThan(0.15);
		clearSignalPresentation(resources);
	});

	it('shows a presentation-only investigation overlay without requiring emissions', () => {
		const resources = createSignalPresentationResources();
		const investigation: ActiveSignalInvestigation = {
			emissionId: 'em-inv',
			symbolId: 'glyph-1',
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
