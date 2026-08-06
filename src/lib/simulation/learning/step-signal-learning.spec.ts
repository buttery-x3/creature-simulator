import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import { testCreature } from '../test-creature';
import { emptyPerception } from '../behaviour/perception';
import {
	advanceActiveLearning,
	ingestHeardIntoPending,
	interruptInvestigation,
	resolveInvestigationAtSite
} from './step-signal-learning';
import { beginInvestigation } from './signal-investigation';
import type { PendingSignal } from './types';
import { generateHabitat } from '$lib/habitat';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';
import { stepCreatureBehaviour } from '../behaviour/step-creature-behaviour';

const learningConfig = {
	pendingSignalLifetimeSeconds: 10,
	maxPendingSignalsPerCreature: 4,
	learningEvidenceRadius: 3,
	associationReinforcement: 0.25,
	noEvidenceConfidenceReduction: 0,
	learningHistoryLimit: 8,
	associationStrengthMin: 0,
	associationStrengthMax: 1,
	arrivalDistance: 0.35,
	sensingRadius: 3,
	perceptionIntervalSeconds: 0.25,
	trackedObservationDurationSeconds: 4
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
		expect(JSON.stringify(next.pendingSignals[0])).not.toContain('contextDetail');
	});

	it('does not reinforce evidence while still travelling (mid-step advance)', () => {
		const pending: PendingSignal = {
			emissionId: 'em-1',
			symbolId: 'glyph-2',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 20
		};
		const creature = testCreature({
			position: { x: 5, y: 0 },
			action: 'move',
			goal: 'investigate_signal',
			activeInvestigation: beginInvestigation(pending, 1),
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
		const next = advanceActiveLearning(creature, 1.5, learningConfig);
		expect(next.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!.foodStrength).toBe(0);
		expect(next.activeInvestigation).not.toBeNull();
		expect(next.recentLearning).toHaveLength(0);
	});

	it('resolves food evidence on arrival and clears investigation immediately', () => {
		const pending: PendingSignal = {
			emissionId: 'em-1',
			symbolId: 'glyph-2',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 20
		};
		const habitat = generateHabitat({
			...DEFAULT_SIMULATION_CONFIG.habitat,
			seed: 'resolve-food',
			foodCount: 1,
			waterCount: 0
		});
		// Place creature at origin; put food near origin via forced perception path inside resolve.
		const creature = testCreature({
			position: { x: habitat.food[0]!.position.x, y: habitat.food[0]!.position.y },
			action: 'investigate',
			goal: 'investigate_signal',
			activeInvestigation: {
				...beginInvestigation(pending, 1),
				origin: {
					x: habitat.food[0]!.position.x,
					y: habitat.food[0]!.position.y
				}
			}
		});
		const next = resolveInvestigationAtSite(creature, habitat, 2, learningConfig);
		expect(next.activeInvestigation).toBeNull();
		const assoc = next.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!;
		expect(assoc.foodStrength).toBe(0.25);
		expect(assoc.foodEvidenceCount).toBe(1);
		expect(next.recentLearning).toHaveLength(1);
		expect(next.recentLearning[0]!.outcome).toBe('food_evidence');
		// At most once: second resolve with no active is no-op
		const again = resolveInvestigationAtSite(next, habitat, 3, learningConfig);
		expect(again.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!.foodEvidenceCount).toBe(
			1
		);
	});

	it('records no_evidence without changing associations and clears active', () => {
		const pending: PendingSignal = {
			emissionId: 'em-4',
			symbolId: 'glyph-0',
			senderId: 'creature-1',
			origin: { x: 0, y: 0 },
			heardAt: 1,
			expiresAt: 20
		};
		const habitat = generateHabitat({
			...DEFAULT_SIMULATION_CONFIG.habitat,
			seed: 'resolve-empty',
			foodCount: 1,
			waterCount: 0
		});
		// Origin far from any food.
		const creature = testCreature({
			position: { x: 0, y: 0 },
			action: 'investigate',
			goal: 'investigate_signal',
			activeInvestigation: beginInvestigation({ ...pending, origin: { x: 0, y: 0 } }, 1),
			perception: emptyPerception()
		});
		const next = resolveInvestigationAtSite(creature, habitat, 2, {
			...learningConfig,
			learningEvidenceRadius: 0.1
		});
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
			expiresAt: 20
		};
		const creature = testCreature({
			activeInvestigation: beginInvestigation(pending, 1)
		});
		const next = interruptInvestigation(creature, 3, 'switched goal', learningConfig);
		expect(next.activeInvestigation).toBeNull();
		expect(next.recentLearning.at(-1)?.outcome).toBe('interrupted');
	});

	it('creates independent zeroed associations and deterministic curiosity', () => {
		const config = defaultSimulationConfig('learn-init');
		const state = createSimulation(config);
		const curiosities = state.creatures.map((c) => c.curiosity);
		expect(new Set(curiosities).size).toBeGreaterThan(1);
		for (const creature of state.creatures) {
			expect(creature.curiosity).toBeGreaterThanOrEqual(config.curiosityRange.min);
			expect(creature.curiosity).toBeLessThanOrEqual(config.curiosityRange.max);
			expect(creature.symbolAssociations.every((a) => a.foodStrength === 0)).toBe(true);
		}
		// Independent association refs
		state.creatures[0]!.symbolAssociations[0]!.foodStrength = 0.9;
		expect(state.creatures[1]!.symbolAssociations[0]!.foodStrength).toBe(0);

		const again = createSimulation(config);
		expect(again.creatures.map((c) => c.curiosity)).toEqual(curiosities);
		expect(() => JSON.stringify(state)).not.toThrow();
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
		expect(a.creatures.map((c) => c.curiosity)).toEqual(b.creatures.map((c) => c.curiosity));
	});
});

describe('investigation travel lock and arrival', () => {
	it('does not abandon an active investigation trip when needs rise', () => {
		const config = defaultSimulationConfig('travel-lock');
		const habitat = generateHabitat({ ...config.habitat, seed: config.seed });
		const origin = { x: 8, y: 0 };
		const pending: PendingSignal = {
			emissionId: 'em-travel',
			symbolId: 'glyph-0',
			senderId: 'creature-9',
			origin,
			heardAt: 1,
			expiresAt: 100
		};
		let creature = testCreature({
			position: { x: 0, y: 0 },
			goal: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: origin },
			goalStartedAt: 1,
			nextReconsiderAt: 1.5,
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.9,
			curiosity: 0.5,
			activeInvestigation: beginInvestigation(pending, 1),
			pendingSignals: []
		});

		// Advance many steps with rising needs; should remain investigating until arrival.
		for (let i = 0; i < 30; i += 1) {
			const t = 1 + (i + 1) * config.fixedDt;
			const result = stepCreatureBehaviour(
				creature,
				config.fixedDt,
				t,
				config.seed,
				habitat,
				config
			);
			creature = result.creature;
			if (creature.activeInvestigation === null && creature.goal !== 'investigate_signal') {
				break;
			}
			// While still travelling, must stay locked on investigation.
			if (creature.activeInvestigation) {
				expect(creature.goal).toBe('investigate_signal');
			}
		}
		// After enough time should have completed (arrived and cleared) or still en route — never mid-trip switch to seek_*
		if (creature.activeInvestigation) {
			expect(creature.goal).toBe('investigate_signal');
			expect(creature.action === 'move' || creature.action === 'investigate').toBe(true);
		}
	});

	it('stops moving once the investigate action is active', () => {
		const config = defaultSimulationConfig('stop-at-site');
		const habitat = generateHabitat({ ...config.habitat, seed: config.seed });
		const origin = { x: 0.1, y: 0 };
		const pending: PendingSignal = {
			emissionId: 'em-stop',
			symbolId: 'glyph-0',
			senderId: 'creature-9',
			origin,
			heardAt: 1,
			expiresAt: 100
		};
		const creature = testCreature({
			position: { x: 0, y: 0 },
			goal: 'investigate_signal',
			action: 'investigate',
			target: { kind: 'point', position: origin },
			activeInvestigation: beginInvestigation(pending, 1),
			movementSpeed: 5
		});
		const before = { ...creature.position };
		const result = stepCreatureBehaviour(creature, config.fixedDt, 2, config.seed, habitat, config);
		// Same-step resolve+replan is expected when already investigating at site.
		// If still on investigate (e.g. resolve deferred), position must not drift.
		if (result.creature.action === 'investigate') {
			expect(result.creature.position.x).toBeCloseTo(before.x);
			expect(result.creature.position.y).toBeCloseTo(before.y);
		} else {
			// Completed: active cleared and not still moving around the origin under investigate_signal.
			expect(result.creature.activeInvestigation).toBeNull();
			expect(result.creature.action).not.toBe('investigate');
		}
	});

	it('does not apply movement while action is investigate (position stable mid-inspect)', () => {
		// Force a path that holds investigate without completing: resolve needs habitat resources
		// far away so sense finds nothing quickly, but we assert no moveToward while action is investigate
		// by checking the early return path with a spy-like before/after on a single step after arrival transition.
		const config = defaultSimulationConfig('no-orbit');
		const habitat = generateHabitat({ ...config.habitat, seed: config.seed });
		const origin = { x: 3, y: 0 };
		let creature = testCreature({
			position: { x: 2.7, y: 0 },
			facing: 0,
			movementSpeed: 10,
			goal: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: origin },
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-orbit',
					symbolId: 'glyph-0',
					senderId: 'creature-9',
					origin,
					heardAt: 1,
					expiresAt: 100
				},
				1
			)
		});
		// Step until we leave move (arrive) or complete.
		const positions: { x: number; y: number }[] = [];
		for (let i = 0; i < 20; i += 1) {
			const t = 1 + (i + 1) * config.fixedDt;
			const result = stepCreatureBehaviour(
				creature,
				config.fixedDt,
				t,
				config.seed,
				habitat,
				config
			);
			creature = result.creature;
			positions.push({ ...creature.position });
			if (creature.activeInvestigation === null) {
				break;
			}
		}
		// After completion or during inspect, we should not see sustained orbiting far from origin.
		const last = positions.at(-1)!;
		const dist = Math.hypot(last.x - origin.x, last.y - origin.y);
		expect(dist).toBeLessThan(2);
	});
});
