import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import type { Creature } from '../types';
import { advanceBody, bodyAbility, createBody, daylightAt, DEFAULT_ECOLOGY_CONFIG } from './body';
import { resolveEncounters } from './encounters';
import { createWildlife, stepWildlife } from './wildlife';
import type { Wildlife } from './types';

function fixture() {
	const config = defaultSimulationConfig('physical-ecology');
	const state = createSimulation(config);
	const creature: Creature = {
		...state.creatures[0],
		position: { x: 0, y: 0 },
		body: { size: 1, physicality: 1, health: 1, nextAttackAt: 0 },
		energy: 1,
		hunger: 0.8,
		intention: 'hunt',
		action: 'fight',
		target: { kind: 'wildlife', wildlifeId: 'wildlife-0' }
	};
	const animal: Wildlife = {
		...state.wildlife[0],
		position: { x: 0.2, y: 0 },
		size: 0.5,
		physicality: 0.6,
		health: 1,
		energy: 0.7,
		mode: 'roam',
		nextAttackAt: 0
	};
	return { config, state, creature, animal };
}

describe('physical ecology', () => {
	it('isolates seeded body and wildlife generation from population count', () => {
		const { config, state } = fixture();
		expect(createBody(config.seed, 'creature-0')).toEqual(createBody(config.seed, 'creature-0'));
		expect(createWildlife(config.seed, state.habitat, config.ecology)).toEqual(state.wildlife);
		const larger = createSimulation({ ...config, creatureCount: config.creatureCount + 2 });
		expect(larger.wildlife).toEqual(state.wildlife);
		expect(larger.creatures[0].body).toEqual(state.creatures[0].body);
	});

	it('derives bounded periodic daylight from simulation time', () => {
		expect(daylightAt(0, DEFAULT_ECOLOGY_CONFIG)).toBeCloseTo(0.5);
		expect(daylightAt(45, DEFAULT_ECOLOGY_CONFIG)).toBeCloseTo(1);
		expect(daylightAt(135, DEFAULT_ECOLOGY_CONFIG)).toBeCloseTo(0);
		expect(daylightAt(180, DEFAULT_ECOLOGY_CONFIG)).toBeCloseTo(0.5);
	});

	it('reduces ability with injury and exhaustion', () => {
		const { creature } = fixture();
		expect(bodyAbility({ ...creature.body, health: 0.3 }, 1)).toBeLessThan(
			bodyAbility(creature.body, 1)
		);
		expect(bodyAbility(creature.body, 0.2)).toBeLessThan(bodyAbility(creature.body, 1));
	});

	it('reacts only to local creatures and deterministically avoids stronger bodies', () => {
		const { config, state, creature, animal } = fixture();
		const nearby = stepWildlife([animal], [creature], state.habitat, 0, 1, config.ecology)[0];
		expect(nearby.mode).toBe('avoid');
		expect(nearby.position.x).toBeGreaterThan(animal.position.x);
		const distant = { ...creature, position: { x: 100, y: 100 } };
		expect(stepWildlife([animal], [distant], state.habitat, 0, 1, config.ecology)).toEqual(
			stepWildlife([animal], [], state.habitat, 0, 1, config.ecology)
		);
	});

	it('permits hungry stronger wildlife to approach but healthy satiated animals roam', () => {
		const { config, state, creature, animal } = fixture();
		const stronger = { ...animal, size: 2, physicality: 2, energy: 0.5 };
		expect(stepWildlife([stronger], [creature], state.habitat, 0, 1, config.ecology)[0].mode).toBe(
			'approach'
		);
		expect(
			stepWildlife(
				[{ ...stronger, energy: 0.9 }],
				[creature],
				state.habitat,
				0,
				1,
				config.ecology
			)[0].mode
		).toBe('roam');
	});

	it('requires hunting commitment, proximity and cooldown for creature attacks', () => {
		const { config, creature, animal } = fixture();
		expect(
			resolveEncounters([animal], [{ ...creature, intention: 'explore' }], 0, 1 / 30, config)
				.encounters
		).toEqual([]);
		const first = resolveEncounters([animal], [creature], 0, 1 / 30, config);
		expect(first.encounters.map((event) => event.kind)).toContain('creature_attack');
		expect(first.creatures[0].intention).toBe('hunt');
		const second = resolveEncounters(first.wildlife, first.creatures, 1 / 30, 1 / 30, config);
		expect(second.encounters).toEqual([]);
		expect(creature.body.health).toBe(1);
		expect(animal.health).toBe(1);
	});

	it('creates finite carcass food and does not spawn rescue replacements', () => {
		const { config, state, creature, animal } = fixture();
		const result = resolveEncounters([{ ...animal, health: 0.01 }], [creature], 0, 1 / 30, config);
		expect(result.wildlife[0].health).toBe(0);
		expect(result.wildlife[0].foodAmount).toBe(animal.size * config.ecology.carcassFoodPerSize);
		const consumed = resolveEncounters(
			result.wildlife,
			[{ ...creature, hunger: 1 }],
			1,
			100,
			config
		);
		expect(consumed.wildlife).toHaveLength(0);
		expect(consumed.creatures[0].hunger).toBeCloseTo(
			1 - animal.size * config.ecology.carcassFoodPerSize
		);
		expect(stepWildlife([], [creature], state.habitat, 1000, 1000, config.ecology)).toEqual([]);
	});

	it('allocates scarce carcass food in stable creature id order', () => {
		const { config, creature, animal } = fixture();
		const carcass: Wildlife = { ...animal, health: 0, foodAmount: 0.1, mode: 'carcass' };
		const other = { ...creature, id: 'creature-z' };
		const result = resolveEncounters([carcass], [other, creature], 0, 100, config);
		expect(result.creatures[0].hunger).toBe(other.hunger);
		expect(result.creatures[1].hunger).toBeCloseTo(creature.hunger - 0.1);
	});

	it('does not recreate carcass food when multiple hunters strike or revisit a kill', () => {
		const { config, creature, animal } = fixture();
		const other = { ...creature, id: 'creature-z' };
		const killed = resolveEncounters(
			[{ ...animal, health: 0.01 }],
			[other, creature],
			0,
			1 / 30,
			config
		);
		expect(killed.encounters.filter((event) => event.kind === 'creature_attack')).toHaveLength(1);
		const initialSupply = animal.size * config.ecology.carcassFoodPerSize;
		const consumed = killed.encounters
			.filter((event) => event.kind === 'consume_carcass')
			.reduce((sum, event) => sum + event.amount, 0);
		expect(killed.wildlife[0].foodAmount + consumed).toBeCloseTo(initialSupply);
		const revisit = resolveEncounters(killed.wildlife, killed.creatures, 3, 1 / 30, config);
		expect(revisit.encounters.every((event) => event.kind === 'consume_carcass')).toBe(true);
		expect(revisit.wildlife[0].foodAmount).toBeLessThan(killed.wildlife[0].foodAmount);
	});

	it('applies wildlife injury without seizing the creature intention or action', () => {
		const { config, creature, animal } = fixture();
		const result = resolveEncounters(
			[{ ...animal, mode: 'approach' }],
			[{ ...creature, intention: 'explore', action: 'explore', target: null }],
			0,
			1 / 30,
			config
		);
		expect(result.encounters.map((event) => event.kind)).toEqual(['wildlife_attack']);
		expect(result.creatures[0].body.health).toBeLessThan(1);
		expect(result.creatures[0].intention).toBe('explore');
		expect(result.creatures[0].action).toBe('explore');
		expect(result.creatures[0].pendingArbitrationTrigger).toBe('danger_perception_change');
	});

	it('leaves distant carcasses unconsumed and removes naturally exhausted remains', () => {
		const { config, state, creature, animal } = fixture();
		const carcass: Wildlife = {
			...animal,
			health: 0,
			foodAmount: 0.001,
			mode: 'carcass',
			position: { x: 5, y: 5 }
		};
		const result = resolveEncounters([carcass], [creature], 0, 10, config);
		expect(result.creatures[0].hunger).toBe(creature.hunger);
		expect(result.wildlife[0].foodAmount).toBe(carcass.foodAmount);
		expect(stepWildlife([carcass], [creature], state.habitat, 1, 1, config.ecology)).toEqual([]);
	});

	it('charges movement effort and repairs injuries only with rest and nourishment', () => {
		const { config, creature } = fixture();
		const moving = advanceBody({ ...creature, action: 'move' }, 1, config.ecology);
		expect(moving.energy).toBeLessThan(creature.energy);
		expect(moving.hunger).toBeGreaterThan(creature.hunger);
		const injured = {
			...creature,
			body: { ...creature.body, health: 0.5 },
			action: 'sleep' as const,
			hunger: 0.1,
			thirst: 0.1
		};
		expect(advanceBody(injured, 1, config.ecology).body.health).toBeGreaterThan(0.5);
		expect(advanceBody({ ...injured, hunger: 1 }, 1, config.ecology).body.health).toBe(0.5);
	});

	it('rejects invalid ecology configuration and clones defaults', () => {
		const config = defaultSimulationConfig();
		config.ecology.wildlifeCount = -1;
		expect(() => createSimulation(config)).toThrow('ecology.wildlifeCount');
		expect(defaultSimulationConfig().ecology.wildlifeCount).toBe(6);
		config.ecology.wildlifeCount = 0;
		config.ecology.dayLengthSeconds = 0;
		expect(() => createSimulation(config)).toThrow('day length');
	});
});
