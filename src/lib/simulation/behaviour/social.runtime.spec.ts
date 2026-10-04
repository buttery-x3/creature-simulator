import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { SOCIAL_DEFAULTS } from '../social';
import { testCreature } from '../test-creature';
import type { Creature, SimulationState } from '../types';

function fixture() {
	const config = defaultSimulationConfig('local-social-runtime');
	config.ecology.wildlifeCount = 0;
	config.foodSpawnIntervalSeconds = 10_000;
	const base = createSimulation(config);
	const creatures = ['observer', 'peer'].map((id, index) =>
		testCreature({
			id,
			position: { x: index * 0.5, y: 0 },
			movementSpeed: 0,
			verbosity: 0,
			curiosity: 0,
			hunger: 0,
			thirst: 0,
			energy: 1,
			nextReconsiderAt: 0
		})
	);
	const state: SimulationState = {
		...base,
		habitat: { ...base.habitat, food: [], water: [] },
		creatures
	};
	return { state, config };
}

function advance(
	state: SimulationState,
	config: ReturnType<typeof defaultSimulationConfig>,
	seconds: number
) {
	for (let step = 0; step < Math.ceil(seconds / config.fixedDt); step += 1) {
		state = stepSimulation(state, config);
	}
	return state;
}

function observer(state: SimulationState): Creature {
	return state.creatures.find((creature) => creature.id === 'observer')!;
}

function patchObserver(state: SimulationState, patch: Partial<Creature>): SimulationState {
	return {
		...state,
		creatures: state.creatures.map((creature) =>
			creature.id === 'observer' ? { ...creature, ...patch } : creature
		)
	};
}

describe('local social simulation integration', () => {
	it('builds bounded familiarity from actual local contact and never unseen population members', () => {
		const { state, config } = fixture();
		state.creatures = [
			state.creatures[0],
			...Array.from({ length: SOCIAL_DEFAULTS.peerCapacity + 3 }, (_, index) =>
				testCreature({
					...state.creatures[1],
					id: `near-${index.toString().padStart(2, '0')}`,
					position: { x: 0.5 + index * 0.03, y: 0 }
				})
			),
			testCreature({ ...state.creatures[1], id: 'hidden', position: { x: 8, y: 8 } })
		];
		const next = observer(advance(state, config, 2));
		expect(next.perceivedPeers.length).toBe(SOCIAL_DEFAULTS.peerCapacity);
		expect(next.social.relationships.length).toBe(SOCIAL_DEFAULTS.relationshipCapacity);
		expect(next.social.relationships.some((row) => row.familiarity > 0)).toBe(true);
		expect(
			next.social.relationships.every((row) => row.familiarity >= 0 && row.familiarity <= 1)
		).toBe(true);
		expect(next.social.relationships.some((row) => row.peerId === 'hidden')).toBe(false);
		expect(next.perceivedPeers.some((peer) => peer.id === 'hidden')).toBe(false);
	});

	it('releases a moving peer target on loss of local sight without following hidden coordinates', () => {
		const { state, config } = fixture();
		state.creatures[1].position = { x: 2, y: 0 };
		let sensed = stepSimulation(state, config);
		sensed = patchObserver(sensed, {
			intention: 'approach_peer',
			action: 'move',
			target: { kind: 'creature', creatureId: 'peer' },
			movementSpeed: 1,
			nextReconsiderAt: 100,
			perception: { ...observer(sensed).perception, lastUpdatedAt: -1 }
		});
		const hidden = (x: number) => ({
			...sensed,
			creatures: sensed.creatures.map((creature) =>
				creature.id === 'peer' ? { ...creature, position: { x, y: 8 } } : creature
			)
		});
		const left = observer(stepSimulation(hidden(-8), config));
		const right = observer(stepSimulation(hidden(8), config));
		expect(left).toEqual(right);
		expect(left.target?.kind).not.toBe('creature');
		expect(left.intention).not.toBe('approach_peer');
		expect(left.perceivedPeers).toEqual([]);
	});

	it.each(['dance', 'cry'] as const)(
		'executes %s without creating symbols or learned translations',
		(kind) => {
			const { config, state } = fixture();
			if (kind === 'cry') state.creatures[0].body.health = 0.2;
			const first = stepSimulation(state, config);
			expect(observer(first).action).toBe(kind);
			expect(observer(first).social.expression?.kind).toBe(kind);
			const next = advance(first, config, 0.5);
			for (const creature of next.creatures) {
				expect(creature.emissionCount).toBe(0);
				expect(creature.recentHeard).toEqual([]);
				expect(creature.recentLearning).toEqual([]);
				expect(creature.symbolAssociations).toEqual(state.creatures[0].symbolAssociations);
				expect(creature.lexicon).toEqual(state.creatures[0].lexicon);
			}
			expect(
				next.creatures[1].perceivedPeers.find((peer) => peer.id === 'observer')?.expression?.kind
			).toBe(kind);
		}
	);

	it('keeps one display identity through reconsideration, expires, and respects its start cooldown', () => {
		const { state, config } = fixture();
		config.reconsiderIntervalSeconds = 0.1;
		const first = stepSimulation(state, config);
		const expression = observer(first).social.expression!;
		expect(expression).not.toBeNull();
		const during = observer(advance(first, config, 0.5));
		expect(during.social.expression?.id).toBe(expression.id);
		expect(during.social.expression?.startedAt).toBe(expression.startedAt);
		expect(during.social.expressionSequence).toBe(1);
		const after = observer(advance(first, config, 3));
		expect(after.social.expression).toBeNull();
		expect(after.social.expressionSequence).toBe(1);
		expect(after.social.nextExpressionAt).toBe(
			expression.startedAt + SOCIAL_DEFAULTS.expressionCooldownSeconds
		);
		expect(['dance', 'cry']).not.toContain(after.action);
	});

	it.each(['dance', 'cry'] as const)(
		'lets urgent need and danger interrupt %s through arbitration',
		(kind) => {
			const { state, config } = fixture();
			if (kind === 'cry') state.creatures[0].body.health = 0.2;
			const displaying = stepSimulation(state, config);
			expect(observer(displaying).action).toBe(kind);
			const thirsty = patchObserver(displaying, { thirst: 1, nextReconsiderAt: 0 });
			const need = observer(stepSimulation(thirsty, config));
			expect(need.intention).toBe('satisfy_thirst');
			expect(need.social.expression).toBeNull();
			const exposed = patchObserver(displaying, {
				perception: { ...observer(displaying).perception, lastUpdatedAt: -1 }
			});
			exposed.wildlife = [
				{
					id: 'predator',
					position: { x: 0.5, y: 0 },
					facing: 0,
					size: 2,
					physicality: 2,
					energy: 1,
					health: 1,
					foodAmount: 0,
					nextAttackAt: 100,
					patrolPhase: 0,
					mode: 'approach'
				}
			];
			const danger = observer(stepSimulation(exposed, config));
			expect(danger.intention).toBe('flee');
			expect(danger.social.expression).toBeNull();
		}
	);

	it('keeps moderate social competition below an acute unknown resource need', () => {
		const { state, config } = fixture();
		const acquainted = advance(state, config, 2);
		const next = observer(
			stepSimulation(
				patchObserver(acquainted, {
					hunger: 1,
					nextReconsiderAt: 0
				}),
				config
			)
		);
		expect(next.social.relationships[0].familiarity).toBeGreaterThan(0);
		expect(next.intention).toBe('satisfy_hunger');
		expect(next.action).toBe('search');
	});

	it('completes a peer approach at comfortable distance instead of pursuing forever', () => {
		const { state, config } = fixture();
		state.creatures[1].position = { x: 1.01, y: 0 };
		let sensed = stepSimulation(state, config);
		sensed = patchObserver(sensed, {
			intention: 'approach_peer',
			action: 'move',
			target: { kind: 'creature', creatureId: 'peer' },
			movementSpeed: 1,
			nextReconsiderAt: 100
		});
		const arrived = observer(stepSimulation(sensed, config));
		expect(arrived.position.x).toBeGreaterThan(0);
		expect(arrived.position.x).toBeLessThan(0.1);
		expect(arrived.intention).not.toBe('approach_peer');
		expect(arrived.lastArbitration?.trigger).toBe('action_complete');
	});

	it('voluntarily approaches a learned familiar peer when a matched stranger remains below exploration', () => {
		const { state, config } = fixture();
		config.hungerRisePerSecond = 0;
		config.thirstRisePerSecond = 0;
		config.energyDrainPerSecond = 0;
		config.ecology.activityHungerCostPerSecond = 0;
		config.ecology.movementEnergyCostPerUnit = 0;
		state.creatures[1].position = { x: 1.2, y: 0 };
		// Experimental fixed positions isolate contact learning; ordinary display costs remain.
		let acquainted = advance(state, config, 120);
		for (let step = 0; step < 60 && observer(acquainted).social.expression; step += 1) {
			acquainted = stepSimulation(acquainted, config);
		}
		const learned = observer(acquainted).social.relationships.find((row) => row.peerId === 'peer')!;
		expect(learned.familiarity).toBeGreaterThan(0.9);
		expect(learned.liking).toBeGreaterThan(0.6);
		expect(observer(acquainted).position).toEqual({ x: 0, y: 0 });
		const ready = patchObserver(acquainted, {
			movementSpeed: 1,
			nextReconsiderAt: 0,
			perception: { ...observer(acquainted).perception, lastUpdatedAt: -1 }
		});
		// Same welfare and display cooldown; only the seen peer identity is unfamiliar.
		const stranger = {
			...ready,
			creatures: ready.creatures.map((creature) =>
				creature.id === 'peer' ? { ...creature, id: 'stranger' } : creature
			)
		};
		let approached = stepSimulation(ready, config);
		const familiarChoice = observer(approached);
		const unfamiliarChoice = observer(stepSimulation(stranger, config));
		expect(familiarChoice.intention).toBe('approach_peer');
		expect(familiarChoice.target).toEqual({ kind: 'creature', creatureId: 'peer' });
		expect(unfamiliarChoice.intention).not.toBe('approach_peer');
		const familiarScore = familiarChoice.lastArbitration!.candidates.find(
			(candidate) => candidate.intention === 'approach_peer'
		)!;
		const strangerScore = unfamiliarChoice.lastArbitration!.candidates.find(
			(candidate) => candidate.intention === 'approach_peer'
		)!;
		expect(familiarScore.baseScore).toBeGreaterThan(config.exploreBaseline);
		expect(strangerScore.score).toBeLessThan(config.exploreBaseline);
		expect(familiarChoice.position.x).toBeGreaterThan(0);
		for (let step = 0; step < 60 && observer(approached).intention === 'approach_peer'; step += 1) {
			approached = stepSimulation(approached, config);
		}
		const arrived = observer(approached);
		expect(arrived.intention).not.toBe('approach_peer');
		expect(Math.hypot(arrived.position.x - 1.2, arrived.position.y)).toBeLessThanOrEqual(
			SOCIAL_DEFAULTS.comfortDistance
		);
		expect(arrived.lastArbitration?.trigger).toBe('action_complete');
	});

	it('produces the same individual outcomes from reversed population iteration order', () => {
		const { state, config } = fixture();
		state.creatures.push(
			testCreature({ ...state.creatures[1], id: 'third', position: { x: -0.5, y: 0 } })
		);
		const reversed = { ...state, creatures: [...state.creatures].reverse() };
		const forwardResult = advance(state, config, 3);
		const reverseResult = advance(reversed, config, 3);
		const sorted = (creatures: Creature[]) =>
			[...creatures].sort((a, b) => a.id.localeCompare(b.id));
		expect(sorted(forwardResult.creatures)).toEqual(sorted(reverseResult.creatures));
		expect(forwardResult.habitat).toEqual(reverseResult.habitat);
		expect(forwardResult.recentEmissions).toEqual(reverseResult.recentEmissions);
	});
});
