import { describe, expect, it } from 'vitest';
import { buildArbitrationInput } from '../../behaviour/build-arbitration-input';
import { createSimulation, defaultSimulationConfig } from '../../create-simulation';
import { rememberHeardSignal } from '../../memory';
import { testCreature } from '../../test-creature';
import { arbitrate } from '../arbitrate';
import { DEFAULT_COGNITION_CONFIG } from '../score-constants';
import { acuteNeedUrgency, scoreResourceNeed } from './need-priority';
import { nightRestWeight } from './physical-candidates';

const score = (pressure: number, source: 'visible' | 'remembered' | 'none') =>
	scoreResourceNeed(pressure, source, DEFAULT_COGNITION_CONFIG, 'thirst_pressure', []);

function fixture() {
	const config = defaultSimulationConfig('acute-needs');
	config.ecology.wildlifeCount = 0;
	const state = createSimulation(config);
	return buildArbitrationInput(
		testCreature({ hunger: 0.2, thirst: 1, energy: 1, verbosity: 0 }),
		state.habitat,
		config.ecology.dayLengthSeconds * 0.75,
		'periodic',
		config
	);
}

describe('acute need utility', () => {
	it('preserves subcritical quality weighting and its ordering even at saturated need', () => {
		for (const pressure of [0.45, 0.8, 0.9]) {
			expect(score(pressure, 'none').baseScore).toBeCloseTo(
				pressure * DEFAULT_COGNITION_CONFIG.targetQualitySearch
			);
			expect(acuteNeedUrgency(pressure)).toBe(0);
		}
		for (const pressure of [0.9, 0.95, 0.99, 1]) {
			expect(score(pressure, 'visible').baseScore).toBeGreaterThan(
				score(pressure, 'remembered').baseScore
			);
			expect(score(pressure, 'remembered').baseScore).toBeGreaterThan(
				score(pressure, 'none').baseScore
			);
		}
		expect(score(1, 'none').baseScore).toBeCloseTo(0.87);
		expect(score(1, 'none').factors).toContainEqual({ code: 'target_quality', value: 0.35 });
		expect(score(1, 'none').factors).toContainEqual({ code: 'acute_need_urgency', value: 1 });
	});

	it('increases smoothly without a discontinuous score jump at critical onset', () => {
		expect(score(0.900001, 'none').baseScore - score(0.9, 'none').baseScore).toBeLessThan(0.00001);
		let previous = score(0.9, 'none').baseScore;
		for (let i = 1; i <= 100; i++) {
			const next = score(0.9 + i / 1000, 'none').baseScore;
			expect(next).toBeGreaterThan(previous);
			previous = next;
		}
		expect(acuteNeedUrgency(1.1)).toBe(1);
	});

	it.each([false, true])(
		'beats an ongoing high-curiosity signal despite continuity (food interpretation %s)',
		(interpreted) => {
			const input = fixture();
			let memory = rememberHeardSignal(input.memory, {
				rememberedAt: 130,
				emissionId: 'old',
				symbolId: 'glyph-1',
				origin: { x: 1, y: 0 }
			});
			memory = rememberHeardSignal(memory, {
				rememberedAt: 134,
				emissionId: 'new',
				symbolId: 'glyph-0',
				origin: { x: 2, y: 0 }
			});
			const record = arbitrate({
				...input,
				hunger: 0.8,
				curiosity: 1,
				memory,
				currentIntention: 'investigate_signal',
				currentTarget: { kind: 'point', position: { x: 2, y: 0 } },
				lexicon: { food: interpreted ? 'glyph-0' : null, water: null, danger: null, approach: null }
			});
			expect(record.selectedIntention).toBe('satisfy_thirst');
			expect(
				record.candidates.find((candidate) => candidate.intention === 'investigate_signal')
					?.continuityAdjustment
			).toBeGreaterThan(0);
			expect(record.candidates.find((candidate) => candidate.intention === 'rest')?.valid).toBe(
				false
			);
		}
	);

	it('lets extreme uncertainty compete with a less urgent visible resource', () => {
		const input = fixture();
		expect(
			arbitrate({
				...input,
				hunger: 1,
				thirst: 0.75,
				availableWater: [{ featureId: 'water', resourceKind: 'water', position: input.position }]
			}).selectedIntention
		).toBe('satisfy_hunger');
	});

	it('keeps immediate severe danger competitive instead of forcing acute thirst', () => {
		const input = fixture();
		const record = arbitrate({
			...input,
			physical: {
				...input.physical!,
				wildlife: [
					{
						id: 'predator',
						position: { x: 0.5, y: 0 },
						size: 2,
						physicality: 2,
						health: 1,
						energy: 1,
						foodAmount: 0,
						observedAt: input.timeSeconds,
						firstObservedAt: input.timeSeconds
					}
				]
			}
		});
		expect(record.selectedIntention).toBe('flee');
	});

	it('tapers nighttime preference to zero at full energy without erasing night influence', () => {
		const input = fixture();
		expect(nightRestWeight(input)).toBe(0);
		expect(nightRestWeight({ ...input, energy: 0.9 })).toBeGreaterThan(0);
		expect(nightRestWeight({ ...input, energy: 0.9 })).toBeLessThan(
			nightRestWeight({ ...input, energy: 0.8 })
		);
		expect(
			nightRestWeight({
				...input,
				timeSeconds: input.physical!.ecology.dayLengthSeconds / 4,
				energy: 0.8
			})
		).toBe(0);
	});
});
