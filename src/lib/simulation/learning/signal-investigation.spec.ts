import { describe, expect, it } from 'vitest';
import type { HeardSignal } from '../communication/types';
import {
	distanceFalloffFactor,
	expirePendingSignals,
	insertPendingFromHeard,
	qualifyEvidenceNearOrigin,
	scoreInvestigationCandidate,
	selectBestPendingSignal
} from './signal-investigation';
import type { PendingSignal, SymbolAssociation } from './types';

const scoreConfig = {
	pendingSignalLifetimeSeconds: 10,
	investigationCuriosityWeight: 1,
	investigationDistanceScale: 8,
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
		expiresAt: 20,
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
			{ pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 2 }
		);
		expect(first).toHaveLength(1);
		expect(JSON.stringify(first[0])).not.toContain('contextDetail');

		const many = insertPendingFromHeard(
			first,
			[
				heard({ emissionId: 'em-2', heardAt: 2 }),
				heard({ emissionId: 'em-3', heardAt: 3 }),
				heard({ emissionId: 'em-4', heardAt: 4 })
			],
			{ pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 2 }
		);
		expect(many).toHaveLength(2);
		expect(many.map((p) => p.emissionId)).toEqual(['em-3', 'em-4']);
	});

	it('expires pending signals deterministically', () => {
		const list = [pending({ expiresAt: 5 }), pending({ emissionId: 'em-2', expiresAt: 10 })];
		expect(expirePendingSignals(list, 5)).toHaveLength(1);
		expect(expirePendingSignals(list, 5)[0]!.emissionId).toBe('em-2');
	});
});

describe('smooth distance falloff', () => {
	it('decreases continuously and never hard-zeros distant signals', () => {
		const scale = 8;
		const near = distanceFalloffFactor(0, scale);
		const mid = distanceFalloffFactor(8, scale);
		const far = distanceFalloffFactor(40, scale);
		const farther = distanceFalloffFactor(80, scale);
		expect(near).toBe(1);
		expect(mid).toBeCloseTo(0.5);
		expect(far).toBeGreaterThan(0);
		expect(farther).toBeGreaterThan(0);
		expect(farther).toBeLessThan(far);
		expect(far).toBeLessThan(mid);
		// No plateau: every larger distance is strictly smaller
		for (let d = 0; d < 50; d += 1) {
			expect(distanceFalloffFactor(d + 1, scale)).toBeLessThan(distanceFalloffFactor(d, scale));
		}
	});
});

describe('investigation scoring', () => {
	it('scores higher curiosity above lower curiosity for the same unknown signal', () => {
		const high = scoreInvestigationCandidate(
			{
				position: { x: 0, y: 0 },
				hunger: 0.2,
				thirst: 0.2,
				curiosity: 0.55,
				symbolAssociations: zeroAssociations
			},
			pending({ origin: { x: 1, y: 0 } }),
			1,
			scoreConfig
		);
		const low = scoreInvestigationCandidate(
			{
				position: { x: 0, y: 0 },
				hunger: 0.2,
				thirst: 0.2,
				curiosity: 0.3,
				symbolAssociations: zeroAssociations
			},
			pending({ origin: { x: 1, y: 0 } }),
			1,
			scoreConfig
		);
		expect(high.score).toBeGreaterThan(low.score);
		expect(high.curiosityTerm).toBeGreaterThan(low.curiosityTerm);
		expect(high.distanceFactor).toBeGreaterThan(0);
		expect(high.reason).toContain('distanceFactor');
		expect(high.reason).toContain('scale=');
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
			{
				position: { x: 0, y: 0 },
				hunger: 0.9,
				thirst: 0.1,
				curiosity: 0.35,
				symbolAssociations: foodAssoc
			},
			pending(),
			1,
			scoreConfig
		);
		const sated = scoreInvestigationCandidate(
			{
				position: { x: 0, y: 0 },
				hunger: 0.1,
				thirst: 0.1,
				curiosity: 0.35,
				symbolAssociations: foodAssoc
			},
			pending(),
			1,
			scoreConfig
		);
		expect(hungry.score).toBeGreaterThan(sated.score);
	});

	it('reduces attractiveness with distance while keeping distant factor positive', () => {
		const near = scoreInvestigationCandidate(
			{
				position: { x: 0, y: 0 },
				hunger: 0.2,
				thirst: 0.2,
				curiosity: 0.5,
				symbolAssociations: zeroAssociations
			},
			pending({ origin: { x: 1, y: 0 } }),
			1,
			scoreConfig
		);
		const far = scoreInvestigationCandidate(
			{
				position: { x: 0, y: 0 },
				hunger: 0.2,
				thirst: 0.2,
				curiosity: 0.5,
				symbolAssociations: zeroAssociations
			},
			pending({ origin: { x: 25, y: 0 } }),
			1,
			scoreConfig
		);
		expect(near.score).toBeGreaterThan(far.score);
		expect(far.distanceFactor).toBeGreaterThan(0);
		expect(far.score).toBeGreaterThan(0);
	});

	it('selects best pending with stable emissionId tie-break', () => {
		const best = selectBestPendingSignal(
			{
				position: { x: 0, y: 0 },
				hunger: 0.2,
				thirst: 0.2,
				curiosity: 0.45,
				symbolAssociations: zeroAssociations
			},
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
			tracked: null,
			activeEpisodes: [],
			episodeCounter: 0
		};
		const evidence = qualifyEvidenceNearOrigin(
			perception,
			{ x: 0, y: 0 },
			{ learningEvidenceRadius: 3 }
		);
		expect(evidence.foodFeatureIds).toEqual(['food-near']);
		expect(evidence.waterFeatureIds).toEqual(['water-near']);
	});
});
