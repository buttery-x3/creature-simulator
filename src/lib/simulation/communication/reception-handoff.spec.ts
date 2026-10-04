import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig, stepSimulation } from '../index';
import { learnFromLocalDangerReception } from '../learning/reception-learning';
import { hearMovementLearning, observeMovementLearning } from '../learning/movement';
import { applyHeardSignalMemories, createEmptyMemory } from '../memory';
import { testCreature } from '../test-creature';
import type { Creature, SimulationState } from '../types';
import { stepCommunication } from './step-communication';
import type { EmissionRequest } from './types';

function burst(historyLimit: number, memoryCapacity = 8) {
	const config = {
		...defaultSimulationConfig('reception-handoff'),
		creatureCount: 0,
		hearingRadius: 2,
		recentHeardHistoryLimit: historyLimit
	};
	const senders = Array.from({ length: 5 }, (_, i) =>
		testCreature({
			id: `speaker-${i}`,
			lexicon: {
				food: config.symbolInventory[i % config.symbolInventory.length]!,
				water: null,
				danger: null,
				approach: null
			}
		})
	);
	const listener = testCreature({
		id: 'listener',
		position: { x: 1, y: 0 },
		memory: createEmptyMemory(memoryCapacity),
		perceivedWildlife: [
			{
				id: 'animal',
				position: { x: 0.5, y: 0 },
				size: 2,
				physicality: 2,
				health: 1,
				energy: 1,
				foodAmount: 1,
				observedAt: 1,
				firstObservedAt: 1
			}
		]
	});
	const state = {
		...createSimulation(config),
		creatures: [
			...senders,
			listener,
			testCreature({ id: 'boundary', position: { x: 2, y: 0 } }),
			testCreature({ id: 'outside', position: { x: 2.001, y: 0 } })
		]
	};
	const requests: EmissionRequest[] = senders.map((sender) => ({
		senderId: sender.id,
		origin: sender.position,
		context: 'resource_discovered',
		contextDetail: 'food',
		triggerFeatureId: 'private-food',
		triggerFeaturePosition: { x: -10, y: 0 }
	}));
	return { config, state, requests };
}

function listener(creatures: readonly Creature[]) {
	return creatures.find((creature) => creature.id === 'listener')!;
}

// Deliberately exclude only the display field, retaining every other state value.
function withoutHeardHistory(state: SimulationState) {
	return {
		...state,
		creatures: state.creatures.map((creature) => ({ ...creature, recentHeard: [] }))
	};
}

describe('authoritative current-step reception handoff', () => {
	it('retains a complete burst with physical filtering and no private sender fields', () => {
		const { config, state, requests } = burst(1);
		const before = structuredClone({ config, state, requests });
		const result = stepCommunication(state, requests, 1, config);
		const received = result.receivedThisStep.get('listener')!;
		expect(received).toEqual(
			result.emittedThisStep.map((emission) => ({
				emissionId: emission.id,
				symbolId: emission.symbolId,
				origin: { x: 0, y: 0 },
				heardAt: 1
			}))
		);
		expect(received).toHaveLength(5);
		expect(listener(result.state.creatures).recentHeard).toHaveLength(1);
		expect(result.receivedThisStep.get('boundary')).toHaveLength(5);
		expect(result.receivedThisStep.has('outside')).toBe(false);
		for (const sender of state.creatures.slice(0, 5)) {
			const ownEmission = result.emittedThisStep.find((item) => item.senderId === sender.id)!;
			const deliveries = result.receivedThisStep.get(sender.id)!;
			expect(deliveries).toHaveLength(4);
			expect(deliveries.some((item) => item.emissionId === ownEmission.id)).toBe(false);
		}
		for (const item of received) {
			expect(Object.keys(item).sort()).toEqual(['emissionId', 'heardAt', 'origin', 'symbolId']);
			expect(item.origin).not.toBe(requests[0].origin);
		}
		expect(result.state).not.toHaveProperty('receivedThisStep');
		expect({ config, state, requests }).toEqual(before);
		expect(stepCommunication(state, requests, 1, config)).toEqual(result);
	});

	it('applies bounded personal memory in stable emission order independently of display order', () => {
		const { config, state, requests } = burst(1, 2);
		const result = stepCommunication(state, [...requests].reverse(), 1, config);
		const before = structuredClone(result);
		const remembered = applyHeardSignalMemories(result.state.creatures, 1, result.receivedThisStep);
		const memory = listener(remembered).memory;
		const orderedIds = result.emittedThisStep.map((item) => item.id).sort();
		expect(
			memory.entries.map((entry) => entry.kind === 'heard_signal' && entry.emissionId)
		).toEqual(orderedIds.slice(-2));
		expect(memory.nextSequence).toBe(5);
		expect(memory.entries.map((entry) => entry.sequence)).toEqual([3, 4]);
		expect(listener(result.state.creatures).recentHeard[0].emissionId).toBe(orderedIds[0]);
		expect(applyHeardSignalMemories(result.state.creatures, 1, new Map())).toEqual(
			result.state.creatures
		);
		expect(applyHeardSignalMemories(result.state.creatures, 2, result.receivedThisStep)).toEqual(
			result.state.creatures
		);
		expect(result).toEqual(before);
	});

	it('grounds every retained glyph from local danger equally with tiny or large display history', () => {
		const run = (limit: number) => {
			const { config, state, requests } = burst(limit);
			let result = stepCommunication(state, requests, 1, config);
			let creatures = applyHeardSignalMemories(result.state.creatures, 1, result.receivedThisStep);
			const learningInput = creatures;
			const before = structuredClone({ creatures, receptions: result.receivedThisStep });
			creatures = learnFromLocalDangerReception(creatures, 1, config, result.receivedThisStep);
			expect(learningInput).toEqual(before.creatures);
			expect(
				listener(before.creatures).symbolAssociations.every(
					(row) => row.evidence.danger.count === 0
				)
			).toBe(true);
			expect(result.receivedThisStep).toEqual(before.receptions);
			expect(
				listener(creatures).symbolAssociations.map((row) => row.evidence.danger.count)
			).toEqual([1, 1, 1, 1]);
			expect(listener(creatures).recentLearning).toHaveLength(4);
			expect(learnFromLocalDangerReception(creatures, 1, config, result.receivedThisStep)).toEqual(
				creatures
			);
			// Fresh emissions during the same visible encounter cannot manufacture new episodes.
			creatures = creatures.map((creature) => ({
				...creature,
				perceivedWildlife: creature.perceivedWildlife.map((animal) => ({
					...animal,
					observedAt: 5
				}))
			}));
			result = stepCommunication({ ...result.state, creatures }, requests, 5, config);
			creatures = applyHeardSignalMemories(result.state.creatures, 5, result.receivedThisStep);
			creatures = learnFromLocalDangerReception(creatures, 5, config, result.receivedThisStep);
			expect(
				listener(creatures).symbolAssociations.map((row) => row.evidence.danger.count)
			).toEqual([1, 1, 1, 1]);
			expect(
				listener(creatures).symbolAssociations.every(
					(row) => row.dangerEvidenceEpisodes.length === 1
				)
			).toBe(true);
			expect(listener(creatures).recentLearning).toHaveLength(4);
			return withoutHeardHistory({ ...result.state, creatures });
		};
		expect(run(1)).toEqual(run(64));
	});

	it('hands every reception to movement binding while preserving its separate trace budget', () => {
		const run = (limit: number) => {
			const { config, state, requests } = burst(limit);
			const peers = state.creatures.slice(0, 5).map((creature, index) => ({
				id: creature.id,
				position: { x: index * 0.5, y: 0 },
				observedAt: 1,
				mature: true,
				expression: null
			}));
			const creatures = state.creatures.map((creature) => {
				const peer = peers.find((item) => item.id === creature.id);
				if (peer) return { ...creature, position: peer.position };
				return creature.id === 'listener'
					? observeMovementLearning({ ...creature, perceivedPeers: peers }, 1, config)
					: creature;
			});
			const result = stepCommunication(
				{ ...state, creatures },
				requests.map((request, index) => ({
					...request,
					origin: peers[index].position
				})),
				1,
				config
			);
			const actor = listener(result.state.creatures);
			const before = structuredClone(actor);
			const learned = hearMovementLearning(
				actor,
				result.receivedThisStep.get(actor.id)!,
				1,
				config
			);
			const traces = learned.movementLearning.encounters.flatMap((row) =>
				row.trace ? [row.trace] : []
			);
			expect(traces.map((trace) => trace.emissionId).sort()).toEqual(
				result.emittedThisStep
					.slice(0, 4)
					.map((emission) => emission.id)
					.sort()
			);
			expect(learned.movementLearning.lastBinding?.status).toBe('budget');
			expect(actor).toEqual(before);
			return learned.movementLearning;
		};
		expect(run(1)).toEqual(run(64));
	});

	it('keeps the entire normal trajectory identical when only display retention changes', () => {
		const smallConfig = {
			...defaultSimulationConfig('overnight-river'),
			recentHeardHistoryLimit: 1
		};
		const largeConfig = {
			...defaultSimulationConfig('overnight-river'),
			recentHeardHistoryLimit: 64
		};
		let small = createSimulation(smallConfig);
		let large = createSimulation(largeConfig);
		let maximumConcurrentReceptions = 0;
		for (let step = 0; step < 60 / smallConfig.fixedDt; step++) {
			small = stepSimulation(small, smallConfig);
			large = stepSimulation(large, largeConfig);
			for (const creature of large.creatures) {
				maximumConcurrentReceptions = Math.max(
					maximumConcurrentReceptions,
					creature.recentHeard.filter((heard) => heard.heardAt === large.timeSeconds).length
				);
			}
			expect(JSON.stringify(withoutHeardHistory(small)), `full state at step ${step + 1}`).toBe(
				JSON.stringify(withoutHeardHistory(large))
			);
		}
		expect(maximumConcurrentReceptions).toBeGreaterThan(1);
	}, 30_000);
});
