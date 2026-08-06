import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import { testCreature } from '../test-creature';
import { emptyPerception } from '../behaviour/perception';
import {
	advanceActiveLearning,
	ingestHeardIntoPending,
	interruptInvestigation
} from './step-signal-learning';
import { beginInvestigation } from './signal-investigation';
import type { PendingSignal } from './types';

const learningConfig = {
	pendingSignalLifetimeSeconds: 6,
	maxPendingSignalsPerCreature: 4,
	investigationDurationSeconds: 8,
	learningEvidenceRadius: 3,
	associationReinforcement: 0.25,
	noEvidenceConfidenceReduction: 0,
	learningHistoryLimit: 8,
	associationStrengthMin: 0,
	associationStrengthMax: 1,
	arrivalDistance: 0.35
};

describe('step signal learning', () => {
	it('ingests newly heard signals into pending without resource context', () => {
		const creature = testCreature({
			recentHeard: [
				{
					emissionId: 'em-1',
					symbolId: 'glyph-1',
					senderId: 'creature-9',
					origin: { x: 3, y: 1 },
					emittedAt: 2,
					heardAt: 2
				}
			]
		});
		const next = ingestHeardIntoPending(creature, 2, learningConfig);
		expect(next.pendingSignals).toHaveLength(1);
		expect(next.pendingSignals[0]!.emissionId).toBe('em-1');
		expect(JSON.stringify(next.pendingSignals[0])).not.toContain('contextDetail');

		// Already pending: no duplicate
		const again = ingestHeardIntoPending(next, 2, learningConfig);
		expect(again.pendingSignals).toHaveLength(1);
	});

	it('strengthens only the listener food association from near-origin food evidence', () => {
		const pending: PendingSignal = {
			emissionId: 'em-1',
			symbolId: 'glyph-2',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 10
		};
		const active = beginInvestigation(pending, 1, 8);
		const creature = testCreature({
			position: { x: 0.1, y: 0 },
			activeInvestigation: active,
			perception: {
				...emptyPerception(),
				lastUpdatedAt: 1.5,
				perceivedFoodIds: ['food-1'],
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 0.2, y: 0 },
						observedAt: 1.5
					}
				]
			}
		});
		const other = testCreature({ id: 'creature-1' });
		const next = advanceActiveLearning(creature, 1.5, learningConfig);
		const assoc = next.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!;
		expect(assoc.foodStrength).toBe(0.25);
		expect(assoc.waterStrength).toBe(0);
		expect(assoc.foodEvidenceCount).toBe(1);
		expect(other.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!.foodStrength).toBe(0);
		expect(next.recentLearning.at(-1)?.outcome).toBe('food_evidence');
	});

	it('strengthens water and allows mixed evidence', () => {
		const pending: PendingSignal = {
			emissionId: 'em-2',
			symbolId: 'glyph-0',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 10
		};
		const creature = testCreature({
			position: { x: 0, y: 0 },
			activeInvestigation: beginInvestigation(pending, 1, 8),
			perception: {
				...emptyPerception(),
				lastUpdatedAt: 2,
				perceivedFoodIds: ['food-1'],
				perceivedWaterIds: ['water-1'],
				observations: [
					{
						featureId: 'food-1',
						featureKind: 'food',
						position: { x: 0.1, y: 0 },
						observedAt: 2
					},
					{
						featureId: 'water-1',
						featureKind: 'water',
						position: { x: 0, y: 0.1 },
						observedAt: 2
					}
				]
			}
		});
		const next = advanceActiveLearning(creature, 2, learningConfig);
		const assoc = next.symbolAssociations.find((a) => a.symbolId === 'glyph-0')!;
		expect(assoc.foodStrength).toBe(0.25);
		expect(assoc.waterStrength).toBe(0.25);
		expect(next.recentLearning.at(-1)?.outcome).toBe('mixed_evidence');
	});

	it('does not reinforce evidence outside the spatial window', () => {
		const pending: PendingSignal = {
			emissionId: 'em-3',
			symbolId: 'glyph-0',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 10
		};
		const creature = testCreature({
			activeInvestigation: beginInvestigation(pending, 1, 8),
			perception: {
				...emptyPerception(),
				lastUpdatedAt: 2,
				perceivedFoodIds: ['food-far'],
				observations: [
					{
						featureId: 'food-far',
						featureKind: 'food',
						position: { x: 20, y: 0 },
						observedAt: 2
					}
				]
			}
		});
		const next = advanceActiveLearning(creature, 2, learningConfig);
		expect(next.symbolAssociations.find((a) => a.symbolId === 'glyph-0')!.foodStrength).toBe(0);
		expect(next.recentLearning).toHaveLength(0);
	});

	it('completes with conservative no_evidence when window ends empty', () => {
		const pending: PendingSignal = {
			emissionId: 'em-4',
			symbolId: 'glyph-0',
			senderId: 'creature-1',
			origin: { x: 5, y: 5 },
			heardAt: 1,
			expiresAt: 10
		};
		const active = beginInvestigation(pending, 1, 2);
		const creature = testCreature({
			activeInvestigation: active,
			perception: emptyPerception()
		});
		const next = advanceActiveLearning(creature, active.expiresAt, learningConfig);
		expect(next.activeInvestigation).toBeNull();
		expect(next.recentLearning.at(-1)?.outcome).toBe('no_evidence');
		expect(
			next.symbolAssociations.every((a) => a.foodStrength === 0 && a.waterStrength === 0)
		).toBe(true);
	});

	it('records interrupted investigations', () => {
		const pending: PendingSignal = {
			emissionId: 'em-5',
			symbolId: 'glyph-1',
			senderId: 'creature-1',
			origin: { x: 1, y: 1 },
			heardAt: 1,
			expiresAt: 10
		};
		const creature = testCreature({
			activeInvestigation: beginInvestigation(pending, 1, 8)
		});
		const next = interruptInvestigation(creature, 3, 'switched to seek_food', learningConfig);
		expect(next.activeInvestigation).toBeNull();
		expect(next.recentLearning.at(-1)?.outcome).toBe('interrupted');
	});

	it('produces identical learning state for identical seeds and steps', () => {
		const config = defaultSimulationConfig('learn-det');
		let a = createSimulation(config);
		let b = createSimulation(config);
		for (let i = 0; i < 90; i += 1) {
			a = stepSimulation(a, config);
			b = stepSimulation(b, config);
		}
		expect(a.creatures.map((c) => c.symbolAssociations)).toEqual(
			b.creatures.map((c) => c.symbolAssociations)
		);
		expect(a.creatures.map((c) => c.pendingSignals)).toEqual(
			b.creatures.map((c) => c.pendingSignals)
		);
		expect(a.creatures.map((c) => c.recentLearning)).toEqual(
			b.creatures.map((c) => c.recentLearning)
		);
		expect(() => JSON.stringify(a)).not.toThrow();
	});

	it('creates creatures with independent zeroed associations and serialisable learning state', () => {
		const state = createSimulation(defaultSimulationConfig('learn-init'));
		for (const creature of state.creatures) {
			expect(creature.symbolAssociations.every((a) => a.foodStrength === 0)).toBe(true);
			expect(creature.pendingSignals).toEqual([]);
			expect(creature.activeInvestigation).toBeNull();
		}
		// No shared references between creatures
		state.creatures[0]!.symbolAssociations[0]!.foodStrength = 0.9;
		expect(state.creatures[1]!.symbolAssociations[0]!.foodStrength).toBe(0);
	});
});
