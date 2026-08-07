import {
	createSimulation,
	defaultSimulationConfig,
	rememberResourceAnnouncement
} from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import {
	buildInvestigationOpportunitySummary,
	buildMemorySectionView,
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

	it('builds a structured memory section with capacity and entries', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		const creature = {
			...state.creatures[0]!,
			memory: rememberResourceAnnouncement(state.creatures[0]!.memory, {
				rememberedAt: 12.5,
				featureId: 'food-3',
				resourceKind: 'food',
				opportunityId: 'ann-0',
				emissionId: 'em-0'
			}),
			recentEmitted: [
				{
					id: 'em-0',
					symbolId: 'glyph-0' as const,
					senderId: state.creatures[0]!.id,
					origin: { x: 0, y: 0 },
					emittedAt: 12.5,
					expiresAt: 14,
					context: 'resource_discovered' as const,
					contextDetail: 'food' as const,
					symbolSelectionReason: 'test',
					selectionEvidence: {
						emissionContext: 'food' as const,
						selectedSymbolId: 'glyph-0' as const,
						assignedSymbolId: null,
						mode: 'exploratory' as const,
						candidates: [],
						sample: 0.1,
						usedFallback: false,
						reason: 'test'
					},
					provenance: null
				}
			]
		};
		const section = buildMemorySectionView(creature);
		expect(section.used).toBe(1);
		expect(section.capacity).toBe(creature.memory.capacity);
		expect(section.entries[0]).toMatchObject({
			kind: 'resource announcement',
			subjectId: 'food-3',
			symbolId: 'glyph-0',
			timeSeconds: 12.5,
			empty: null,
			positionLabel: null
		});
	});

	it('formats resource observations and heard signals', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		const creature = {
			...state.creatures[0]!,
			memory: {
				capacity: 8,
				nextSequence: 2,
				entries: [
					{
						kind: 'resource_observation' as const,
						sequence: 0,
						rememberedAt: 4,
						featureId: 'water-2',
						resourceKind: 'water' as const,
						position: { x: 1.25, y: -2.5 },
						empty: true
					},
					{
						kind: 'heard_signal' as const,
						sequence: 1,
						rememberedAt: 5,
						emissionId: 'em-7',
						symbolId: 'glyph-2' as const,
						origin: { x: 3, y: 4 }
					}
				]
			}
		};
		const section = buildMemorySectionView(creature);
		expect(section.entries).toHaveLength(2);
		// newest first
		expect(section.entries[0]).toMatchObject({
			kind: 'heard signal',
			subjectId: 'em-7',
			symbolId: 'glyph-2',
			positionLabel: '(3.0, 4.0)'
		});
		expect(JSON.stringify(section.entries[0])).not.toContain('sender');
		expect(section.entries[1]).toMatchObject({
			kind: 'resource observation empty',
			subjectId: 'water-2',
			empty: true,
			positionLabel: '(1.3, -2.5)'
		});
	});
});
