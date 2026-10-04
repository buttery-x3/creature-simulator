import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import type { Wildlife } from '../ecology/types';
import { testCreature } from '../test-creature';
import { stepCreatureBehaviour } from './step-creature-behaviour';
import { buildArbitrationInput } from './build-arbitration-input';
import { arbitrate } from '../cognition/arbitrate';

function fixture() {
	const config = defaultSimulationConfig('ecology-runtime');
	config.ecology.wildlifeCount = 0;
	const state = createSimulation(config);
	return { config, state, habitat: state.habitat };
}

function animal(overrides: Partial<Wildlife> = {}): Wildlife {
	return {
		id: 'animal',
		position: { x: 0.5, y: 0 },
		facing: 0,
		size: 1.5,
		physicality: 1.5,
		health: 1,
		energy: 1,
		foodAmount: 0,
		nextAttackAt: 0,
		patrolPhase: 0,
		mode: 'approach',
		...overrides
	};
}

describe('physical ecology through actual arbitration and execution', () => {
	it.each(['eat', 'drink', 'sleep'] as const)(
		'interrupts %s for a locally sensed strong threat',
		(action) => {
			const { config, habitat } = fixture();
			const feature =
				action === 'eat' ? habitat.food[0]! : action === 'drink' ? habitat.water[0]! : habitat.home;
			const creature = testCreature({
				position: { ...feature.position },
				action,
				intention:
					action === 'eat' ? 'satisfy_hunger' : action === 'drink' ? 'satisfy_thirst' : 'rest',
				target: { kind: 'feature', featureId: feature.id, featureKind: feature.kind },
				energy: 0.35,
				hunger: 0.6,
				thirst: 0.6,
				verbosity: 0,
				nextReconsiderAt: 1000
			});
			const threat = animal({ position: { x: feature.position.x + 0.5, y: feature.position.y } });
			const next = stepCreatureBehaviour(
				creature,
				config.fixedDt,
				1,
				'test',
				habitat,
				config,
				{ food: 0, water: 0 },
				[threat]
			).creature;
			expect(next.intention).toBe('flee');
			expect(next.action).toBe('move');
			expect(next.lastArbitration?.trigger).toBe('danger_perception_change');
			expect(
				next.lastArbitration?.candidates.find((c) => c.intention === 'flee')?.factors
			).toContainEqual(expect.objectContaining({ code: 'body_ability' }));
		}
	);

	it.each(['eat', 'drink', 'sleep'] as const)('preserves safe %s before recovery', (action) => {
		const { config, habitat } = fixture();
		const feature =
			action === 'eat' ? habitat.food[0]! : action === 'drink' ? habitat.water[0]! : habitat.home;
		const creature = testCreature({
			position: feature.position,
			action,
			intention:
				action === 'eat' ? 'satisfy_hunger' : action === 'drink' ? 'satisfy_thirst' : 'rest',
			target: { kind: 'feature', featureId: feature.id, featureKind: feature.kind },
			energy: 0.3,
			hunger: 0.6,
			thirst: 0.6,
			nextReconsiderAt: 0
		});
		expect(
			stepCreatureBehaviour(creature, config.fixedDt, 1, 'test', habitat, config).creature.action
		).toBe(action);
	});

	it('hunts visible manageable prey but abandons a target that leaves local perception', () => {
		const { config, habitat } = fixture();
		const prey = animal({ physicality: 0.2, size: 0.6, position: { x: 1, y: 0 } });
		const creature = testCreature({ hunger: 1, thirst: 0, energy: 1, verbosity: 0 });
		const emptyHabitat = { ...habitat, food: [], water: [] };
		const first = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			'test',
			emptyHabitat,
			config,
			{ food: 0, water: 0 },
			[prey]
		).creature;
		expect(first.intention).toBe('hunt');
		expect(first.target).toEqual({ kind: 'wildlife', wildlifeId: prey.id });
		const moved = stepCreatureBehaviour(
			first,
			config.fixedDt,
			2,
			'test',
			emptyHabitat,
			config,
			{ food: 0, water: 0 },
			[{ ...prey, position: { x: 9, y: 6 } }]
		).creature;
		expect(moved.intention).not.toBe('hunt');
		expect(moved.perceivedWildlife).toEqual([]);
	});

	it('fights at contact and replans a moving pursuit without freezing', () => {
		const { config, habitat } = fixture();
		const prey = animal({ physicality: 0.2, size: 0.6 });
		const creature = testCreature({ hunger: 1, thirst: 0, energy: 1, verbosity: 0 });
		const first = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			'test',
			habitat,
			config,
			{ food: 0, water: 0 },
			[prey]
		).creature;
		expect(first.action).toBe('fight');
		const moved = stepCreatureBehaviour(
			first,
			config.fixedDt,
			2,
			'test',
			habitat,
			config,
			{ food: 0, water: 0 },
			[{ ...prey, position: { x: 2, y: 0 } }]
		).creature;
		expect(moved.intention).toBe('hunt');
		expect(moved.action).toBe('move');
		expect(moved.position.x).toBeGreaterThan(first.position.x);
	});

	it('night boosts home/rest while urgent hunger can still win', () => {
		const { config, habitat } = fixture();
		const creature = testCreature({ hunger: 0, thirst: 0, energy: 0.8, verbosity: 0 });
		const day = buildArbitrationInput(
			creature,
			habitat,
			config.ecology.dayLengthSeconds / 4,
			'periodic',
			config
		);
		const night = { ...day, timeSeconds: config.ecology.dayLengthSeconds * 0.75 };
		expect(arbitrate(day).selectedIntention).toBe('explore');
		expect(arbitrate(night).selectedIntention).toBe('rest');
		expect(
			arbitrate({
				...night,
				hunger: 1,
				availableFood: [{ featureId: 'food', resourceKind: 'food', position: creature.position }]
			}).selectedIntention
		).toBe('satisfy_hunger');
	});

	it('repeats the same complete fixed-step physical world and keeps history bounded', () => {
		const config = defaultSimulationConfig('physical-repeat');
		const run = () => {
			let state = createSimulation(config);
			for (let i = 0; i < 400; i++) state = stepSimulation(state, config);
			return state;
		};
		const a = run();
		expect(a).toEqual(run());
		expect(a.recentEncounters.length).toBeLessThanOrEqual(config.ecology.encounterHistoryLimit);
		for (const c of a.creatures) {
			expect(c.memory.entries.length).toBeLessThanOrEqual(c.memory.capacity);
			expect(c.body.health).toBeGreaterThanOrEqual(0);
		}
	});
});
