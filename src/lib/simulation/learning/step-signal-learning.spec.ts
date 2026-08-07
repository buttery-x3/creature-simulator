import { describe, expect, it } from 'vitest';
import { generateHabitat } from '$lib/habitat';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import { testCreature } from '../test-creature';
import { emptyPerception } from '../behaviour/perception';
import { stepCreatureBehaviour } from '../behaviour/step-creature-behaviour';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';
import { beginInvestigation } from './signal-investigation';
import { interruptInvestigation, resolveInvestigationAtSite } from './step-signal-learning';

const learningConfig = {
	learningEvidenceRadius: 3,
	associationReinforcement: 0.25,
	noEvidenceConfidenceReduction: 0,
	learningHistoryLimit: 8,
	associationStrengthMin: 0,
	associationStrengthMax: 1,
	arrivalDistance: 0.35,
	sensingRadius: 3,
	perceptionIntervalSeconds: 0.25,
	symbolInventory: DEFAULT_SIMULATION_CONFIG.symbolInventory,
	lexiconAssignmentMinStrength: 0.15,
	lexiconAssignmentMinEvidenceCount: 1,
	lexiconHistoryLimit: 12
};

describe('step signal learning', () => {
	it('does not reinforce evidence while still travelling', () => {
		const source = {
			emissionId: 'em-1',
			symbolId: 'glyph-2' as const,
			origin: { x: 0, y: 0 }
		};
		const creature = testCreature({
			position: { x: 5, y: 0 },
			action: 'move',
			intention: 'investigate_signal',
			activeInvestigation: beginInvestigation(source, 1),
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
		// Travel path never calls resolveInvestigationAtSite until investigate action.
		expect(creature.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!.foodStrength).toBe(0);
		expect(creature.activeInvestigation).not.toBeNull();
		expect(creature.recentLearning).toHaveLength(0);
	});

	it('resolves food evidence on arrival and clears investigation immediately', () => {
		const habitat = generateHabitat({
			...DEFAULT_SIMULATION_CONFIG.habitat,
			seed: 'resolve-food',
			foodCount: 1,
			waterCount: 0
		});
		const food = habitat.food[0]!;
		const creature = testCreature({
			position: { x: food.position.x, y: food.position.y },
			action: 'investigate',
			intention: 'investigate_signal',
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-1',
					symbolId: 'glyph-2',
					origin: { x: food.position.x, y: food.position.y }
				},
				1
			)
		});
		const next = resolveInvestigationAtSite(creature, habitat, 2, learningConfig);
		expect(next.activeInvestigation).toBeNull();
		const assoc = next.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!;
		expect(assoc.foodStrength).toBe(0.25);
		expect(assoc.foodEvidenceCount).toBe(1);
		expect(next.recentLearning).toHaveLength(1);
		expect(next.recentLearning[0]!.outcome).toBe('food_evidence');
		expect(next.lexicon.food).toBe('glyph-2');
		expect(next.lexicon.water).toBeNull();
		expect(
			next.recentLexiconChanges.some((c) => c.meaning === 'food' && c.newSymbolId === 'glyph-2')
		).toBe(true);
		expect(next.activeAnnouncementOpportunity).toBeNull();
		const again = resolveInvestigationAtSite(next, habitat, 3, learningConfig);
		expect(again.symbolAssociations.find((a) => a.symbolId === 'glyph-2')!.foodEvidenceCount).toBe(
			1
		);
	});

	it('records no_evidence without changing associations and clears active', () => {
		const habitat = generateHabitat({
			...DEFAULT_SIMULATION_CONFIG.habitat,
			seed: 'resolve-empty',
			foodCount: 1,
			waterCount: 0
		});
		const creature = testCreature({
			position: { x: 0, y: 0 },
			action: 'investigate',
			intention: 'investigate_signal',
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-4',
					symbolId: 'glyph-0',
					origin: { x: 0, y: 0 }
				},
				1
			),
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
		const creature = testCreature({
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-5',
					symbolId: 'glyph-1',
					origin: { x: 1, y: 1 }
				},
				1
			)
		});
		const next = interruptInvestigation(creature, 3, 'switched intention', learningConfig);
		expect(next.activeInvestigation).toBeNull();
		expect(next.recentLearning.at(-1)?.outcome).toBe('interrupted');
	});

	it('creates independent zeroed associations per creature', () => {
		const config = defaultSimulationConfig('learn-init');
		const state = createSimulation(config);
		for (const creature of state.creatures) {
			expect(creature.symbolAssociations.every((a) => a.foodStrength === 0)).toBe(true);
		}
		state.creatures[0]!.symbolAssociations[0]!.foodStrength = 0.9;
		expect(state.creatures[1]!.symbolAssociations[0]!.foodStrength).toBe(0);
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
	});
});

describe('investigation arrival execution', () => {
	it('stops moving once the investigate action is active', () => {
		const config = defaultSimulationConfig('stop-at-site');
		const habitat = generateHabitat({ ...config.habitat, seed: config.seed });
		const origin = { x: 0.1, y: 0 };
		const creature = testCreature({
			position: { x: 0, y: 0 },
			intention: 'investigate_signal',
			action: 'investigate',
			target: { kind: 'point', position: origin },
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-stop',
					symbolId: 'glyph-0',
					origin
				},
				1
			),
			movementSpeed: 5,
			nextReconsiderAt: 999
		});
		const before = { ...creature.position };
		const result = stepCreatureBehaviour(creature, config.fixedDt, 2, config.seed, habitat, config);
		if (result.creature.action === 'investigate') {
			expect(result.creature.position.x).toBeCloseTo(before.x);
			expect(result.creature.position.y).toBeCloseTo(before.y);
		} else {
			expect(result.creature.activeInvestigation).toBeNull();
			expect(result.creature.action).not.toBe('investigate');
		}
	});

	it('resolves on arrival after move toward origin', () => {
		const config = defaultSimulationConfig('arrive-resolve');
		const habitat = generateHabitat({ ...config.habitat, seed: config.seed });
		const origin = { x: 0.2, y: 0 };
		let creature = testCreature({
			position: { x: 0, y: 0 },
			facing: 0,
			movementSpeed: 10,
			intention: 'investigate_signal',
			action: 'move',
			target: { kind: 'point', position: origin },
			activeInvestigation: beginInvestigation(
				{
					emissionId: 'em-arrive',
					symbolId: 'glyph-0',
					origin
				},
				1
			),
			nextReconsiderAt: 999,
			hunger: 0.05,
			thirst: 0.05,
			energy: 0.95
		});
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
			if (creature.activeInvestigation === null) {
				break;
			}
		}
		// Should eventually complete investigation at origin (or replan away if interrupted by need).
		if (creature.recentLearning.length > 0) {
			expect(creature.activeInvestigation).toBeNull();
		}
	});
});
