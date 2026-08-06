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
import type { EmissionRequest, ResourceDiscoveryDetail, SignalEmission, SymbolId } from './types';
import { DEFAULT_SYMBOL_INVENTORY } from './types';

function testSelectionEvidence(
	symbolId: SymbolId,
	context: ResourceDiscoveryDetail = 'food'
): SignalEmission['selectionEvidence'] {
	return {
		emissionContext: context,
		selectedSymbolId: symbolId,
		assignedSymbolId: null,
		mode: 'exploratory',
		candidates: DEFAULT_SYMBOL_INVENTORY.map((id) => ({
			symbolId: id,
			eligible: true,
			note: 'exploratory_eligible'
		})),
		sample: 0.5,
		usedFallback: false,
		reason: 'exploratory_prefer_unassigned'
	};
}

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
				symbolSelectionReason: 'exploratory',
				selectionEvidence: testSelectionEvidence('glyph-0', 'food')
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
				symbolSelectionReason: 'exploratory',
				selectionEvidence: testSelectionEvidence('glyph-1', 'water')
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
		expect(DEFAULT_SYMBOL_INVENTORY).toContain(emission.symbolId);
		expect(emission.selectionEvidence.emissionContext).toBe('food');
		expect(emission.selectionEvidence.selectedSymbolId).toBe(emission.symbolId);
		expect(emission.selectionEvidence.candidates.length).toBe(DEFAULT_SYMBOL_INVENTORY.length);
		expect(emission.contextDetail).toBe('food');
		// HeardSignal must not include context or selection weights
		expect(JSON.stringify(emission.selectionEvidence)).toContain('candidates');

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

		const heard = nearNext.recentHeard[0]!;
		expect(JSON.stringify(heard)).not.toContain('contextDetail');
		expect(JSON.stringify(heard)).not.toContain('selectionEvidence');
		expect(JSON.stringify(heard)).not.toContain('effectiveWeight');
		expect(heard).toEqual({
			emissionId: emission.id,
			symbolId: emission.symbolId,
			senderId: emission.senderId,
			origin: emission.origin,
			emittedAt: emission.emittedAt,
			heardAt: 1
		});

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

	it('uses exclusive lexicon so food and water emission may diverge', () => {
		const config = commConfig('context-symbol');
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			preferredSymbolId: 'glyph-1',
			lexicon: { food: 'glyph-0', water: 'glyph-3' },
			lastEmissionAt: -1
		});
		let state = bareState({ creatures: [sender], timeSeconds: 1, seed: 'context-symbol' });
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
		expect(state.activeEmissions[0]!.selectionEvidence.emissionContext).toBe('food');
		expect(state.activeEmissions[0]!.selectionEvidence.mode).toBe('learned_lexicon');
		expect(state.activeEmissions[0]!.symbolId).toBe('glyph-0');

		const senderAfter = {
			...state.creatures[0]!,
			lastEmissionAt: -1,
			lexicon: { food: 'glyph-0', water: 'glyph-3' }
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
		expect(state.activeEmissions[0]!.contextDetail).toBe('water');
		expect(state.activeEmissions[0]!.selectionEvidence.emissionContext).toBe('water');
		expect(state.activeEmissions[0]!.selectionEvidence.mode).toBe('learned_lexicon');
		expect(state.activeEmissions[0]!.symbolId).toBe('glyph-3');
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
			recentEmissions: []
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

	it('selects symbol from exclusive food lexicon rather than preferred only', () => {
		const config = commConfig('lexicon-emit');
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			preferredSymbolId: 'glyph-0',
			lexicon: { food: 'glyph-3', water: null }
		});
		const state = bareState({ creatures: [sender], timeSeconds: 1, seed: 'lexicon-emit' });
		const next = stepCommunication(
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
		expect(next.activeEmissions[0]!.symbolId).toBe('glyph-3');
		expect(next.activeEmissions[0]!.selectionEvidence.mode).toBe('learned_lexicon');
		// Always the lexicon assignment across repeated emissions.
		let glyph3 = 0;
		let current = state;
		for (let i = 0; i < 20; i += 1) {
			const stepped = stepCommunication(
				{
					...current,
					creatures: current.creatures.map((c) =>
						c.id === 'creature-0'
							? {
									...c,
									lastEmissionAt: -1,
									lexicon: { food: 'glyph-3', water: null },
									preferredSymbolId: 'glyph-0'
								}
							: c
					)
				},
				[
					{
						senderId: 'creature-0',
						origin: { x: 0, y: 0 },
						context: 'resource_discovered',
						contextDetail: 'food'
					}
				],
				1 + i,
				config
			);
			const em = stepped.activeEmissions[stepped.activeEmissions.length - 1];
			if (em?.symbolId === 'glyph-3') {
				glyph3 += 1;
			}
			current = stepped;
		}
		expect(glyph3).toBe(20);
	});

	it('does not mutate emitter evidence or lexicon when delivering to listeners', () => {
		const config = commConfig('no-emitter-feedback');
		const associations = DEFAULT_SYMBOL_INVENTORY.map((symbolId) => ({
			symbolId,
			foodStrength: 0.5,
			waterStrength: 0.25,
			foodEvidenceCount: 1,
			waterEvidenceCount: 1
		}));
		const lexicon = { food: 'glyph-0' as const, water: 'glyph-1' as const };
		const sender = testCreature({
			id: 'creature-0',
			position: { x: 0, y: 0 },
			symbolAssociations: associations,
			lexicon
		});
		const listener = testCreature({
			id: 'creature-1',
			position: { x: 1, y: 0 }
		});
		const beforeAssoc = JSON.stringify(associations);
		const beforeLexicon = JSON.stringify(lexicon);
		const next = stepCommunication(
			bareState({ creatures: [sender, listener], timeSeconds: 1 }),
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
		const senderNext = next.creatures.find((c) => c.id === 'creature-0')!;
		expect(JSON.stringify(senderNext.symbolAssociations)).toBe(beforeAssoc);
		expect(JSON.stringify(senderNext.lexicon)).toBe(beforeLexicon);
		expect(next.creatures.find((c) => c.id === 'creature-1')!.recentHeard).toHaveLength(1);
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
