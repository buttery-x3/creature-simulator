import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { createNewborn } from '../creation/creatures';
import { stepCommunication } from '../communication';
import { applyHeardSignalMemories } from '../memory';
import { stepSimulation } from '../step-simulation';
import type { SimulationState } from '../types';

function fixture() {
	const config = defaultSimulationConfig('offspring-personal-learning');
	config.creatureCount = 3;
	config.ecology.wildlifeCount = 0;
	config.foodSpawnIntervalSeconds = 10_000;
	const state = createSimulation(config);
	state.creatures = state.creatures.map((creature, index) => ({
		...creature,
		position: { x: index * 0.5, y: 0 },
		movementSpeed: 0,
		verbosity: 0,
		social: { ...creature.social, nextExpressionAt: 10_000 },
		lexicon: { food: 'glyph-2', water: 'glyph-1', danger: null }
	}));
	return { state, config };
}

function advance(
	state: SimulationState,
	config: ReturnType<typeof defaultSimulationConfig>,
	seconds: number
) {
	for (let step = 0; step < Math.ceil(seconds / config.fixedDt); step++)
		state = stepSimulation(state, config);
	return state;
}

describe('offspring learning and survivor knowledge', () => {
	it.each([false, true])(
		'grounds a newborn symbol through its own arrival evidence (mixed=%s)',
		(mixed) => {
			const { state, config } = fixture();
			const water = { ...state.habitat.water[0], position: { x: 0, y: 0 } };
			const food = { ...state.habitat.food[0], position: { x: 0.2, y: 0 } };
			state.habitat = { ...state.habitat, water: [water], food: mixed ? [food] : [] };
			const child = createNewborn(
				config,
				state.habitat,
				state.seed,
				{
					id: 'creature-3',
					position: { x: 4, y: 0 },
					parentIds: ['creature-0', 'creature-1'],
					generation: 1
				},
				0
			);
			expect(child.lexicon).toEqual({ food: null, water: null, danger: null });
			expect(child.memory.entries).toEqual([]);
			expect(child.recentLearning).toEqual([]);
			expect(
				child.symbolAssociations.every(
					(row) => row.evidence.food.count === 0 && row.evidence.water.count === 0
				)
			).toBe(true);
			// Set only attention/mobility traits for the experiment, never a meaning or learned relation.
			state.creatures = [
				state.creatures[0],
				{ ...child, curiosity: 1, verbosity: 0, movementSpeed: 1 }
			];
			state.nextCreatureId = 4;
			const communicated = stepCommunication(
				state,
				[
					{
						senderId: 'creature-0',
						origin: { x: 0, y: 0 },
						context: 'resource_discovered',
						contextDetail: 'food'
					}
				],
				0,
				config
			);
			let next = {
				...communicated.state,
				creatures: applyHeardSignalMemories(communicated.state.creatures, 0)
			};
			const heardChild = next.creatures.find((creature) => creature.id === child.id)!;
			expect(heardChild.recentHeard[0].symbolId).toBe('glyph-2');
			expect(heardChild.recentHeard[0]).not.toHaveProperty('contextDetail');
			expect(heardChild.lexicon).toEqual(child.lexicon);
			let investigated = false;
			for (let step = 0; step < 300; step++) {
				next = stepSimulation(next, config);
				const current = next.creatures.find((creature) => creature.id === child.id)!;
				investigated ||= current.intention === 'investigate_signal';
				if (current.recentLearning.length > 0) break;
			}
			const learned = next.creatures.find((creature) => creature.id === child.id)!;
			const association = learned.symbolAssociations.find((row) => row.symbolId === 'glyph-2')!;
			expect(investigated).toBe(true);
			expect(Math.hypot(learned.position.x, learned.position.y)).toBeLessThanOrEqual(
				config.arrivalDistance
			);
			expect(association.evidence.water.count).toBe(1);
			expect(association.evidence.food.count).toBe(mixed ? 1 : 0);
			expect(learned.recentLearning.at(-1)?.outcome).toBe(
				mixed ? 'mixed_evidence' : 'water_evidence'
			);
			if (!mixed) {
				expect(learned.lexicon.water).toBe('glyph-2');
				expect(learned.lexicon.food).toBeNull();
				expect(next.creatures[0].lexicon.food).toBe('glyph-2');
			}
		}
	);

	it('releases a dead peer through ordinary sensing without broadcasting death into retained relationships', () => {
		const { state, config } = fixture();
		state.habitat = { ...state.habitat, food: [], water: [] };
		state.creatures[1].position = { x: 2, y: 0 };
		let known = advance(state, config, 1);
		const observer = known.creatures[0];
		expect(
			observer.social.relationships.find((row) => row.peerId === 'creature-1')!.familiarity
		).toBeGreaterThan(0);
		expect(
			observer.social.relationships.find((row) => row.peerId === 'creature-2')!.familiarity
		).toBeGreaterThan(0);
		known = {
			...known,
			creatures: known.creatures.map((creature, index) =>
				index === 0
					? {
							...creature,
							intention: 'approach_peer',
							action: 'move',
							target: { kind: 'creature', creatureId: 'creature-1' },
							nextReconsiderAt: 100,
							perception: { ...creature.perception, lastUpdatedAt: known.timeSeconds }
						}
					: index === 1
						? {
								...creature,
								position: { x: 2, y: 0 },
								lifecycle: { ...creature.lifecycle, ageSeconds: config.lifecycle.maxAgeSeconds }
							}
						: { ...creature, position: { x: 8, y: 8 } }
			)
		};
		const deathStep = stepSimulation(known, config);
		expect(deathStep.creatures.some((creature) => creature.id === 'creature-1')).toBe(false);
		expect(deathStep.creatures[0].target).toEqual({ kind: 'creature', creatureId: 'creature-1' });
		expect(deathStep.creatures[0].perceivedPeers.some((peer) => peer.id === 'creature-1')).toBe(
			true
		);
		const sensed = advance(deathStep, config, config.perceptionIntervalSeconds + config.fixedDt);
		expect(sensed.creatures[0].target?.kind).not.toBe('creature');
		expect(sensed.creatures[0].perceivedPeers).toEqual([]);
		expect(sensed.creatures[0].social.relationships.map((row) => row.peerId).sort()).toEqual([
			'creature-1',
			'creature-2'
		]);
	});
});
