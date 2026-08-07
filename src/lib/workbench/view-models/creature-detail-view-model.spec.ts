import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import {
	buildInvestigationOpportunitySummary,
	buildRosterRows,
	formatTargetLabel
} from './creature-detail-view-model';

describe('creature-detail-view-model', () => {
	it('builds roster rows with lexicon assignments', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		const rows = buildRosterRows(state.creatures);
		expect(rows).toHaveLength(state.creatures.length);
		expect(rows[0]).toMatchObject({
			id: expect.stringMatching(/^creature-/),
			goal: expect.any(String)
		});
	});

	it('formats targets without parsing prose diagnostics', () => {
		expect(formatTargetLabel(null)).toBe('none');
		expect(formatTargetLabel({ kind: 'feature', featureId: 'food-0', featureKind: 'food' })).toBe(
			'food:food-0'
		);
		expect(formatTargetLabel({ kind: 'point', position: { x: 1.5, y: -2 } })).toBe(
			'point (1.50, -2.00)'
		);
	});

	it('summarises curiosity opportunities without multi-factor score recipes', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		const creature = state.creatures[0]!;
		creature.pendingSignals = [
			{
				emissionId: 'e-1',
				symbolId: 'glyph-0',
				senderId: 'creature-1',
				origin: { x: 1, y: 1 },
				heardAt: 0,
				expiresAt: 100,
				curiosityDecision: 'accepted',
				curiosityEvidence: { curiosity: creature.curiosity, deterministicSample: 0.12 }
			}
		];
		const summary = buildInvestigationOpportunitySummary(creature, 1);
		expect(summary).not.toBeNull();
		expect(summary!.acceptedPendingCount).toBe(1);
		expect(summary!.recentDecision).toBe('accepted');
		expect(summary!.recentSample).toBeCloseTo(0.12);
		expect(summary!.eligibleEmissionId).toBe('e-1');
	});
});
