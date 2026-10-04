import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepSimulation } from '../step-simulation';
import { createNewborn } from '../creation/creatures';
import type { SimulationState } from '../types';

function fixture() {
	const config = defaultSimulationConfig('lifecycle-runtime');
	config.creatureCount = 2;
	config.ecology.wildlifeCount = 0;
	config.ecology.activityHungerCostPerSecond = 0;
	config.hungerRisePerSecond = config.thirstRisePerSecond = config.energyDrainPerSecond = 0;
	config.foodSpawnIntervalSeconds = 10000;
	const state = createSimulation(config);
	state.habitat = { ...state.habitat, food: [], water: [] };
	state.creatures = state.creatures.map((c, index) => ({
		...c,
		position: { x: index * 0.5, y: 0 },
		movementSpeed: 0,
		hunger: 0.05,
		thirst: 0.05,
		energy: 1,
		verbosity: 0,
		curiosity: 0,
		social: {
			...c.social,
			relationships: [
				{
					peerId: `creature-${1 - index}`,
					familiarity: 1,
					liking: 0.8,
					lastSeenAt: 0,
					lastExpressionId: null
				}
			]
		}
	}));
	return { state, config };
}
function advance(
	state: SimulationState,
	config: ReturnType<typeof defaultSimulationConfig>,
	seconds: number
) {
	for (let i = 0; i < Math.ceil(seconds / config.fixedDt); i++)
		state = stepSimulation(state, config);
	return state;
}

describe('lifecycle integration', () => {
	it('ordinary arbitration selects reciprocal courtship and creates a fresh juvenile after sustained contact', () => {
		const setup = fixture();
		let state = setup.state;
		const config = setup.config;
		state.creatures[0].lexicon.food = 'glyph-0';
		let sawMutual = false;
		for (let i = 0; i < 150 && state.nextCreatureId === 2; i++) {
			state = stepSimulation(state, config);
			sawMutual ||= state.creatures
				.slice(0, 2)
				.every((c) => c.intention === 'court_peer' && c.action === 'court');
		}
		expect(sawMutual).toBe(true);
		expect(state.nextCreatureId).toBe(3);
		const child = state.creatures.find((c) => c.id === 'creature-2')!;
		expect(child.lifecycle).toMatchObject({
			ageSeconds: 0,
			generation: 1,
			parentIds: ['creature-0', 'creature-1']
		});
		expect(child.body.size).toBeCloseTo(
			child.lifecycle.adultBody.size * config.lifecycle.newbornBodyScale
		);
		expect(child.lexicon).toEqual({ food: null, water: null, danger: null });
		expect(child.memory.entries).toEqual([]);
		expect(child.social.relationships).toEqual([]);
		expect(child.exploration.map.lastFullySensedAt.every((t) => t === null)).toBe(true);
		expect(state.creatures[0].lifecycle.nextReproductionAt).toBeGreaterThan(state.timeSeconds);
		expect(state.creatures[0].energy).toBeLessThan(0.81);
		expect(state.recentLifeEvents.filter((e) => e.kind === 'birth')).toHaveLength(1);
		expect(advance(state, config, 5).nextCreatureId).toBe(3);
	});
	it('fresh newborn state is independent and uses authoritative simulation seed', () => {
		const { state, config } = fixture();
		const birth = {
			id: 'creature-9',
			position: { x: 0, y: 0 },
			parentIds: ['creature-0', 'creature-1'] as [string, string],
			generation: 1
		};
		const a = createNewborn(config, state.habitat, state.seed, birth, 20);
		const unrelatedConfig = { ...config, seed: 'unrelated-ui-default' };
		const b = createNewborn(unrelatedConfig, state.habitat, state.seed, birth, 20);
		expect(a).toEqual(b);
		expect(a.memory).not.toBe(b.memory);
		expect(a.social).not.toBe(b.social);
		expect(a.exploration.map.lastFullySensedAt).not.toBe(b.exploration.map.lastFullySensedAt);
		expect(a.intentionStartedAt).toBe(20);
	});
	it('one willing creature cannot reproduce with a hungry partner and releases the attempt', () => {
		const { state, config } = fixture();
		state.creatures[1].hunger = 1;
		const next = advance(state, config, 7);
		expect(next.nextCreatureId).toBe(2);
		expect(
			next.recentLifeEvents.some((e) => e.kind === 'courtship_failed' && e.reason === 'timeout')
		).toBe(true);
		expect(next.creatures[0].lifecycle.courtship).toBeNull();
		expect(next.creatures[0].lifecycle.nextReproductionAt).toBeGreaterThan(next.timeSeconds);
	});
	it('acute thirst interrupts a mutual attempt without producing an offspring', () => {
		const { state, config } = fixture();
		let next = advance(state, config, 2);
		expect(next.creatures.every((c) => c.lifecycle.courtship !== null)).toBe(true);
		next.creatures[0] = { ...next.creatures[0], thirst: 1, pendingArbitrationTrigger: 'periodic' };
		next = advance(next, config, 2);
		expect(next.nextCreatureId).toBe(2);
		expect(next.creatures[0].intention).toBe('satisfy_thirst');
		expect(next.creatures[0].lifecycle.courtship).toBeNull();
	});
	it('removes deprivation deaths, bounds observer history, preserves survivor memories and never reuses IDs', () => {
		const { state, config } = fixture();
		config.lifecycle.eventHistoryLimit = 1;
		state.creatures = state.creatures.map((c) => ({
			...c,
			hunger: 1,
			body: { ...c.body, health: 0.00001 },
			lifecycle: {
				...c.lifecycle,
				deprivationSeconds: { hunger: config.lifecycle.hungerGraceSeconds + 1, thirst: 0 }
			}
		}));
		const next = stepSimulation(state, config);
		expect(next.creatures).toEqual([]);
		expect(next.nextCreatureId).toBe(2);
		expect(next.recentLifeEvents).toHaveLength(1);
		expect(next.recentLifeEvents[0]).toMatchObject({ kind: 'death', cause: 'deprivation' });
		expect(advance(next, config, 1).creatures).toEqual([]);
	});
	it('replays reciprocal births exactly regardless of population iteration order', () => {
		const { state, config } = fixture();
		const first = advance(state, config, 4);
		const reversed = advance({ ...state, creatures: [...state.creatures].reverse() }, config, 4);
		const ordered = (value: SimulationState) => ({
			...value,
			creatures: [...value.creatures].sort((a, b) => a.id.localeCompare(b.id))
		});
		expect(ordered(first)).toEqual(ordered(reversed));
	});
});
