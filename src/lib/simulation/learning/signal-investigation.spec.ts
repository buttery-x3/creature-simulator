import { describe, expect, it } from 'vitest';
import type { HeardSignal } from '../communication/types';
import {
	decideCuriosityAcceptance,
	distanceFalloffFactor,
	expirePendingSignals,
	insertPendingFromHeard,
	qualifyEvidenceNearOrigin,
	selectBestAcceptedOpportunity
} from './signal-investigation';
import type { SignalInvestigationOpportunity } from './types';

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

function opportunity(
	overrides: Partial<SignalInvestigationOpportunity> = {}
): SignalInvestigationOpportunity {
	return {
		emissionId: 'em-1',
		symbolId: 'glyph-0',
		senderId: 'creature-0',
		origin: { x: 2, y: 0 },
		heardAt: 1,
		expiresAt: 20,
		curiosityDecision: 'accepted',
		curiosityEvidence: { curiosity: 0.5, deterministicSample: 0.2 },
		...overrides
	};
}

describe('pending signal opportunities', () => {
	it('creates deduplicated bounded opportunities with curiosity decisions', () => {
		const first = insertPendingFromHeard({
			pending: [],
			heardSignals: [heard(), heard({ emissionId: 'em-1', heardAt: 1.1 })],
			config: { pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 2 },
			simulationSeed: 'seed-a',
			listenerId: 'creature-1',
			curiosity: 1
		});
		expect(first).toHaveLength(1);
		expect(first[0]!.curiosityDecision).toBe('accepted');
		expect(JSON.stringify(first[0])).not.toContain('contextDetail');

		const many = insertPendingFromHeard({
			pending: first,
			heardSignals: [
				heard({ emissionId: 'em-2', heardAt: 2 }),
				heard({ emissionId: 'em-3', heardAt: 3 }),
				heard({ emissionId: 'em-4', heardAt: 4 })
			],
			config: { pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 2 },
			simulationSeed: 'seed-a',
			listenerId: 'creature-1',
			curiosity: 1
		});
		expect(many).toHaveLength(2);
		expect(many.map((p) => p.emissionId)).toEqual(['em-3', 'em-4']);
	});

	it('does not recompute curiosity when the same emission is ingested again', () => {
		const first = insertPendingFromHeard({
			pending: [],
			heardSignals: [heard()],
			config: { pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 4 },
			simulationSeed: 'seed-a',
			listenerId: 'creature-1',
			curiosity: 0.5
		});
		const sample = first[0]!.curiosityEvidence!.deterministicSample;
		const again = insertPendingFromHeard({
			pending: first,
			heardSignals: [heard({ heardAt: 9 })],
			config: { pendingSignalLifetimeSeconds: 10, maxPendingSignalsPerCreature: 4 },
			simulationSeed: 'seed-a',
			listenerId: 'creature-1',
			curiosity: 0.99
		});
		expect(again).toHaveLength(1);
		expect(again[0]!.curiosityEvidence!.deterministicSample).toBe(sample);
		expect(again[0]!.curiosityDecision).toBe(first[0]!.curiosityDecision);
	});

	it('expires pending signals deterministically', () => {
		const list = [
			opportunity({ expiresAt: 5 }),
			opportunity({ emissionId: 'em-2', expiresAt: 10 })
		];
		expect(expirePendingSignals(list, 5)).toHaveLength(1);
		expect(expirePendingSignals(list, 5)[0]!.emissionId).toBe('em-2');
	});
});

describe('curiosity acceptance', () => {
	it('rejects at curiosity 0 and accepts at curiosity 1 for the same emission', () => {
		const reject = decideCuriosityAcceptance('seed', 'creature-1', 'em-1', 0);
		const accept = decideCuriosityAcceptance('seed', 'creature-1', 'em-1', 1);
		expect(reject.decision).toBe('rejected');
		expect(accept.decision).toBe('accepted');
		// Same sample for same seed/listener/emission (only threshold differs).
		expect(reject.evidence.deterministicSample).toBe(accept.evidence.deterministicSample);
	});

	it('is deterministic across identical runs', () => {
		const a = decideCuriosityAcceptance('seed', 'creature-2', 'em-x', 0.5);
		const b = decideCuriosityAcceptance('seed', 'creature-2', 'em-x', 0.5);
		expect(a).toEqual(b);
	});

	it('varies across emission ids for mid-range curiosity', () => {
		const decisions = ['em-a', 'em-b', 'em-c', 'em-d', 'em-e', 'em-f', 'em-g', 'em-h'].map(
			(id) => decideCuriosityAcceptance('seed-mid', 'creature-3', id, 0.5).decision
		);
		expect(new Set(decisions).size).toBeGreaterThan(1);
	});

	it('does not include distance in curiosity evidence', () => {
		const near = decideCuriosityAcceptance('seed', 'listener', 'em-dist', 0.4);
		const far = decideCuriosityAcceptance('seed', 'listener', 'em-dist', 0.4);
		expect(near.evidence).toEqual(far.evidence);
		expect(Object.keys(near.evidence).sort()).toEqual(['curiosity', 'deterministicSample']);
	});
});

describe('accepted opportunity selection', () => {
	it('selects only accepted opportunities and prefers earliest heardAt', () => {
		const best = selectBestAcceptedOpportunity(
			[
				opportunity({
					emissionId: 'em-b',
					heardAt: 3,
					curiosityDecision: 'accepted'
				}),
				opportunity({
					emissionId: 'em-a',
					heardAt: 2,
					curiosityDecision: 'rejected'
				}),
				opportunity({
					emissionId: 'em-c',
					heardAt: 2,
					curiosityDecision: 'accepted'
				})
			],
			1,
			0.35
		);
		// earliest accepted is em-c at heardAt 2 (em-a rejected)
		expect(best?.opportunity.emissionId).toBe('em-c');
		expect(best?.score).toBe(0.35);
	});

	it('returns null when only rejected opportunities remain', () => {
		const best = selectBestAcceptedOpportunity(
			[opportunity({ curiosityDecision: 'rejected' })],
			1,
			0.35
		);
		expect(best).toBeNull();
	});
});

describe('smooth distance falloff (presentation only)', () => {
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
		for (let d = 0; d < 50; d += 1) {
			expect(distanceFalloffFactor(d + 1, scale)).toBeLessThan(distanceFalloffFactor(d, scale));
		}
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
