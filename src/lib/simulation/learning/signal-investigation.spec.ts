import { describe, expect, it } from 'vitest';
import { emptyPerception } from '../behaviour/perception';
import {
	appendLearningHistory,
	beginInvestigation,
	distanceFalloffFactor,
	isNearOrigin,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin
} from './signal-investigation';

describe('signal investigation helpers', () => {
	it('distanceFalloffFactor is smooth and finite', () => {
		expect(distanceFalloffFactor(0, 10)).toBeCloseTo(1);
		expect(distanceFalloffFactor(10, 10)).toBeCloseTo(0.5);
		expect(distanceFalloffFactor(100, 10)).toBeLessThan(0.1);
		expect(Number.isFinite(distanceFalloffFactor(-1, 0))).toBe(true);
	});

	it('beginInvestigation records emission without sender identity', () => {
		const active = beginInvestigation(
			{
				emissionId: 'em-1',
				symbolId: 'glyph-0',
				origin: { x: 2, y: 3 }
			},
			5
		);
		expect(active).toEqual({
			emissionId: 'em-1',
			symbolId: 'glyph-0',
			origin: { x: 2, y: 3 },
			startedAt: 5
		});
		expect(active).not.toHaveProperty('senderId');
	});

	it('qualifyEvidenceNearOrigin uses perception only', () => {
		const perception = {
			...emptyPerception(),
			lastUpdatedAt: 1,
			observations: [
				{
					featureId: 'food-1',
					featureKind: 'food' as const,
					position: { x: 0.5, y: 0 },
					observedAt: 1
				},
				{
					featureId: 'water-1',
					featureKind: 'water' as const,
					position: { x: 10, y: 0 },
					observedAt: 1
				}
			],
			perceivedFoodIds: ['food-1'],
			perceivedWaterIds: ['water-1']
		};
		const near = qualifyEvidenceNearOrigin(
			perception,
			{ x: 0, y: 0 },
			{
				learningEvidenceRadius: 2
			}
		);
		expect(near.food).toBe(true);
		expect(near.water).toBe(false);
		expect(near.foodFeatureIds).toEqual(['food-1']);
	});

	it('outcomeFromEvidenceFlags covers combinations', () => {
		expect(outcomeFromEvidenceFlags(true, false)).toBe('food_evidence');
		expect(outcomeFromEvidenceFlags(false, true)).toBe('water_evidence');
		expect(outcomeFromEvidenceFlags(true, true)).toBe('mixed_evidence');
		expect(outcomeFromEvidenceFlags(false, false)).toBe('no_evidence');
	});

	it('isNearOrigin uses arrival distance', () => {
		expect(isNearOrigin({ x: 0, y: 0 }, { x: 0.2, y: 0 }, 0.35)).toBe(true);
		expect(isNearOrigin({ x: 0, y: 0 }, { x: 2, y: 0 }, 0.35)).toBe(false);
	});

	it('appendLearningHistory bounds history', () => {
		const entry = {
			timeSeconds: 1,
			outcome: 'no_evidence' as const,
			symbolId: 'glyph-0' as const,
			emissionId: 'em-1',
			reason: 'test',
			foodStrengthBefore: 0,
			foodStrengthAfter: 0,
			waterStrengthBefore: 0,
			waterStrengthAfter: 0
		};
		const history = appendLearningHistory(
			[
				{ ...entry, timeSeconds: 0, emissionId: 'em-0' },
				{ ...entry, timeSeconds: 0.5, emissionId: 'em-0b' }
			],
			entry,
			2
		);
		expect(history).toHaveLength(2);
		expect(history[1]!.emissionId).toBe('em-1');
	});
});
