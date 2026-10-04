import { describe, expect, it } from 'vitest';
import type { Habitat } from '$lib/habitat';
import {
	createEmptyMemory,
	createSimulation,
	defaultSimulationConfig,
	findAssociation,
	hasHeardSignalMemory,
	rememberHeardSignal,
	selectContextSymbol,
	stepSimulation,
	type Creature,
	type CreatureLexicon,
	type SimulationState
} from '../index';
import { buildEmission } from '../communication/emission';
import { testCreature } from '../test-creature';
import { stepCreatureBehaviour } from './step-creature-behaviour';

const olderSignal = {
	rememberedAt: 0,
	emissionId: 'older-food-signal',
	symbolId: 'glyph-1' as const,
	origin: { x: -5, y: 0 }
};
const newerSignal = {
	rememberedAt: 0,
	emissionId: 'newer-water-signal',
	symbolId: 'glyph-2' as const,
	origin: { x: 5, y: 0 }
};
const foodLexicon: CreatureLexicon = { food: 'glyph-1', water: 'glyph-2', danger: null };
const swappedLexicon: CreatureLexicon = { food: 'glyph-2', water: 'glyph-1', danger: null };

function fixture(overrides: Partial<Creature> = {}) {
	const config = {
		...defaultSimulationConfig('listener-meaning-runtime'),
		ecology: {
			...defaultSimulationConfig().ecology,
			wildlifeCount: 0,
			activityHungerCostPerSecond: 0,
			movementEnergyCostPerUnit: 0
		},
		creatureCount: 1,
		hungerRisePerSecond: 0,
		thirstRisePerSecond: 0,
		energyDrainPerSecond: 0,
		foodSpawnIntervalSeconds: 100000,
		rainIntervalMinSeconds: 100000,
		rainIntervalMaxSeconds: 100000,
		reconsiderIntervalSeconds: 0.1
	};
	const base = createSimulation(config);
	const memory = rememberHeardSignal(
		rememberHeardSignal(createEmptyMemory(16), olderSignal),
		newerSignal
	);
	const creature = testCreature({
		hunger: 0.8,
		thirst: 0.05,
		energy: 1,
		curiosity: 0.5,
		verbosity: 0,
		movementSpeed: 0,
		memory,
		lexicon: { ...foodLexicon },
		nextReconsiderAt: 0,
		...overrides
	});
	const state: SimulationState = {
		...base,
		habitat: { ...base.habitat, food: [], water: [] },
		creatures: [creature]
	};
	return { config, state };
}

function expectSignalAligned(creature: Creature, signal: typeof olderSignal | typeof newerSignal) {
	expect(creature.intention).toBe('investigate_signal');
	expect(creature.target).toEqual({ kind: 'point', position: signal.origin });
	expect(creature.activeInvestigation).toMatchObject({
		emissionId: signal.emissionId,
		symbolId: signal.symbolId,
		origin: signal.origin
	});
	const candidates = creature.lastArbitration?.candidates.filter(
		(candidate) => candidate.intention === 'investigate_signal'
	);
	expect(candidates).toHaveLength(1);
	expect(candidates?.[0]?.reference).toEqual({
		kind: 'heard_signal',
		emissionId: signal.emissionId,
		symbolId: signal.symbolId
	});
}

describe('listener meaning through runtime arbitration', () => {
	it('changes the first investigated origin when only the listener lexicon changes', () => {
		const { config, state } = fixture();
		const before = structuredClone(state);
		const first = (lexicon: CreatureLexicon) =>
			stepSimulation({ ...state, creatures: [{ ...state.creatures[0]!, lexicon }] }, config)
				.creatures[0]!;

		const assigned = first(foodLexicon);
		const swapped = first(swappedLexicon);
		const cleared = first({ food: null, water: null, danger: null });
		expectSignalAligned(assigned, olderSignal);
		expectSignalAligned(swapped, newerSignal);
		expectSignalAligned(cleared, newerSignal);
		expect(assigned.recentLearning).toEqual([]);
		expect(assigned.symbolAssociations).toEqual(before.creatures[0]!.symbolAssociations);
		expect(state).toEqual(before);
	});

	it('lets a low-curiosity thirsty listener pursue the older water meaning', () => {
		const { config, state } = fixture({
			hunger: 0.05,
			thirst: 0.8,
			curiosity: 0,
			lexicon: { ...swappedLexicon }
		});
		const next = stepSimulation(state, config).creatures[0]!;
		expectSignalAligned(next, olderSignal);
		expect(next.thirst).toBe(0.8);
		expect(next.memory).toEqual(state.creatures[0]!.memory);
	});

	it('ignores hidden speaker context, speaker lexicon and live speaker movement', () => {
		const { config, state } = fixture({ movementSpeed: 0.1 });
		const variant = (contextDetail: 'food' | 'water', speakerX: number): SimulationState => {
			const lexicon = contextDetail === 'food' ? foodLexicon : swappedLexicon;
			const selection = selectContextSymbol({
				simulationSeed: state.seed,
				creatureId: 'speaker',
				emissionCount: 0,
				contextDetail,
				inventory: config.symbolInventory,
				lexicon,
				preferredSymbolId: 'glyph-0'
			});
			const emission = buildEmission({
				id: olderSignal.emissionId,
				symbolId: olderSignal.symbolId,
				senderId: 'speaker',
				origin: olderSignal.origin,
				emittedAt: 0,
				lifetimeSeconds: 100,
				context: 'resource_discovered',
				contextDetail,
				symbolSelectionReason: selection.reasonText,
				selectionEvidence: selection.evidence,
				provenance: {
					triggerFeatureId: `hidden-${contextDetail}`,
					triggerFeaturePosition: { x: speakerX, y: 4 },
					clarityEvidence: null
				}
			});
			return {
				...state,
				activeEmissions: [emission],
				recentEmissions: [emission],
				creatures: [
					state.creatures[0]!,
					testCreature({
						id: 'speaker',
						position: { x: speakerX, y: 4 },
						target: { kind: 'point', position: { x: -speakerX, y: 4 } },
						lexicon,
						hunger: 0,
						thirst: 0,
						energy: 1,
						nextReconsiderAt: 999
					})
				]
			};
		};
		let a = variant('food', -8);
		let b = variant('water', 8);
		for (let i = 0; i < 30; i += 1) {
			a = stepSimulation(a, config);
			b = stepSimulation(b, config);
			expect(a.creatures[0]).toEqual(b.creatures[0]);
			expectSignalAligned(a.creatures[0]!, olderSignal);
		}
		expect(a.creatures[1]!.position).not.toEqual({ x: -8, y: 4 });
		expect(b.creatures[1]!.position).not.toEqual({ x: 8, y: 4 });
		expect(a.creatures[0]!.recentHeard).toEqual([]);
		expect(a.creatures[0]!.memory).toEqual(state.creatures[0]!.memory);
	});

	it('keeps the selected origin and investigation identity stable across reconsideration', () => {
		const { config, state } = fixture();
		let a = stepSimulation(state, config);
		let b = stepSimulation(structuredClone(state), config);
		const startedAt = a.creatures[0]!.activeInvestigation!.startedAt;
		for (let i = 0; i < 60; i += 1) {
			a = stepSimulation(a, config);
			b = stepSimulation(b, config);
			expectSignalAligned(a.creatures[0]!, olderSignal);
			expect(a.creatures[0]!.activeInvestigation!.startedAt).toBe(startedAt);
		}
		expect(a).toEqual(b);
		expect(a.creatures[0]!.recentLearning).toEqual([]);
	});

	it('retargets all execution fields together while retaining both unresolved signals', () => {
		const { config, state } = fixture();
		const started = stepSimulation(state, config);
		expectSignalAligned(started.creatures[0]!, olderSignal);
		const changed = {
			...started,
			creatures: [{ ...started.creatures[0]!, lexicon: { ...swappedLexicon }, nextReconsiderAt: 0 }]
		};
		const next = stepSimulation(changed, config).creatures[0]!;
		expectSignalAligned(next, newerSignal);
		expect(next.activeInvestigation!.startedAt).toBeGreaterThan(
			started.creatures[0]!.activeInvestigation!.startedAt
		);
		expect(hasHeardSignalMemory(next.memory, olderSignal.emissionId)).toBe(true);
		expect(hasHeardSignalMemory(next.memory, newerSignal.emissionId)).toBe(true);
		expect(next.symbolAssociations).toEqual(started.creatures[0]!.symbolAssociations);
	});

	it('interrupts for usable matching resources without consuming the heard signal', () => {
		const { config, state } = fixture();
		const started = stepSimulation(state, config);
		const food = {
			id: 'newly-visible-food',
			kind: 'food' as const,
			position: { x: 1, y: 0 },
			size: { width: 0.2, height: 0.2 },
			amount: 10,
			capacity: 10
		};
		const next = stepSimulation(
			{ ...started, habitat: { ...started.habitat, food: [food] } },
			{ ...config, perceptionIntervalSeconds: 0 }
		).creatures[0]!;
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.target).toEqual({ kind: 'feature', featureId: food.id, featureKind: 'food' });
		expect(next.activeInvestigation).toBeNull();
		expect(next.recentLearning.at(-1)).toMatchObject({
			outcome: 'interrupted',
			emissionId: olderSignal.emissionId,
			symbolId: olderSignal.symbolId
		});
		expect(hasHeardSignalMemory(next.memory, olderSignal.emissionId)).toBe(true);
		expect(hasHeardSignalMemory(next.memory, newerSignal.emissionId)).toBe(true);
	});
});

describe('listener meaning keeps arrival learning grounded', () => {
	it.each([
		{ name: 'contradicting water', food: false, water: true, outcome: 'water_evidence' },
		{ name: 'mixed resources', food: true, water: true, outcome: 'mixed_evidence' },
		{ name: 'no resources', food: false, water: false, outcome: 'no_evidence' }
	])('resolves $name from the world, rather than the assigned food meaning', (scenario) => {
		const { config: baseConfig, state } = fixture({ position: { ...olderSignal.origin } });
		const config = { ...baseConfig, sensingRadius: 0.1, learningEvidenceRadius: 0.5 };
		const resource = {
			position: { x: olderSignal.origin.x + 0.3, y: olderSignal.origin.y },
			size: { width: 0.1, height: 0.1 },
			amount: 10,
			capacity: 10
		};
		const habitat: Habitat = {
			...state.habitat,
			food: scenario.food ? [{ ...resource, id: 'arrival-food', kind: 'food' }] : [],
			water: scenario.water ? [{ ...resource, id: 'arrival-water', kind: 'water' }] : []
		};
		const before = state.creatures[0]!;
		const selected = stepCreatureBehaviour(
			before,
			config.fixedDt,
			1,
			state.seed,
			habitat,
			config
		).creature;
		expectSignalAligned(selected, olderSignal);
		expect(selected.action).toBe('investigate');
		expect(selected.recentLearning).toEqual([]);
		const resolved = stepCreatureBehaviour(
			selected,
			config.fixedDt,
			2,
			state.seed,
			habitat,
			config
		).creature;
		const evidence = findAssociation(resolved.symbolAssociations, olderSignal.symbolId)!;
		expect(resolved.recentLearning.at(-1)).toMatchObject({
			emissionId: olderSignal.emissionId,
			symbolId: olderSignal.symbolId,
			outcome: scenario.outcome
		});
		expect(evidence.evidence.food.count).toBe(scenario.food ? 1 : 0);
		expect(evidence.evidence.water.count).toBe(scenario.water ? 1 : 0);
		expect(evidence.evidence.food.strength).toBe(
			scenario.food ? config.associationReinforcement : 0
		);
		expect(evidence.evidence.water.strength).toBe(
			scenario.water ? config.associationReinforcement : 0
		);
		expect(hasHeardSignalMemory(resolved.memory, olderSignal.emissionId)).toBe(false);
		expect(hasHeardSignalMemory(resolved.memory, newerSignal.emissionId)).toBe(true);
	});

	it.each(['food', 'water'] as const)(
		'reaches an older %s origin, discovers the resource and recovers the matching need',
		(resourceKind) => {
			const { config, state } = fixture({
				movementSpeed: 2,
				hunger: resourceKind === 'food' ? 0.8 : 0.05,
				thirst: resourceKind === 'water' ? 0.8 : 0.05,
				lexicon: resourceKind === 'food' ? foodLexicon : swappedLexicon
			});
			const resource = {
				id: `useful-${resourceKind}`,
				kind: resourceKind,
				position: { ...olderSignal.origin },
				size: { width: 0.4, height: 0.4 },
				amount: 10,
				capacity: 10
			};
			const oppositeKind = resourceKind === 'food' ? 'water' : 'food';
			let next = {
				...state,
				habitat: {
					...state.habitat,
					[resourceKind]: [resource],
					[oppositeKind]: [
						{
							...resource,
							id: 'opposite-resource',
							kind: oppositeKind,
							position: newerSignal.origin
						}
					]
				}
			};
			next = stepSimulation(next, config);
			expectSignalAligned(next.creatures[0]!, olderSignal);
			let consumed = false;
			for (let i = 0; i < 240; i += 1) {
				next = stepSimulation(next, config);
				consumed ||= next.creatures[0]!.action === (resourceKind === 'food' ? 'eat' : 'drink');
			}
			const creature = next.creatures[0]!;
			expect(consumed).toBe(true);
			expect(creature[resourceKind === 'food' ? 'hunger' : 'thirst']).toBeLessThan(0.4);
			expect(creature.memory.entries).toContainEqual(
				expect.objectContaining({
					kind: 'resource_observation',
					featureId: resource.id,
					resourceKind
				})
			);
		}
	);
});
