import { describe, expect, it } from 'vitest';
import {
	arbitrate,
	createEmptyMemory,
	createSimulation,
	DEFAULT_COGNITION_CONFIG,
	defaultSimulationConfig,
	formatCreatureInspection,
	rememberHeardSignal,
	type ArbitrationInput
} from './index';
import { formatArbitrationDiagnostics } from './arbitration-diagnostics';

function rankedListener(overrides: Partial<ArbitrationInput> = {}) {
	const creature = createSimulation(defaultSimulationConfig('signal-text')).creatures[0]!;
	let memory = createEmptyMemory(16);
	for (const [emissionId, symbolId] of [
		['older-food', 'glyph-0'],
		['newer-unknown', 'glyph-2']
	] as const) {
		memory = rememberHeardSignal(memory, {
			emissionId,
			symbolId,
			origin: { x: 2, y: 3 },
			rememberedAt: memory.nextSequence
		});
	}
	const lastArbitration = arbitrate({
		timeSeconds: 5,
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
	});
	return { ...creature, memory, lastArbitration };
}

describe('arbitration diagnostics', () => {
	it('shows older relevant selection and every alternative with listener-local score evidence', () => {
		const creature = rankedListener();
		const before = JSON.stringify(creature);
		const text = formatCreatureInspection(creature, 5);
		expect(text).toContain(
			'retained signal evaluations: 2 (listener-local lexicon; unknown stays eligible)'
		);
		expect(text).toContain(
			'selected signal: emission=older-food symbol=glyph-0 origin=(2.000, 3.000) sequence=0 listener interpretation=food'
		);
		expect(text).toContain('alternative signal: emission=newer-unknown');
		expect(text).toContain('listener interpretation=unknown');
		expect(text.indexOf('selected signal: emission=older-food')).toBeLessThan(
			text.indexOf('alternative signal: emission=newer-unknown')
		);
		expect(text).toContain(
			'hunger=0.700 thirst=0.100 actionable food knowledge=none water knowledge=none'
		);
		expect(text).toContain(
			'optional=0.038 informationFloor=0.380 semantic=0.140 recency=0.000 score=0.520'
		);
		expect(text).toContain('ties use newest sequence, then emission ID ascending');
		expect(text).toContain('excludes intention continuity');
		expect(JSON.stringify(creature)).toBe(before);
	});

	it('does not report the chosen signal as the overall winner when rest wins', () => {
		const creature = rankedListener({ energy: 0.05 });
		const text = formatArbitrationDiagnostics(creature.lastArbitration).join('\n');
		expect(text).toContain('selected: rest');
		expect(text).toContain('selected signal: emission=older-food');
		expect(text).toContain('another intention may win arbitration');
	});

	it('reports suppression from available matching knowledge and tolerates absent snapshots', () => {
		const creature = rankedListener({
			availableFood: [{ featureId: 'food-0', resourceKind: 'food', position: { x: 0, y: 0 } }]
		});
		const text = formatArbitrationDiagnostics(creature.lastArbitration).join('\n');
		expect(text).toContain('actionable food knowledge=visible water knowledge=none');
		expect(text).toContain('informationFloor=0.000 semantic=0.000');
		expect(formatArbitrationDiagnostics(null).join('\n')).toContain('candidates:\n  (none)');
	});
});
