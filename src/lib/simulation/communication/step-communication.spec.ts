import { describe, expect, it } from 'vitest';
import {
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot,
	stepSimulation
} from '../index';
import { testCreature } from '../test-creature';
import type { SimulationState } from '../types';
import { appendBounded, canEmit, nextEmissionId, selectPreferredSymbol } from './emission';
import { selectReceivers } from './reception';
import { expireEmissions, stepCommunication } from './step-communication';
import type { EmissionRequest, SignalEmission } from './types';
import { DEFAULT_SYMBOL_INVENTORY } from './types';

function commConfig(seed: string) {
	return {
		...defaultSimulationConfig(seed),
		hearingRadius: 4,
		signalLifetimeSeconds: 1.5,
		emissionCooldownSeconds: 4,
		recentEmittedHistoryLimit: 3,
		recentHeardHistoryLimit: 3,
		recentSimulationEmissionHistoryLimit: 4
	};
}

function bareState(overrides: Partial<SimulationState> = {}): SimulationState {
	const config = defaultSimulationConfig('bare');
	const base = createSimulation({ ...config, creatureCount: 0 });
	return {
		...base,
		creatures: [],
		activeEmissions: [],
		recentEmissions: [],
		nextEmissionSeq: 0,
		...overrides
	};
}

describe('selectPreferredSymbol', () => {
	it('is deterministic for the same seed and creature id', () => {
		const a = selectPreferredSymbol('sym-det', 'creature-0', DEFAULT_SYMBOL_INVENTORY);
		const b = selectPreferredSymbol('sym-det', 'creature-0', DEFAULT_SYMBOL_INVENTORY);
		expect(a).toBe(b);
		expect(DEFAULT_SYMBOL_INVENTORY).toContain(a);
	});

	it('does not take resource kind as an input (API has no resource parameter)', () => {
		// Food and water discoveries must share the same preferred symbol for a creature.
		const symbol = selectPreferredSymbol('no-resource', 'creature-3', DEFAULT_SYMBOL_INVENTORY);
		expect(typeof symbol).toBe('string');
		expect(symbol.startsWith('glyph-')).toBe(true);
	});
});

describe('selectReceivers', () => {
	const emission = {
		origin: { x: 0, y: 0 },
		senderId: 'creature-0'
	};

	it('includes creatures inside hearing radius and excludes those outside', () => {
		const receivers = selectReceivers(
			emission,
			[
				{ id: 'creature-1', position: { x: 1, y: 0 } },
				{ id: 'creature-2', position: { x: 10, y: 0 } }
			],
			4
		);
		expect(receivers.map((r) => r.id)).toEqual(['creature-1']);
	});

	it('excludes the sender', () => {
		const receivers = selectReceivers(
			emission,
			[
				{ id: 'creature-0', position: { x: 0, y: 0 } },
				{ id: 'creature-1', position: { x: 0.5, y: 0 } }
			],
			4
		);
		expect(receivers.map((r) => r.id)).toEqual(['creature-1']);
	});

	it('orders receivers by creature id regardless of input order', () => {
		const receivers = selectReceivers(
			emission,
			[
				{ id: 'creature-3', position: { x: 0, y: 1 } },
				{ id: 'creature-1', position: { x: 1, y: 0 } },
				{ id: 'creature-2', position: { x: 0, y: 0.5 } }
			],
			4
		);
		expect(receivers.map((r) => r.id)).toEqual(['creature-1', 'creature-2', 'creature-3']);
	});
});

describe('expireEmissions', () => {
	it('removes emissions at or past expiresAt', () => {
		const emissions: SignalEmission[] = [
			{
				id: 'em-a-0',
				symbolId: 'glyph-0',
				senderId: 'a',
				origin: { x: 0, y: 0 },
				emittedAt: 1,
				expiresAt: 2.5,
				context: 'resource_discovered',
				contextDetail: 'food',
				symbolSelectionReason: 'creature preferred symbol'
			},
			{
				id: 'em-b-0',
				symbolId: 'glyph-1',
				senderId: 'b',
				origin: { x: 1, y: 1 },
				emittedAt: 1,
				expiresAt: 3,
				context: 'resource_discovered',
				contextDetail: 'water',
				symbolSelectionReason: 'creature preferred symbol'
			}
		];
		expect(expireEmissions(emissions, 2.5).map((e) => e.id)).toEqual(['em-b-0']);
		expect(expireEmissions(emissions, 3)).toEqual([]);
	});
});

describe('stepCommunication', () => {
	it('creates emission, delivers to in-range listeners, excludes sender', () => {
		const config = commConfig('comm-basic');
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			preferredSymbolId: 'glyph-2',
			goal: 'seek_food',
			action: 'move'
		});
		const near = testCreature({
			id: 'creature-1',
			position: { x: 1, y: 0 },
			goal: 'wander',
			action: 'wander'
		});
		const far = testCreature({
			id: 'creature-2',
			position: { x: 20, y: 0 },
			goal: 'wander',
			action: 'wander'
		});
		const state = bareState({
			creatures: [sender, near, far],
			timeSeconds: 1
		});
		const request: EmissionRequest = {
			senderId: 'creature-0',
			origin: { x: 0, y: 0 },
			context: 'resource_discovered',
			contextDetail: 'food'
		};
		const next = stepCommunication(state, [request], 1, config);

		expect(next.activeEmissions).toHaveLength(1);
		const emission = next.activeEmissions[0]!;
		expect(emission.id).toBe(nextEmissionId('creature-0', 0));
		expect(emission.symbolId).toBe('glyph-2');
		expect(emission.symbolSelectionReason).toBe('creature preferred symbol');
		expect(emission.contextDetail).toBe('food');

		const senderNext = next.creatures.find((c) => c.id === 'creature-0')!;
		const nearNext = next.creatures.find((c) => c.id === 'creature-1')!;
		const farNext = next.creatures.find((c) => c.id === 'creature-2')!;

		expect(senderNext.recentEmitted).toHaveLength(1);
		expect(senderNext.recentHeard).toHaveLength(0);
		expect(senderNext.emissionCount).toBe(1);
		expect(senderNext.lastEmissionAt).toBe(1);

		expect(nearNext.recentHeard).toHaveLength(1);
		expect(nearNext.recentHeard[0]?.emissionId).toBe(emission.id);
		expect(farNext.recentHeard).toHaveLength(0);

		// Behaviour-critical fields unchanged by hearing
		expect(nearNext.goal).toBe(near.goal);
		expect(nearNext.action).toBe(near.action);
		expect(nearNext.hunger).toBe(near.hunger);
		expect(nearNext.thirst).toBe(near.thirst);
		expect(nearNext.energy).toBe(near.energy);
		expect(nearNext.target).toEqual(near.target);
		expect(nearNext.perception).toEqual(near.perception);
	});

	it('does not emit while cooldown is active', () => {
		const config = { ...commConfig('cooldown'), emissionCooldownSeconds: 5 };
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			lastEmissionAt: 1,
			emissionCount: 1
		});
		const state = bareState({ creatures: [sender], timeSeconds: 3 });
		const request: EmissionRequest = {
			senderId: 'creature-0',
			origin: { x: 0, y: 0 },
			context: 'resource_discovered',
			contextDetail: 'water'
		};
		const next = stepCommunication(state, [request], 3, config);
		expect(next.activeEmissions).toHaveLength(0);
		expect(next.creatures[0]!.emissionCount).toBe(1);
	});

	it('uses the same preferred symbol for food and water discoveries', () => {
		const config = commConfig('same-symbol');
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			preferredSymbolId: 'glyph-1',
			lastEmissionAt: -1
		});
		let state = bareState({ creatures: [sender], timeSeconds: 1 });
		state = stepCommunication(
			state,
			[
				{
					senderId: 'creature-0',
					origin: { x: 0, y: 0 },
					context: 'resource_discovered',
					contextDetail: 'food'
				}
			],
			1,
			config
		);
		const foodSymbol = state.activeEmissions[0]!.symbolId;

		// Reset cooldown and re-emit for water
		const senderAfter = {
			...state.creatures[0]!,
			lastEmissionAt: -1
		};
		state = {
			...state,
			creatures: [senderAfter],
			activeEmissions: [],
			timeSeconds: 10
		};
		state = stepCommunication(
			state,
			[
				{
					senderId: 'creature-0',
					origin: { x: 0, y: 0 },
					context: 'resource_discovered',
					contextDetail: 'water'
				}
			],
			10,
			config
		);
		expect(state.activeEmissions[0]!.symbolId).toBe(foodSymbol);
		expect(state.activeEmissions[0]!.contextDetail).toBe('water');
	});

	it('bounds emitted, heard and simulation histories', () => {
		const config = {
			...commConfig('bounds'),
			recentEmittedHistoryLimit: 2,
			recentHeardHistoryLimit: 2,
			recentSimulationEmissionHistoryLimit: 2,
			emissionCooldownSeconds: 0
		};
		let sender = testCreature({ id: 'creature-0', position: { x: 0, y: 0 } });
		let listener = testCreature({ id: 'creature-1', position: { x: 0.5, y: 0 } });
		let state = bareState({ creatures: [sender, listener], timeSeconds: 0 });

		for (let i = 0; i < 5; i += 1) {
			const t = i + 1;
			state = {
				...state,
				timeSeconds: t,
				// Keep emissions from expiring during the loop so history is pure
				activeEmissions: state.activeEmissions.map((e) => ({
					...e,
					expiresAt: t + 100
				}))
			};
			state = stepCommunication(
				state,
				[
					{
						senderId: 'creature-0',
						origin: { x: 0, y: 0 },
						context: 'resource_discovered',
						contextDetail: 'food'
					}
				],
				t,
				config
			);
		}

		sender = state.creatures.find((c) => c.id === 'creature-0')!;
		listener = state.creatures.find((c) => c.id === 'creature-1')!;
		expect(sender.recentEmitted).toHaveLength(2);
		expect(listener.recentHeard).toHaveLength(2);
		expect(state.recentEmissions).toHaveLength(2);
		expect(sender.emissionCount).toBe(5);
	});

	it('expires active emissions on the step when expiresAt is reached', () => {
		const config = { ...commConfig('expire'), signalLifetimeSeconds: 1 };
		const sender = testCreature({ id: 'creature-0', position: { x: 0, y: 0 } });
		let state = bareState({ creatures: [sender], timeSeconds: 0 });
		state = stepCommunication(
			state,
			[
				{
					senderId: 'creature-0',
					origin: { x: 0, y: 0 },
					context: 'resource_discovered',
					contextDetail: 'food'
				}
			],
			1,
			config
		);
		expect(state.activeEmissions).toHaveLength(1);
		// Same step time as expiresAt (emittedAt 1 + lifetime 1 = 2)
		state = stepCommunication(state, [], 2, config);
		expect(state.activeEmissions).toHaveLength(0);
	});

	it('produces identical results for identical inputs', () => {
		const config = commConfig('comm-det');
		const creatures = [
			testCreature({ id: 'creature-0', position: { x: 0, y: 0 }, preferredSymbolId: 'glyph-0' }),
			testCreature({ id: 'creature-1', position: { x: 1, y: 0 }, preferredSymbolId: 'glyph-1' }),
			testCreature({ id: 'creature-2', position: { x: 0.5, y: 0.5 }, preferredSymbolId: 'glyph-2' })
		];
		const request: EmissionRequest = {
			senderId: 'creature-0',
			origin: { x: 0, y: 0 },
			context: 'resource_discovered',
			contextDetail: 'food'
		};
		const a = stepCommunication(bareState({ creatures, timeSeconds: 1 }), [request], 1, config);
		const b = stepCommunication(bareState({ creatures, timeSeconds: 1 }), [request], 1, config);
		expect(simulationSnapshot(a)).toBe(simulationSnapshot(b));
	});

	it('keeps simulation state JSON-serialisable', () => {
		const config = commConfig('serial');
		const state = createSimulation({ ...config, creatureCount: 3 });
		const withEmission = stepCommunication(
			state,
			[
				{
					senderId: state.creatures[0]!.id,
					origin: { ...state.creatures[0]!.position },
					context: 'resource_discovered',
					contextDetail: 'water'
				}
			],
			0.5,
			config
		);
		expect(() => JSON.stringify(withEmission)).not.toThrow();
		expect(JSON.parse(JSON.stringify(withEmission))).toEqual(withEmission);
	});
});

describe('discovery integration via stepSimulation', () => {
	it('emits once on search→move discovery and not again while still on the resource', () => {
		const config = {
			...defaultSimulationConfig('disc-once'),
			sensingRadius: 4,
			perceptionIntervalSeconds: 0.01,
			arrivalDistance: 0.1,
			emissionCooldownSeconds: 0
		};
		const base = createSimulation({ ...config, creatureCount: 1 });
		const food = base.habitat.food[0]!;
		const sender = testCreature({
			id: 'creature-0',
			position: { x: food.position.x + 1.5, y: food.position.y },
			hunger: 0.9,
			thirst: 0.05,
			energy: 0.95,
			goal: 'seek_food',
			action: 'search',
			target: { kind: 'point', position: { x: food.position.x + 2, y: food.position.y } },
			searchTarget: { x: food.position.x + 2, y: food.position.y },
			movementSpeed: 0.01,
			nextReconsiderAt: 999,
			preferredSymbolId: 'glyph-0'
		});
		const listener = testCreature({
			id: 'creature-1',
			position: { x: food.position.x + 1.2, y: food.position.y },
			goal: 'wander',
			action: 'wander',
			nextReconsiderAt: 999,
			movementSpeed: 0
		});
		let state: SimulationState = {
			...base,
			creatures: [sender, listener],
			activeEmissions: [],
			recentEmissions: [],
			nextEmissionSeq: 0
		};

		state = stepSimulation(state, config);
		expect(state.recentEmissions).toHaveLength(1);
		expect(state.creatures[0]!.action).toBe('move');
		expect(state.creatures[1]!.recentHeard).toHaveLength(1);

		// Further steps while already moving to the resource must not re-emit
		for (let i = 0; i < 5; i += 1) {
			state = stepSimulation(state, config);
		}
		expect(state.creatures[0]!.emissionCount).toBe(1);
		expect(state.recentEmissions).toHaveLength(1);
	});

	it('does not emit for ordinary wandering', () => {
		const config = {
			...defaultSimulationConfig('no-wander-emit'),
			creatureCount: 2,
			initialHunger: 0,
			initialThirst: 0,
			initialEnergy: 1,
			hungerRisePerSecond: 0,
			thirstRisePerSecond: 0,
			energyDrainPerSecond: 0
		};
		let state = createSimulation(config);
		for (let i = 0; i < 60; i += 1) {
			state = stepSimulation(state, config);
		}
		expect(state.recentEmissions).toHaveLength(0);
		for (const c of state.creatures) {
			expect(c.emissionCount).toBe(0);
			expect(c.recentHeard).toHaveLength(0);
		}
	});
});

describe('helpers', () => {
	it('canEmit respects cooldown', () => {
		expect(canEmit(-1, 0, 4)).toBe(true);
		expect(canEmit(1, 3, 4)).toBe(false);
		expect(canEmit(1, 5, 4)).toBe(true);
	});

	it('appendBounded drops oldest', () => {
		expect(appendBounded([1, 2], 3, 2)).toEqual([2, 3]);
	});
});
