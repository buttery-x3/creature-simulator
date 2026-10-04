import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import type { Wildlife } from '../ecology';
import { rememberResourceObservation } from '../memory';
import { testCreature } from '../test-creature';
import type { Creature } from '../types';
import { replanFromArbitration } from './apply-arbitration';
import { stepCreatureBehaviour } from './step-creature-behaviour';

function fixture() {
	const config = defaultSimulationConfig('search-continuity');
	config.ecology.wildlifeCount = 0;
	config.perceptionIntervalSeconds = config.fixedDt;
	const world = createSimulation(config).habitat;
	const habitat: typeof world = { ...world, food: [], water: [] };
	const actor = testCreature({
		intention: 'satisfy_hunger',
		action: 'search',
		hunger: 1,
		thirst: 0.1,
		energy: 0.95,
		position: { x: 0, y: 0 },
		facing: 0,
		target: { kind: 'point', position: { x: 8, y: 0 } },
		searchTarget: { x: 8, y: 0 },
		searchDecisionIndex: 7,
		nextReconsiderAt: 0
	});
	const step = (
		creature: Creature,
		time: number,
		peers: Creature[] = [],
		animals: Wildlife[] = [],
		localWorld = habitat
	) =>
		stepCreatureBehaviour(
			creature,
			config.fixedDt,
			time,
			config.seed,
			localWorld,
			config,
			{ food: 0, water: 0 },
			animals,
			peers
		).creature;
	return { config, habitat, world, actor, step };
}

describe('need search execution continuity', () => {
	it.each(['periodic', 'peer_perception_change'] as const)(
		'keeps the destination through actual %s reconsideration and makes progress',
		(trigger) => {
			const { config, actor, step } = fixture();
			const before = structuredClone(actor);
			let current = actor;
			let decisions = 0;
			for (let tick = 1; tick <= 60; tick++) {
				const peers =
					trigger === 'periodic'
						? []
						: [
								testCreature({
									id: `peer-${tick % 2}`,
									position: { x: 0, y: 1 }
								})
							];
				const next = step(current, tick * config.fixedDt, peers);
				if (next.lastArbitration !== current.lastArbitration) {
					decisions++;
					expect(next.lastArbitration?.trigger).toBe(trigger);
					expect(next.lastArbitration?.selectedTarget).toBeNull();
				}
				expect(next.intention).toBe('satisfy_hunger');
				expect(next.action).toBe('search');
				expect(next.target).toEqual(actor.target);
				expect(next.searchTarget).toEqual(actor.searchTarget);
				expect(next.searchDecisionIndex).toBe(7);
				current = next;
			}
			expect(decisions).toBeGreaterThanOrEqual(2);
			expect(Math.hypot(current.position.x - 8, current.position.y)).toBeLessThan(7);
			expect(actor).toEqual(before);
		}
	);

	it('advances the search sequence once on arrival despite same-step reconsideration', () => {
		const { actor, step, config } = fixture();
		const arrived = { ...actor, position: { ...actor.searchTarget } };
		const next = step(arrived, 1);
		expect(next.lastArbitration?.selectedTarget).toBeNull();
		expect(next.searchDecisionIndex).toBe(8);
		expect(next.searchTarget).not.toEqual(actor.searchTarget);
		expect(next.target).toEqual({ kind: 'point', position: next.searchTarget });
		const continued = step(next, 1 + config.fixedDt);
		expect(continued.searchDecisionIndex).toBe(8);
		expect(continued.searchTarget).toEqual(next.searchTarget);
	});

	it('samples a fresh destination when the winning need changes', () => {
		const { actor, step } = fixture();
		const next = step({ ...actor, hunger: 0.1, thirst: 1 }, 1);
		expect(next.intention).toBe('satisfy_thirst');
		expect(next.action).toBe('search');
		expect(next.searchDecisionIndex).toBe(8);
		expect(next.target).not.toEqual(actor.target);
	});

	it('does not retain an old movement point when knowledge is lost and search begins', () => {
		const { actor, step } = fixture();
		const next = step({ ...actor, action: 'move' }, 1);
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.action).toBe('search');
		expect(next.searchDecisionIndex).toBe(8);
		expect(next.target).not.toEqual(actor.target);
	});

	it('replaces search with newly visible food selected by cognition', () => {
		const { actor, step, habitat, world } = fixture();
		const food = { ...world.food[0], position: { x: 2, y: 0 } };
		const next = step(actor, 1, [], [], { ...habitat, food: [food] });
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.action).toBe('move');
		expect(next.target).toEqual({ kind: 'feature', featureId: food.id, featureKind: 'food' });
		expect(next.lastArbitration?.selectedTarget).toEqual(next.target);
		expect(next.searchDecisionIndex).toBe(7);
	});

	it('pursues a remembered resource point instead of preserving unrelated search', () => {
		const { actor, step } = fixture();
		const position = { x: 4, y: 1 };
		const memory = rememberResourceObservation(actor.memory, {
			featureId: 'remembered-food',
			resourceKind: 'food',
			position,
			empty: false,
			rememberedAt: 0
		});
		const next = step({ ...actor, memory }, 1);
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.action).toBe('move');
		expect(next.target).toEqual({ kind: 'point', position });
		expect(next.lastArbitration?.selectedTarget).toEqual(next.target);
		expect(next.searchDecisionIndex).toBe(7);
	});

	it('lets directly sensed danger interrupt the search', () => {
		const { actor, step } = fixture();
		const animal: Wildlife = {
			id: 'threat',
			position: { x: 0.5, y: 0 },
			facing: 0,
			size: 3,
			physicality: 3,
			health: 1,
			energy: 1,
			nextAttackAt: 0,
			foodAmount: 1,
			patrolPhase: 0,
			mode: 'approach'
		};
		const next = step({ ...actor, verbosity: 0 }, 1, [], [animal]);
		expect(next.lastArbitration?.trigger).toBe('danger_perception_change');
		expect(next.intention).toBe('flee');
		expect(next.action).toBe('move');
		expect(next.target).not.toEqual(actor.target);
	});

	it.each([NaN, Infinity])('replaces an invalid old point (%s) with a finite sample', (x) => {
		const { actor, step } = fixture();
		const invalid: Creature = {
			...actor,
			target: { kind: 'point', position: { x, y: 0 } },
			searchTarget: { x, y: 0 }
		};
		const before = structuredClone(invalid);
		const next = step(invalid, 1);
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.action).toBe('search');
		expect(next.searchDecisionIndex).toBe(8);
		expect(Number.isFinite(next.searchTarget.x) && Number.isFinite(next.searchTarget.y)).toBe(true);
		expect(Number.isFinite(next.position.x) && Number.isFinite(next.position.y)).toBe(true);
		expect(invalid).toEqual(before);
	});

	it('keeps exploration cell continuity independent of the need-search sequence', () => {
		const { actor, config, habitat } = fixture();
		const relaxed = { ...actor, hunger: 0.2, thirst: 0.2, energy: 0.75 };
		const first = replanFromArbitration(relaxed, habitat, 1, 'periodic', config, config.seed);
		expect(first.intention).toBe('explore');
		expect(first.exploration.activeCellIndex).not.toBeNull();
		const next = replanFromArbitration(
			first,
			habitat,
			2,
			'peer_perception_change',
			config,
			config.seed
		);
		expect(next.target).toEqual(first.target);
		expect(next.exploration).toEqual(first.exploration);
		expect(next.searchDecisionIndex).toBe(actor.searchDecisionIndex);
	});
});
