import { describe, expect, it } from 'vitest';
import type { HeardSignal } from '../communication/types';
import {
	expirePendingSignals,
	insertPendingFromHeard,
	qualifyEvidenceNearOrigin,
	scoreInvestigationCandidate,
	selectBestPendingSignal
} from './signal-investigation';
import type { PendingSignal, SymbolAssociation } from './types';

const scoreConfig = {
	pendingSignalLifetimeSeconds: 6,
	investigationCuriosityBaseline: 0.4,
	investigationDistanceWeight: 0.15,
	investigationAgeWeight: 0.1
};

function heard(overrides: Partial<HeardSignal> = {}): HeardSignal {
	return {
		emissionId: 'em-1',
		symbolId: 'glyph-0',
		senderId: 'creature-0',
		origin: { x: 2, y: 0 },
		emittedAt: 1,
		heardAt: 1,
		...overrides
	};
}

function pending(overrides: Partial<PendingSignal> = {}): PendingSignal {
	return {
		emissionId: 'em-1',
		symbolId: 'glyph-0',
		senderId: 'creature-0',
		origin: { x: 2, y: 0 },
		heardAt: 1,
		expiresAt: 7,
		...overrides
	};
}

const zeroAssociations: SymbolAssociation[] = [
	{
		symbolId: 'glyph-0',
		foodStrength: 0,
		waterStrength: 0,
		foodEvidenceCount: 0,
		waterEvidenceCount: 0
	}
];

describe('pending signals', () => {
	it('creates deduplicated bounded pending candidates without contextDetail', () => {
		const first = insertPendingFromHeard(
			[],
			[heard(), heard({ emissionId: 'em-1', heardAt: 1.1 })],
			{ pendingSignalLifetimeSeconds: 6, maxPendingSignalsPerCreature: 2 }
		);
		expect(first).toHaveLength(1);
		expect(first[0]).not.toHaveProperty('contextDetail');
		expect(JSON.stringify(first[0])).not.toContain('contextDetail');
		expect(JSON.stringify(first[0])).not.toContain('food');

		const many = insertPendingFromHeard(
			first,
			[
				heard({ emissionId: 'em-2', heardAt: 2 }),
				heard({ emissionId: 'em-3', heardAt: 3 }),
				heard({ emissionId: 'em-4', heardAt: 4 })
			],
			{ pendingSignalLifetimeSeconds: 6, maxPendingSignalsPerCreature: 2 }
		);
		expect(many).toHaveLength(2);
		expect(many.map((p) => p.emissionId)).toEqual(['em-3', 'em-4']);
	});

	it('expires pending signals deterministically', () => {
		const list = [pending({ expiresAt: 5 }), pending({ emissionId: 'em-2', expiresAt: 10 })];
		expect(expirePendingSignals(list, 5)).toHaveLength(1);
		expect(expirePendingSignals(list, 5)[0]!.emissionId).toBe('em-2');
		expect(expirePendingSignals(list, 10)).toHaveLength(0);
	});
});

describe('investigation scoring', () => {
	it('gives unknown symbols a non-zero curiosity score', () => {
		const scored = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.2, thirst: 0.2, symbolAssociations: zeroAssociations },
			pending(),
			1,
			scoreConfig
		);
		expect(scored.score).toBeGreaterThan(0);
		expect(scored.score).toBeLessThanOrEqual(scoreConfig.investigationCuriosityBaseline);
	});

	it('scores food-associated symbols higher while hungry', () => {
		const foodAssoc: SymbolAssociation[] = [
			{
				symbolId: 'glyph-0',
				foodStrength: 0.8,
				waterStrength: 0,
				foodEvidenceCount: 2,
				waterEvidenceCount: 0
			}
		];
		const hungry = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.9, thirst: 0.1, symbolAssociations: foodAssoc },
			pending(),
			1,
			scoreConfig
		);
		const sated = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.1, thirst: 0.1, symbolAssociations: foodAssoc },
			pending(),
			1,
			scoreConfig
		);
		expect(hungry.score).toBeGreaterThan(sated.score);
	});

	it('scores water-associated symbols higher while thirsty', () => {
		const waterAssoc: SymbolAssociation[] = [
			{
				symbolId: 'glyph-0',
				foodStrength: 0,
				waterStrength: 0.8,
				foodEvidenceCount: 0,
				waterEvidenceCount: 2
			}
		];
		const thirsty = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.1, thirst: 0.9, symbolAssociations: waterAssoc },
			pending(),
			1,
			scoreConfig
		);
		const quenched = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.1, thirst: 0.1, symbolAssociations: waterAssoc },
			pending(),
			1,
			scoreConfig
		);
		expect(thirsty.score).toBeGreaterThan(quenched.score);
	});

	it('reduces score with age and distance', () => {
		const nearFresh = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.2, thirst: 0.2, symbolAssociations: zeroAssociations },
			pending({ origin: { x: 1, y: 0 }, heardAt: 1 }),
			1,
			scoreConfig
		);
		const farStale = scoreInvestigationCandidate(
			{ position: { x: 0, y: 0 }, hunger: 0.2, thirst: 0.2, symbolAssociations: zeroAssociations },
			pending({ origin: { x: 20, y: 0 }, heardAt: 1 }),
			6,
			scoreConfig
		);
		expect(nearFresh.score).toBeGreaterThan(farStale.score);
	});

	it('selects best pending with stable emissionId tie-break', () => {
		const best = selectBestPendingSignal(
			{ position: { x: 0, y: 0 }, hunger: 0.2, thirst: 0.2, symbolAssociations: zeroAssociations },
			[
				pending({ emissionId: 'em-b', origin: { x: 1, y: 0 } }),
				pending({ emissionId: 'em-a', origin: { x: 1, y: 0 } })
			],
			1,
			scoreConfig
		);
		expect(best?.pending.emissionId).toBe('em-a');
	});
});

describe('evidence qualification', () => {
	it('only qualifies perceived resources within the evidence radius', () => {
		const perception = {
			lastUpdatedAt: 1,
			perceivedFoodIds: ['food-near', 'food-far'],
			perceivedWaterIds: ['water-near'],
			observations: [
				{
					featureId: 'food-near',
					featureKind: 'food' as const,
					position: { x: 1, y: 0 },
					observedAt: 1
				},
				{
					featureId: 'food-far',
					featureKind: 'food' as const,
					position: { x: 10, y: 0 },
					observedAt: 1
				},
				{
					featureId: 'water-near',
					featureKind: 'water' as const,
					position: { x: 0.5, y: 0 },
					observedAt: 1
				}
			],
			tracked: null
		};
		const evidence = qualifyEvidenceNearOrigin(
			perception,
			{ x: 0, y: 0 },
			{
				learningEvidenceRadius: 3
			}
		);
		expect(evidence.food).toBe(true);
		expect(evidence.water).toBe(true);
		expect(evidence.foodFeatureIds).toEqual(['food-near']);
		expect(evidence.waterFeatureIds).toEqual(['water-near']);
	});
});
