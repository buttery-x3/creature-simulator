import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import { buildCommunicationViewModel } from './communication-view-model';

describe('buildCommunicationViewModel', () => {
	it('marks lifetime funnel stages unavailable and labels recent-window stages', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		const vm = buildCommunicationViewModel(state, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		});

		const discoveries = vm.funnel.find((s) => s.id === 'resource_discoveries');
		expect(discoveries?.availability).toBe('unavailable');
		expect(discoveries?.value).toBeNull();

		const active = vm.funnel.find((s) => s.id === 'active_emissions');
		expect(active?.availability).toBe('available');
		expect(active?.value).toBe(state.activeEmissions.length);

		const received = vm.funnel.find((s) => s.id === 'signals_received');
		expect(received?.availability).toBe('recent_window');
		expect(received?.note).toMatch(/not lifetime/i);
	});

	it('builds one lexicon matrix row per creature', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		const vm = buildCommunicationViewModel(state, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		});
		expect(vm.lexiconMatrix).toHaveLength(state.creatures.length);
		expect(vm.population.creatureCount).toBe(state.creatures.length);
	});

	it('exposes announcement memory counts and active execution triggers', () => {
		const config = defaultSimulationConfig('demo');
		const state = createSimulation(config);
		const vm = buildCommunicationViewModel(state, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		});
		expect(vm.announcementMemorySummaries).toHaveLength(state.creatures.length);
		expect(vm.announcementMemorySummaries[0]).toMatchObject({
			creatureId: state.creatures[0]!.id,
			announcementMemoryCount: 0,
			activeTriggerFeatureId: null,
			activeState: null
		});
	});
});

it('counts direct danger learning without describing it as a completed investigation', () => {
	const config = defaultSimulationConfig('danger-view');
	const state = createSimulation(config);
	const creature = state.creatures[0]!;
	creature.lexicon.danger = 'glyph-2';
	creature.symbolAssociations[0]!.dangerEvidenceCount = 2;
	creature.recentLearning = [
		{
			timeSeconds: 2,
			outcome: 'danger_evidence',
			symbolId: 'glyph-2',
			emissionId: 'e-danger',
			reason: 'direct local evidence',
			foodStrengthBefore: 0,
			foodStrengthAfter: 0,
			waterStrengthBefore: 0,
			waterStrengthAfter: 0,
			dangerStrengthBefore: 0,
			dangerStrengthAfter: 0.3
		}
	];
	const vm = buildCommunicationViewModel(state, config);
	expect(vm.lexiconMatrix[0]?.dangerSymbolId).toBe('glyph-2');
	expect(vm.lexiconMatrix[0]?.evidenceCount).toBe(2);
	expect(vm.completedOutcomes.danger_evidence).toBe(1);
	expect(vm.funnel.find((f) => f.id === 'investigations_completed')?.label).toBe(
		'Learning outcomes'
	);
	expect(vm.funnel.find((f) => f.id === 'clear_evidence')?.value).toBe(1);
});
