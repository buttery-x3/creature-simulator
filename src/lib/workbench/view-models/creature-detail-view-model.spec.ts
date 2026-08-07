import {
	createSimulation,
	defaultSimulationConfig,
	scoreInvestigationCandidate
} from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import {
	buildInvestigationScoreBreakdown,
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

	it('exposes labelled investigation score terms from structured scorer output', () => {
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
				expiresAt: 100
			}
		];
		const breakdown = buildInvestigationScoreBreakdown(creature, 1, {
			pendingSignalLifetimeSeconds: config.pendingSignalLifetimeSeconds,
			investigationCuriosityWeight: config.investigationCuriosityWeight,
			investigationDistanceScale: config.investigationDistanceScale,
			investigationAgeWeight: config.investigationAgeWeight
		});
		expect(breakdown).not.toBeNull();
		expect(breakdown!.terms.map((t) => t.label)).toEqual([
			'Curiosity contribution',
			'Resource bias',
			'Distance factor',
			'Age penalty'
		]);
		const direct = scoreInvestigationCandidate(creature, creature.pendingSignals[0]!, 1, {
			pendingSignalLifetimeSeconds: config.pendingSignalLifetimeSeconds,
			investigationCuriosityWeight: config.investigationCuriosityWeight,
			investigationDistanceScale: config.investigationDistanceScale,
			investigationAgeWeight: config.investigationAgeWeight
		});
		expect(breakdown!.totalScore).toBeCloseTo(direct.score, 10);
	});
});
