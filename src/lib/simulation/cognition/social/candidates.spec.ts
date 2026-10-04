import { describe, expect, it } from 'vitest';
import { DEFAULT_COGNITION_CONFIG } from '../score-constants';
import { arbitrate } from '../arbitrate';
import type { ArbitrationInput } from '../types';
import { createEmptyMemory } from '../../memory';
import { emptyLexicon } from '../../learning';
import { emptySocialState, SOCIAL_DEFAULTS, type PeerObservation } from '../../social';
import { buildSocialCandidates } from './candidates';

const peer: PeerObservation = {
	id: 'friend',
	position: { x: 2, y: 0 },
	observedAt: 1,
	expression: null
};
function input(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
	const state = emptySocialState();
	state.relationships = [
		{ peerId: peer.id, familiarity: 0.8, liking: 0.8, lastSeenAt: 1, lastExpressionId: null }
	];
	return {
		timeSeconds: 1,
		trigger: 'periodic',
		position: { x: 0, y: 0 },
		hunger: 0.1,
		thirst: 0.1,
		energy: 0.95,
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
		social: { state, peers: [peer] },
		...overrides
	};
}
const byKind = (state: ArbitrationInput, kind: string) =>
	buildSocialCandidates(state).find((c) => c.intention === kind)!;

describe('voluntary social candidates', () => {
	it('keeps all three optional social candidates invalid without a social snapshot', () => {
		const candidates = buildSocialCandidates(input({ social: undefined }));
		expect(candidates).toHaveLength(3);
		expect(candidates.every((candidate) => !candidate.valid)).toBe(true);
	});

	it('targets only currently observed peers, stopping at comfortable distance', () => {
		const state = input();
		expect(byKind(state, 'approach_peer').target).toEqual({
			kind: 'creature',
			creatureId: peer.id
		});
		for (const peers of [
			[],
			[{ ...peer, observedAt: 0 }],
			[{ ...peer, position: { x: SOCIAL_DEFAULTS.comfortDistance, y: 0 } }]
		]) {
			expect(byKind({ ...state, social: { ...state.social!, peers } }, 'approach_peer').valid).toBe(
				false
			);
		}
	});

	it('known liking and an observable cry affect approach utility without copying internal distress', () => {
		const known = input();
		const stranger = { ...known, social: { ...known.social!, state: emptySocialState() } };
		expect(byKind(known, 'approach_peer').baseScore).toBeGreaterThan(
			byKind(stranger, 'approach_peer').baseScore
		);
		const crying = {
			...stranger,
			social: {
				...stranger.social!,
				peers: [{ ...peer, expression: { id: 'cry-1', kind: 'cry' as const, intensity: 1 } }]
			}
		};
		expect(byKind(crying, 'approach_peer').baseScore).toBeGreaterThan(
			byKind(stranger, 'approach_peer').baseScore
		);
		expect(byKind(crying, 'cry').valid).toBe(false);
	});

	it('resolves tied peers deterministically and never targets unseen relationships', () => {
		const state = input();
		state.social!.state = emptySocialState();
		state.social!.peers = [
			{ ...peer, id: 'z' },
			{ ...peer, id: 'a' }
		];
		expect(byKind(state, 'approach_peer').target).toEqual({ kind: 'creature', creatureId: 'a' });
		expect(
			buildSocialCandidates({
				...state,
				social: { ...state.social!, peers: [...state.social!.peers].reverse() }
			})
		).toEqual(buildSocialCandidates(state));
	});

	it('allows happy expression with company and distress expression from personal injury', () => {
		const happy = input();
		expect(byKind(happy, 'dance').valid).toBe(true);
		expect(byKind(happy, 'cry').valid).toBe(false);
		const alone = { ...happy, social: { ...happy.social!, peers: [] } };
		expect(byKind(alone, 'dance').valid).toBe(false);
		alone.social.state = { ...alone.social.state, recentPain: 0.8 };
		expect(byKind(alone, 'cry').valid).toBe(true);
	});

	it('retains an active display through reconsideration but enforces cooldown when it ends', () => {
		const state = input();
		state.social!.state = {
			...state.social!.state,
			nextExpressionAt: 12,
			expression: { id: 'dance-1', kind: 'dance', intensity: 0.9, startedAt: 0.5, expiresAt: 1.5 }
		};
		expect(byKind(state, 'dance').reasonCodes).toContain('expression_active');
		expect(byKind(state, 'dance').valid).toBe(true);
		expect(byKind({ ...state, timeSeconds: 1.5 }, 'dance').valid).toBe(false);
	});

	it.each(['hunger', 'thirst', 'energy'] as const)(
		'urgent %s wins against optional social candidates and ongoing expression',
		(need) => {
			const state = input({ currentIntention: 'dance' });
			state.social!.state.expression = {
				id: 'dance-1',
				kind: 'dance',
				intensity: 1,
				startedAt: 0.5,
				expiresAt: 1.5
			};
			state[need] = need === 'energy' ? 0.02 : 0.98;
			const expected =
				need === 'hunger' ? 'satisfy_hunger' : need === 'thirst' ? 'satisfy_thirst' : 'rest';
			expect(arbitrate(state).selectedIntention).toBe(expected);
		}
	);
});

it('healthy ordinary welfare supports a voluntary display, while worsening condition lowers it', () => {
	const healthy = input({ hunger: 0.2, thirst: 0.2, energy: 0.85 });
	healthy.social!.state = emptySocialState();
	const dance = byKind(healthy, 'dance');
	expect(dance.baseScore).toBeGreaterThan(healthy.config.exploreBaseline);
	expect(dance.target).toEqual({ kind: 'point', position: healthy.position });
	expect(
		byKind({ ...healthy, hunger: 0.6, thirst: 0.6, energy: 0.4 }, 'dance').baseScore
	).toBeLessThan(healthy.config.exploreBaseline);
});
