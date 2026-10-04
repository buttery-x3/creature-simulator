import { describe, expect, it } from 'vitest';
import { DEFAULT_ECOLOGY_CONFIG } from '../../ecology';
import { DEFAULT_LIFECYCLE_CONFIG } from '../../lifecycle';
import { emptyLexicon } from '../../learning';
import { createEmptyMemory } from '../../memory';
import { emptySocialState, updateRelationships, type PeerObservation } from '../../social';
import { testCreature } from '../../test-creature';
import { arbitrate } from '../arbitrate';
import { DEFAULT_COGNITION_CONFIG } from '../score-constants';
import type { ArbitrationInput } from '../types';
import { buildCourtshipCandidate } from './courtship-candidate';

const peer: PeerObservation = {
	id: 'familiar',
	mature: true,
	position: { x: 0.5, y: 0 },
	observedAt: 25,
	expression: null
};

function input(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
	let social = emptySocialState();
	for (let step = 0; step <= 100; step++) {
		const time = step / 4;
		social = updateRelationships(social, [{ ...peer, observedAt: time }], time, 0.25, true);
	}
	const actor = testCreature();
	return {
		timeSeconds: 25,
		trigger: 'periodic',
		position: { x: 0, y: 0 },
		hunger: 0.1,
		thirst: 0.1,
		energy: 1,
		verbosity: 0,
		curiosity: 0,
		availableFood: [],
		availableWater: [],
		memory: createEmptyMemory(8),
		lexicon: emptyLexicon(),
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home',
		config: DEFAULT_COGNITION_CONFIG,
		physical: {
			body: actor.body,
			wildlife: [],
			bounds: { width: 20, height: 14 },
			ecology: DEFAULT_ECOLOGY_CONFIG
		},
		lifecycle: {
			state: { ...actor.lifecycle, ageSeconds: 120, nextReproductionAt: 0 },
			config: DEFAULT_LIFECYCLE_CONFIG
		},
		social: { state: social, peers: [peer] },
		...overrides
	};
}

describe('locally motivated courtship', () => {
	it('acquired familiarity and comfortable contact can support courtship through ordinary arbitration', () => {
		const state = input();
		const candidate = buildCourtshipCandidate(state);
		expect(candidate.valid).toBe(true);
		expect(candidate.target).toEqual({ kind: 'creature', creatureId: peer.id });
		expect(candidate.baseScore).toBeGreaterThan(state.config.exploreBaseline);
		expect(arbitrate(state).selectedIntention).toBe('court_peer');
	});

	it('keeps contact-range targets valid so mutual interaction can accumulate', () => {
		const state = input();
		for (const x of [0, 0.5, 1, 2]) {
			expect(
				buildCourtshipCandidate({
					...state,
					social: { ...state.social!, peers: [{ ...peer, position: { x, y: 0 } }] }
				}).valid
			).toBe(true);
		}
	});

	it('requires current mature appearance and an acquired relationship rather than remembered identity alone', () => {
		const state = input();
		for (const peers of [
			[],
			[{ ...peer, mature: false }],
			[{ ...peer, observedAt: 24 }],
			[{ ...peer, id: 'stranger' }]
		]) {
			expect(buildCourtshipCandidate({ ...state, social: { ...state.social!, peers } }).valid).toBe(
				false
			);
		}
		const forgotten = { ...state, social: { ...state.social!, state: emptySocialState() } };
		expect(buildCourtshipCandidate(forgotten).valid).toBe(false);
	});

	it.each(['hunger', 'thirst', 'energy', 'health', 'maturity', 'cooldown'])(
		'respects own %s eligibility',
		(condition) => {
			const state = input();
			if (condition === 'hunger' || condition === 'thirst') state[condition] = 0.8;
			if (condition === 'energy') state.energy = 0.3;
			if (condition === 'health') state.physical!.body = { ...state.physical!.body, health: 0.3 };
			if (condition === 'maturity') state.lifecycle!.state.ageSeconds = 10;
			if (condition === 'cooldown') state.lifecycle!.state.nextReproductionAt = 30;
			expect(buildCourtshipCandidate(state)).toMatchObject({
				valid: false,
				rejectionReason: 'reproductive_ineligible'
			});
		}
	);

	it('does not inspect a peer private hunger, cooldown, or intention', () => {
		const state = input();
		const guarded = { ...peer };
		for (const key of ['hunger', 'thirst', 'energy', 'lifecycle', 'intention']) {
			Object.defineProperty(guarded, key, {
				get() {
					throw new Error(`private ${key} read`);
				}
			});
		}
		expect(
			buildCourtshipCandidate({ ...state, social: { ...state.social!, peers: [guarded] } })
		).toEqual(buildCourtshipCandidate(state));
	});

	it('forgets stale affiliation and resolves eligible equal peers by stable identity', () => {
		const state = input();
		const relationship = state.social!.state.relationships[0]!;
		state.social!.state.relationships = [
			{ ...relationship, peerId: 'a' },
			{ ...relationship, peerId: 'z' }
		];
		state.social!.peers = [
			{ ...peer, id: 'z' },
			{ ...peer, id: 'a' }
		];
		expect(buildCourtshipCandidate(state).target).toEqual({ kind: 'creature', creatureId: 'a' });
		expect(
			buildCourtshipCandidate({
				...state,
				social: { ...state.social!, peers: [...state.social!.peers].reverse() }
			})
		).toEqual(buildCourtshipCandidate(state));
		state.social!.state.relationships.forEach((row) => {
			row.lastSeenAt = -200;
		});
		expect(buildCourtshipCandidate(state).valid).toBe(false);
	});

	it('strong direct danger and urgent needs beat courtship without a separate controller', () => {
		const state = input({ currentIntention: 'court_peer' });
		state.physical!.wildlife = [
			{
				id: 'threat',
				position: { x: 0.5, y: 0 },
				size: 3,
				physicality: 3,
				health: 1,
				energy: 1,
				foodAmount: 0,
				observedAt: 25,
				firstObservedAt: 25
			}
		];
		expect(arbitrate(state).selectedIntention).toBe('flee');
		const thirsty = input({ thirst: 0.95, currentIntention: 'court_peer' });
		expect(arbitrate(thirsty).selectedIntention).toBe('satisfy_thirst');
	});
});
