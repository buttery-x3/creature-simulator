import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import { createEmptyMemory, rememberHeardSignal } from '../memory';
import type { Wildlife } from '../ecology/types';
import { testCreature } from '../test-creature';
import { stepCreatureBehaviour } from './step-creature-behaviour';

function training(hearingRadius = 12) {
	const config = defaultSimulationConfig('danger-learning');
	config.creatureCount = 0;
	config.symbolInventory = ['glyph-0'];
	config.ecology.wildlifeCount = 0;
	config.ecology.wildlifeSpeed = 0;
	config.ecology.activityHungerCostPerSecond = 0;
	config.ecology.movementEnergyCostPerUnit = 0;
	config.hearingRadius = hearingRadius;
	const base = createSimulation(config);
	const speaker = testCreature({
		id: 'speaker',
		hunger: 0,
		thirst: 0,
		energy: 0.65,
		body: { size: 1, physicality: 1, health: 1, nextAttackAt: 0 },
		verbosity: 1
	});
	const listener = testCreature({
		...speaker,
		id: 'listener',
		position: { x: -0.8, y: 0 },
		verbosity: 0
	});
	const threat: Wildlife = {
		id: 'threat',
		position: { x: 1, y: 0 },
		facing: 0,
		size: 2,
		physicality: 2,
		health: 1,
		energy: 1,
		foodAmount: 0,
		nextAttackAt: 0,
		patrolPhase: 0,
		mode: 'roam'
	};
	const habitat = { ...base.habitat, food: [], water: [] };
	const state = stepSimulation(
		{ ...base, habitat, creatures: [speaker, listener], wildlife: [threat] },
		config
	);
	return { config, habitat, state, listener: state.creatures.find((c) => c.id === 'listener')! };
}

function warningMemory(time = 10) {
	return rememberHeardSignal(createEmptyMemory(8), {
		rememberedAt: time,
		emissionId: 'new-warning',
		symbolId: 'glyph-0',
		origin: { x: 1, y: 0 }
	});
}

describe('grounded warnings with matched listener knowledge', () => {
	it('requests reconsideration when a new signal replaces an old signal in full memory', () => {
		const config = defaultSimulationConfig('full-memory-hearing');
		config.creatureCount = 0;
		config.ecology.wildlifeCount = 0;
		config.resourceAnnouncementClarityMargin = 0;
		const state = createSimulation(config);
		const food = {
			id: 'food',
			kind: 'food' as const,
			position: { x: 5, y: 0 },
			size: { width: 1, height: 1 },
			amount: 2,
			capacity: 2
		};
		const speaker = testCreature({
			id: 'speaker',
			position: food.position,
			intention: 'announce_resource',
			action: 'move',
			nextReconsiderAt: 1000,
			target: { kind: 'feature', featureKind: 'food', featureId: food.id }
		});
		const listener = testCreature({
			id: 'listener',
			position: { x: 0, y: 0 },
			intention: 'rest',
			action: 'sleep',
			energy: 0.2,
			target: { kind: 'feature', featureKind: 'home', featureId: state.habitat.home.id },
			memory: rememberHeardSignal(createEmptyMemory(1), {
				rememberedAt: 0,
				emissionId: 'old',
				symbolId: 'glyph-3',
				origin: { x: -5, y: 0 }
			})
		});
		const next = stepSimulation(
			{
				...state,
				creatures: [speaker, listener],
				habitat: { ...state.habitat, food: [food], water: [] }
			},
			config
		).creatures[1]!;
		expect(next.memory.entries).toHaveLength(1);
		expect(next.memory.entries[0]).toMatchObject({ kind: 'heard_signal' });
		expect(next.memory.entries[0]).not.toMatchObject({ emissionId: 'old' });
		expect(next.pendingArbitrationTrigger).toBe('new_heard_signal_memory');
	});

	it('seeing the same hazard only teaches a symbol to the listener who heard it', () => {
		const heard = training();
		const silent = training(0.1);
		expect(heard.state.recentEmissions[0]?.contextDetail).toBe('danger');
		expect(heard.listener.intention).toBe('flee');
		expect(silent.listener.intention).toBe('flee');
		expect(heard.listener.lexicon.danger).toBe('glyph-0');
		expect(silent.listener.lexicon.danger).toBeNull();
		expect(silent.listener.recentHeard).toHaveLength(0);
		expect(
			heard.listener.symbolAssociations.find((a) => a.symbolId === 'glyph-0')?.dangerEvidenceCount
		).toBe(1);
	});

	it('actual learned danger, unknown and conflicting food meanings select different responses', () => {
		const trained = training();
		const unknown = training(0.1).listener;
		const food = {
			id: 'food-evidence',
			kind: 'food' as const,
			position: { x: 0, y: 0 },
			size: { width: 1, height: 1 },
			amount: 1,
			capacity: 1
		};
		const learner = testCreature({
			id: 'food-learner',
			position: food.position,
			verbosity: 0,
			intention: 'investigate_signal',
			action: 'investigate',
			target: { kind: 'point', position: food.position },
			activeInvestigation: {
				emissionId: 'training-food',
				symbolId: 'glyph-0',
				origin: food.position,
				startedAt: 0
			}
		});
		const learnedFood = stepCreatureBehaviour(
			learner,
			trained.config.fixedDt,
			1,
			'training',
			{ ...trained.habitat, food: [food] },
			trained.config
		).creature;
		expect(learnedFood.lexicon.food).toBe('glyph-0');
		const probe = (creature: typeof learner) =>
			stepCreatureBehaviour(
				{
					...creature,
					position: { x: 0, y: 0 },
					hunger: 0.6,
					thirst: 0,
					energy: 0.65,
					body: { size: 1, physicality: 1, health: 1, nextAttackAt: 0 },
					memory: warningMemory(),
					perceivedWildlife: [],
					nextReconsiderAt: 0,
					intention: 'explore',
					action: 'explore',
					target: { kind: 'point', position: { x: -2, y: 0 } },
					pendingArbitrationTrigger: 'new_heard_signal_memory'
				},
				trained.config.fixedDt,
				10,
				'probe',
				trained.habitat,
				trained.config
			).creature;
		const known = probe(trained.listener);
		const novel = probe(unknown);
		const mistaken = probe(learnedFood);
		expect(known.intention).toBe('avoid_danger');
		expect(known.target?.kind === 'point' && known.target.position.x).toBeLessThan(0);
		expect(novel.intention).toBe('investigate_signal');
		expect(mistaken.intention).toBe('investigate_signal');
		expect(
			mistaken.lastArbitration?.candidates.find((c) => c.intention === 'investigate_signal')
				?.signalEvaluations?.[0]?.interpretation
		).toBe('food');
		// Identical empty world: learned avoidance is a plausible mistaken warning, not hidden truth.
		expect(known.perceivedWildlife).toHaveLength(0);
	});

	it('lets warnings expire without tracking unseen wildlife and lets urgent known water win', () => {
		const { config, habitat, listener } = training();
		const creature = {
			...listener,
			position: { x: 0, y: 0 },
			energy: 0.65,
			memory: warningMemory(),
			perceivedWildlife: [],
			nextReconsiderAt: 0,
			pendingArbitrationTrigger: 'new_heard_signal_memory' as const
		};
		const expired = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			23,
			'probe',
			habitat,
			config
		).creature;
		expect(expired.intention).not.toBe('avoid_danger');
		expect(expired.intention).not.toBe('investigate_signal');
		const water = {
			id: 'known-water',
			kind: 'water' as const,
			position: { x: -1, y: 0 },
			size: { width: 1, height: 1 },
			amount: 2,
			capacity: 2
		};
		const urgent = stepCreatureBehaviour(
			{ ...creature, thirst: 1 },
			config.fixedDt,
			10,
			'probe',
			{ ...habitat, water: [water] },
			config
		).creature;
		expect(urgent.intention).toBe('satisfy_thirst');
	});

	it('reconsiders a learned warning while sleeping without requiring visible world danger', () => {
		const { config, habitat, listener } = training();
		const sleeper = {
			...listener,
			position: { x: 0, y: 0 },
			energy: 0.65,
			memory: warningMemory(),
			perceivedWildlife: [],
			nextReconsiderAt: 1000,
			intention: 'rest' as const,
			action: 'sleep' as const,
			target: {
				kind: 'feature' as const,
				featureId: habitat.home.id,
				featureKind: 'home' as const
			},
			pendingArbitrationTrigger: 'new_heard_signal_memory' as const
		};
		const next = stepCreatureBehaviour(
			sleeper,
			config.fixedDt,
			10,
			'probe',
			habitat,
			config
		).creature;
		expect(next.intention).toBe('avoid_danger');
		expect(next.lastArbitration?.trigger).toBe('new_heard_signal_memory');
	});
});
