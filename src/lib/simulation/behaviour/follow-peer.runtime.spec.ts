import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { emptyCompanionshipState, FOLLOW_DEFAULTS } from '../social';
import { testCreature } from '../test-creature';
import type { Creature, SimulationState } from '../types';

type Config = ReturnType<typeof defaultSimulationConfig>;
const follower = (state: SimulationState) => state.creatures[0];
function patch(state: SimulationState, changes: Partial<Creature>): SimulationState {
	return { ...state, creatures: [{ ...follower(state), ...changes }, ...state.creatures.slice(1)] };
}
function advance(state: SimulationState, config: Config, seconds: number): SimulationState {
	for (let i = 0; i < Math.ceil(seconds / config.fixedDt); i++)
		state = stepSimulation(state, config);
	return state;
}

/** Frozen mobility isolates actual local relationship acquisition from wandering and courtship. */
function acquainted(fixedWater = false) {
	const config = defaultSimulationConfig('follow-local-runtime');
	config.ecology.wildlifeCount = 0;
	config.foodSpawnIntervalSeconds = 10_000;
	config.hungerRisePerSecond = config.thirstRisePerSecond = config.energyDrainPerSecond = 0;
	config.ecology.activityHungerCostPerSecond = config.ecology.movementEnergyCostPerUnit = 0;
	let state = createSimulation(config);
	state.habitat = { ...state.habitat, food: [], water: [] };
	state.creatures = ['follower', 'peer'].map((id, index) => {
		const creature = testCreature({
			id,
			position: { x: index * 0.8, y: 0 },
			movementSpeed: 0,
			hunger: 0,
			thirst: 0,
			energy: 1,
			curiosity: 0,
			verbosity: 0
		});
		return {
			...creature,
			social: { ...creature.social, nextExpressionAt: 10_000 },
			lifecycle: { ...creature.lifecycle, nextReproductionAt: 10_000 }
		};
	});
	if (fixedWater) {
		state.habitat.water = [
			{
				id: 'distant-water',
				kind: 'water',
				position: { x: 5, y: 0 },
				size: { width: 0.5, height: 0.5 },
				amount: 10,
				capacity: 10
			}
		];
		// Only the peer visits sensing range first; its memory then survives the local encounter.
		state.creatures[1].position = { x: 3, y: 0 };
		state = stepSimulation(state, config);
		state.creatures[1].position = { x: 0.8, y: 0 };
	}
	state = advance(state, config, 50);
	expect(follower(state).social.relationships[0].familiarity).toBeGreaterThan(0.2);
	expect(follower(state).social.relationships[0].liking).toBeGreaterThan(0.04);
	return { state, config };
}

/** Controlled peer trajectories pass through ordinary sensing and arbitration each fixed step. */
function depart(state: SimulationState, config: Config, seconds = 1.5, speed = 0.6) {
	state = patch(state, { movementSpeed: 1, nextReconsiderAt: 0 });
	for (let i = 0; i < Math.ceil(seconds / config.fixedDt); i++) {
		state.creatures[1] = {
			...state.creatures[1],
			position: {
				x: state.creatures[1].position.x + speed * config.fixedDt,
				y: 0
			}
		};
		state = stepSimulation(state, config);
	}
	return state;
}
function following() {
	const { state, config } = acquainted();
	const next = depart(state, config);
	expect(follower(next).intention).toBe('follow_peer');
	expect(follower(next).social.companionship.active).not.toBeNull();
	return { state: next, config };
}

describe('physical local companionship runtime', () => {
	it('follows a peer seeking remembered water until the fixed basin enters personal sight', () => {
		const scenario = acquainted(true);
		const config = scenario.config;
		let state = patch(scenario.state, { thirst: 0.55, movementSpeed: 1, nextReconsiderAt: 0 });
		state.creatures[1] = {
			...state.creatures[1],
			thirst: 0.8,
			movementSpeed: 0.6,
			facing: 0,
			nextReconsiderAt: 0
		};
		expect(follower(state).perception.perceivedWaterIds).toEqual([]);
		expect(
			follower(state).memory.entries.some((entry) => entry.kind === 'resource_observation')
		).toBe(false);
		expect(
			state.creatures[1].memory.entries.some(
				(entry) => entry.kind === 'resource_observation' && entry.featureId === 'distant-water'
			)
		).toBe(true);
		let control = patch(state, {
			social: { ...follower(state).social, companionship: emptyCompanionshipState() }
		});
		const fixedPosition = { ...state.habitat.water[0].position };
		let followed = false;
		let controlFollowed = false;
		let found = false;
		for (let i = 0; i < Math.ceil(8 / config.fixedDt); i++) {
			state = stepSimulation(state, config);
			control = stepSimulation(control, config);
			if (i === 0) {
				expect(state.creatures[1].intention).toBe('satisfy_thirst');
				expect(state.creatures[1].target).toEqual({ kind: 'point', position: fixedPosition });
			}
			followed ||= follower(state).intention === 'follow_peer';
			controlFollowed ||= follower(control).intention === 'follow_peer';
			if (follower(state).perception.perceivedWaterIds.includes('distant-water')) {
				found = true;
				break;
			}
			expect(
				follower(state).memory.entries.some((entry) => entry.kind === 'resource_observation')
			).toBe(false);
		}
		expect(followed).toBe(true);
		expect(controlFollowed).toBe(false);
		expect(found).toBe(true);
		expect(state.habitat.water[0].position).toEqual(fixedPosition);
		expect(follower(state).position.x).toBeGreaterThan(1.5);
		expect(follower(state).intention).toBe('satisfy_thirst');
		expect(follower(state).target).toMatchObject({ kind: 'feature', featureId: 'distant-water' });
		expect(follower(state).social.companionship.lastOutcome?.reason).toBe('resource_found');
		expect(state.recentEmissions).toEqual([]);
	});

	it('selects following after learned affinity and direct stationary contact, preserving spacing without signals', () => {
		const { state, config } = following();
		const next = depart(state, config, 1);
		expect(follower(next).position.x).toBeGreaterThan(0);
		const distance = Math.hypot(
			next.creatures[1].position.x - follower(next).position.x,
			next.creatures[1].position.y - follower(next).position.y
		);
		expect(distance).toBeGreaterThanOrEqual(FOLLOW_DEFAULTS.nearDistance);
		expect(distance).toBeLessThan(FOLLOW_DEFAULTS.farDistance + 0.25);
		expect(next.recentEmissions).toEqual([]);
		expect(follower(next).lexicon.approach).toBeNull();
	});

	it('hands off to personally visible water through ordinary need arbitration', () => {
		const scenario = following();
		const config = scenario.config;
		let state = scenario.state;
		state = patch(state, {
			thirst: 0.75,
			nextReconsiderAt: 0,
			perception: { ...follower(state).perception, lastUpdatedAt: -1 }
		});
		state.habitat = {
			...state.habitat,
			water: [
				{
					id: 'local-water',
					kind: 'water',
					position: { x: follower(state).position.x + 1, y: 0 },
					size: { width: 0.5, height: 0.5 },
					amount: 10,
					capacity: 10
				}
			]
		};
		const next = stepSimulation(state, config);
		expect(follower(next).intention).toBe('satisfy_thirst');
		expect(follower(next).target).toMatchObject({ kind: 'feature', featureId: 'local-water' });
		expect(follower(next).social.companionship.lastOutcome?.reason).toBe('resource_found');
		expect(follower(next).social.companionship.active).toBeNull();
	});

	it('releases for acute need or immediately observed danger without locking the episode', () => {
		const { state, config } = following();
		const thirsty = stepSimulation(patch(state, { thirst: 1, nextReconsiderAt: 0 }), config);
		expect(follower(thirsty).intention).toBe('satisfy_thirst');
		expect(follower(thirsty).social.companionship.active).toBeNull();
		const exposed = patch(state, {
			perception: { ...follower(state).perception, lastUpdatedAt: -1 }
		});
		exposed.wildlife = [
			{
				id: 'predator',
				position: { x: follower(state).position.x + 0.5, y: 0 },
				facing: 0,
				size: 2,
				physicality: 2,
				energy: 1,
				health: 1,
				foodAmount: 0,
				nextAttackAt: 1000,
				patrolPhase: 0,
				mode: 'approach'
			}
		];
		const endangered = stepSimulation(exposed, config);
		expect(follower(endangered).intention).toBe('flee');
		expect(follower(endangered).social.companionship.active).toBeNull();
	});

	it('forgets the local target on sight loss independently of its hidden position', () => {
		const { state, config } = following();
		const hidden = (x: number) => {
			const next = patch(state, {
				perception: { ...follower(state).perception, lastUpdatedAt: -1 }
			});
			next.creatures[1] = { ...next.creatures[1], position: { x, y: 8 } };
			return follower(stepSimulation(next, config));
		};
		const left = hidden(-8);
		expect(left).toEqual(hidden(8));
		expect(left.intention).not.toBe('follow_peer');
		expect(left.social.companionship.lastOutcome?.reason).toBe('lost_contact');
		expect(left.social.companionship.active).toBeNull();
	});

	it('stops following a stationary peer and cannot restart during cooldown', () => {
		const { state, config } = following();
		const stopped = advance(state, config, 2);
		expect(follower(stopped).intention).not.toBe('follow_peer');
		expect(follower(stopped).social.companionship.lastOutcome?.reason).toBe('no_progress');
		const retry = depart(stopped, config, 2);
		expect(follower(retry).social.companionship.active).toBeNull();
		expect(follower(retry).intention).not.toBe('follow_peer');
	});

	it('ends continuous observable travel at the finite episode clock without restarting', () => {
		const scenario = following();
		const config = scenario.config;
		let state = scenario.state;
		const startedAt = follower(state).social.companionship.active!.startedAt;
		while (state.timeSeconds < startedAt + FOLLOW_DEFAULTS.followSeconds + 0.1) {
			state = depart(state, config, config.fixedDt, 0.6);
		}
		const outcome = follower(state).social.companionship.lastOutcome!;
		expect(outcome.reason).toBe('expired');
		expect(outcome.durationSeconds).toBeLessThanOrEqual(
			FOLLOW_DEFAULTS.followSeconds + config.fixedDt + 1e-9
		);
		expect(outcome.travelDistance).toBeLessThanOrEqual(FOLLOW_DEFAULTS.maximumTravel);
		expect(follower(state).intention).not.toBe('follow_peer');
		expect(follower(state).social.companionship.active).toBeNull();
	});

	it('does not turn visible following into a multi-peer chain or a turn-back loop', () => {
		const { state, config } = following();
		const ready = patch(state, {
			perception: { ...follower(state).perception, lastUpdatedAt: -1 }
		});
		const peer = ready.creatures[1];
		const chained = {
			...ready,
			creatures: [
				...ready.creatures,
				{ ...peer, id: 'visible-predecessor', position: { x: peer.position.x + 0.5, y: 0 } }
			]
		};
		const stopped = follower(stepSimulation(chained, config));
		expect(stopped.social.companionship.lastOutcome?.reason).toBe('visible_chain');
		expect(stopped.intention).not.toBe('follow_peer');
		const turned = {
			...ready,
			creatures: [ready.creatures[0], { ...peer, position: { x: peer.position.x - 0.1, y: 0 } }]
		};
		const returning = follower(stepSimulation(turned, config));
		expect(returning.social.companionship.lastOutcome?.reason).toBe('turn_back');
		expect(returning.intention).not.toBe('follow_peer');
	});

	it('cannot substitute an unfamiliar passing peer for acquired affinity', () => {
		const { state, config } = acquainted();
		state.creatures[1] = { ...state.creatures[1], id: 'stranger' };
		const contact = advance(state, config, 1);
		const next = depart(contact, config);
		expect(follower(next).intention).not.toBe('follow_peer');
		expect(follower(next).social.companionship.active).toBeNull();
	});
});
