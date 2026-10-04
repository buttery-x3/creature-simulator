import { describe, expect, it } from 'vitest';
import { testCreature } from '../test-creature';
import type { Creature } from '../types';
import { DEFAULT_LIFECYCLE_CONFIG } from './defaults';
import { createLifeState } from './physiology';
import { resolveReproduction } from './reproduction';

const config = DEFAULT_LIFECYCLE_CONFIG;
function pair(): Creature[] {
	return ['a', 'b'].map((id, index) => {
		const creature = testCreature({
			id,
			position: { x: index * 0.5, y: 0 },
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.9,
			intention: 'court_peer',
			action: 'court',
			target: { kind: 'creature', creatureId: index === 0 ? 'b' : 'a' }
		});
		return {
			...creature,
			lifecycle: createLifeState('birth-test', id, creature.body, config, config.maturitySeconds)
		};
	});
}
function started(creatures = pair()) {
	return resolveReproduction(creatures, 10, config, 5).creatures;
}

describe('mutual physical reproduction', () => {
	it('requires continuous reciprocal courtship and creates one deterministic birth with costs to both', () => {
		const initial = pair();
		initial[1].lifecycle.generation = 2;
		const courting = started(initial);
		expect(resolveReproduction(courting, 12.9, config, 5).births).toEqual([]);
		const result = resolveReproduction(courting, 13, config, 5);
		expect(result.births).toEqual([
			{ id: 'creature-5', position: { x: 0.25, y: 0 }, parentIds: ['a', 'b'], generation: 3 }
		]);
		expect(result.nextCreatureId).toBe(6);
		expect(result.events).toHaveLength(1);
		for (const parent of result.creatures) {
			expect(parent.energy).toBeCloseTo(0.7);
			expect(parent.hunger).toBeCloseTo(0.35);
			expect(parent.lifecycle.nextReproductionAt).toBe(133);
			expect(parent.lifecycle.courtship).toBeNull();
			expect(parent.pendingArbitrationTrigger).toBe('action_complete');
		}
		expect(resolveReproduction(result.creatures, 20, config, 6).births).toEqual([]);
		expect(initial[0].lifecycle.courtship).toBeNull();
	});

	it('times out a one-sided attempt without consuming reproductive resources', () => {
		const initial = pair();
		initial[1] = { ...initial[1], intention: 'dance', action: 'dance' };
		const result = resolveReproduction(started(initial), 16, config, 5);
		expect(result.births).toEqual([]);
		expect(result.events).toEqual([
			{ kind: 'courtship_failed', time: 16, creatureIds: ['a'], reason: 'timeout' }
		]);
		expect(result.creatures[0].lifecycle.nextReproductionAt).toBe(31);
		expect(result.creatures[0].energy).toBe(0.9);
		expect(result.creatures[0].hunger).toBe(0.2);
		expect(resolveReproduction(result.creatures, 17, config, 5).events).toEqual([]);
	});

	it('resets mutual progress on interruption or contact loss instead of banking incomplete consent', () => {
		for (const interrupt of ['distance', 'intention'] as const) {
			const courting = started();
			courting[1] =
				interrupt === 'distance'
					? { ...courting[1], position: { x: 3, y: 0 } }
					: { ...courting[1], intention: 'rest', action: 'sleep' };
			const interrupted = resolveReproduction(courting, 12, config, 5).creatures;
			expect(interrupted[0].lifecycle.courtship?.mutualSince ?? null).toBeNull();
			interrupted[1] = {
				...interrupted[1],
				position: { x: 0.5, y: 0 },
				intention: 'court_peer',
				action: 'court'
			};
			const resumed = resolveReproduction(interrupted, 12.5, config, 5).creatures;
			expect(resolveReproduction(resumed, 13, config, 5).births).toEqual([]);
		}
	});

	it('rejects immature, injured, hungry, dead, cooling-down or nonreciprocal partners', () => {
		for (const defect of [
			'young',
			'injured',
			'hungry',
			'dead',
			'cooldown',
			'different_target'
		] as const) {
			const courting = started();
			const peer = courting[1];
			if (defect === 'young') peer.lifecycle.ageSeconds = 0;
			if (defect === 'injured') peer.body.health = 0.4;
			if (defect === 'hungry') peer.hunger = 0.8;
			if (defect === 'dead') peer.body.health = 0;
			if (defect === 'cooldown') peer.lifecycle.nextReproductionAt = 20;
			if (defect === 'different_target') peer.target = { kind: 'creature', creatureId: 'third' };
			expect(resolveReproduction(courting, 13, config, 5).births).toEqual([]);
		}
	});

	it('reports population-cap prevention once, without charging birth costs or advancing identities', () => {
		const result = resolveReproduction(started(), 13, { ...config, populationCap: 2 }, 5);
		expect(result.births).toEqual([]);
		expect(result.nextCreatureId).toBe(5);
		expect(result.events).toEqual([
			{ kind: 'courtship_failed', time: 13, creatureIds: ['a', 'b'], reason: 'population_cap' }
		]);
		expect(
			result.creatures.every(
				(creature) => creature.energy === 0.9 && creature.lifecycle.nextReproductionAt === 133
			)
		).toBe(true);
		expect(resolveReproduction(result.creatures, 14, config, 5).events).toEqual([]);
	});

	it('assigns IDs and the last available slot consistently independent of population order', () => {
		const first = pair();
		const second = pair().map((creature, index) => ({
			...creature,
			id: index === 0 ? 'c' : 'd',
			position: { x: 4 + index * 0.5, y: 0 },
			target: { kind: 'creature' as const, creatureId: index === 0 ? 'd' : 'c' }
		}));
		const courting = started([...second, ...first]);
		const limited = { ...config, populationCap: 5 };
		const forward = resolveReproduction(courting, 13, limited, 20);
		const reversed = resolveReproduction([...courting].reverse(), 13, limited, 20);
		expect(forward.births).toEqual(reversed.births);
		expect(forward.events).toEqual(reversed.events);
		expect(forward.births[0].parentIds).toEqual(['a', 'b']);
		expect(forward.nextCreatureId).toBe(21);
	});
});
