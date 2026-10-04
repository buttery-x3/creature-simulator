import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import {
	arbitrate,
	createEmptyMemory,
	createSimulation,
	DEFAULT_COGNITION_CONFIG,
	defaultSimulationConfig,
	rememberHeardSignal,
	type ArbitrationInput,
	type Creature
} from '$lib/simulation';
import CreatureBehaviour from '../creatures/CreatureBehaviour.svelte';
import { buildCandidateViews, buildInvestigationSummary } from './creature-detail-view-model';
import {
	buildSignalEvaluationViews,
	SIGNAL_RANKING_EXPLANATION
} from './signal-evaluation-view-model';

function listener(overrides: Partial<ArbitrationInput> = {}): Creature {
	const creature = createSimulation(defaultSimulationConfig('signal-view')).creatures[0]!;
	let memory = createEmptyMemory(8);
	for (const [emissionId, symbolId] of [
		['older-food', 'glyph-0'],
		['newer-unknown', 'glyph-2']
	] as const) {
		memory = rememberHeardSignal(memory, {
			emissionId,
			symbolId,
			origin: { x: 1.25, y: -2.5 },
			rememberedAt: memory.nextSequence
		});
	}
	const input: ArbitrationInput = {
		timeSeconds: 10,
		trigger: 'periodic',
		position: creature.position,
		hunger: 0.7,
		thirst: 0.1,
		energy: 0.95,
		verbosity: 0,
		curiosity: 0,
		availableFood: [],
		availableWater: [],
		memory,
		lexicon: { food: 'glyph-0', water: 'glyph-1', danger: null },
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home-0',
		config: DEFAULT_COGNITION_CONFIG,
		...overrides
	};
	return {
		...creature,
		memory: input.memory,
		lexicon: { ...input.lexicon },
		lastArbitration: arbitrate(input)
	};
}

describe('signal evaluation presentation', () => {
	it('preserves older relevant selection while newest-heard remains the newer unknown signal', () => {
		const creature = listener();
		const before = JSON.stringify(creature);
		const rows = buildSignalEvaluationViews(creature);
		const summary = buildInvestigationSummary(creature, 10);
		expect(rows).toHaveLength(2);
		expect(summary?.newestHeardEmissionId).toBe('newer-unknown');
		expect(rows[0]).toMatchObject({
			emissionId: 'older-food',
			interpretation: 'food',
			interpretationLabel: 'food in this listener’s lexicon',
			selectionLabel: 'selected signal',
			originLabel: '(1.25, -2.50)',
			foodKnowledge: 'none',
			hungerPressure: 0.7,
			selected: true
		});
		expect(rows[0]!.semanticContribution).toBeCloseTo(0.14);
		expect(rows[0]!.score).toBeGreaterThan(rows[1]!.score);
		expect(rows[0]!.recencyBoost).toBeLessThan(rows[1]!.recencyBoost);
		expect(rows[1]).toMatchObject({
			interpretationLabel: 'unknown to this listener',
			selectionLabel: 'alternative signal',
			semanticContribution: 0,
			selected: false
		});
		const candidate = buildCandidateViews(creature, summary).find(
			(c) => c.intention === 'investigate_signal'
		);
		expect(candidate?.scoreTerms).toContainEqual({
			label: 'Listener semantic relevance',
			value: 0.2 * 0.7
		});
		expect(SIGNAL_RANKING_EXPLANATION).toBe(
			'Rank: highest score first; ties use newest sequence, then emission ID ascending.'
		);
		expect(JSON.stringify(creature)).toBe(before);
	});

	it('uses captured knowledge and interpretation rather than recomputing from current creature state', () => {
		const creature = listener({
			availableFood: [{ featureId: 'food-0', resourceKind: 'food', position: { x: 0, y: 0 } }]
		});
		creature.lexicon = { food: null, water: 'glyph-0', danger: null };
		creature.memory = createEmptyMemory(1);
		const rows = buildSignalEvaluationViews(creature);
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.emissionId === 'older-food')).toMatchObject({
			interpretation: 'food',
			foodKnowledge: 'visible',
			semanticContribution: 0,
			informationFloor: 0
		});
		rows[0]!.origin.x = 999;
		expect(
			creature.lastArbitration?.candidates.find((c) => c.intention === 'investigate_signal')
				?.signalEvaluations?.[0]?.origin.x
		).toBe(1.25);
	});

	it('handles absent and older arbitration snapshots without diagnostic rows', () => {
		const creature = listener();
		creature.lastArbitration = null;
		expect(buildSignalEvaluationViews(creature)).toEqual([]);
		const older = listener();
		for (const candidate of older.lastArbitration!.candidates) delete candidate.signalEvaluations;
		expect(buildSignalEvaluationViews(older)).toEqual([]);
	});

	it('renders each retained alternative and distinguishes its selection from the overall intention', () => {
		const creature = listener({ energy: 0.05 });
		expect(creature.lastArbitration?.selectedIntention).toBe('rest');
		const { body } = render(CreatureBehaviour, {
			props: { creature, investigation: buildInvestigationSummary(creature, 10) }
		});
		expect(body.match(/data-testid="inspector-signal-evaluation"/g)).toHaveLength(2);
		expect(body).toContain('older-food');
		expect(body).toContain('newer-unknown');
		expect(body).toContain('selected signal');
		expect(body).toContain('another intention can still win');
		expect(body).toContain('Semantic contribution');
		expect(body).toContain('actionable food knowledge: none');
		expect(body).toContain('emission ID ascending');
	});
});

it('labels learned danger as excluded from investigation using the saved interpretation', () => {
	const creature = listener({ lexicon: { food: null, water: null, danger: 'glyph-0' } });
	creature.lexicon = { food: 'glyph-0', water: null, danger: null };
	const warning = buildSignalEvaluationViews(creature).find((s) => s.emissionId === 'older-food')!;
	expect(warning.interpretationLabel).toBe('danger in this listener’s lexicon');
	expect(warning.selectionLabel).toContain('excluded from investigation');
	expect(warning.selected).toBe(false);
});
