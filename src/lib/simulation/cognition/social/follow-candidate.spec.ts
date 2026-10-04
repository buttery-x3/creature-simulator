import { describe, expect, it } from 'vitest';
import { testCreature } from '../../test-creature';
import { observeCompanionship, updateRelationships, FOLLOW_DEFAULTS } from '../../social';
import type { PeerObservation } from '../../social';
import { DEFAULT_ECOLOGY_CONFIG } from '../../ecology';
import { buildFollowCandidate } from './follow-candidate';
import { arbitrate } from '../arbitrate';
import { DEFAULT_COGNITION_CONFIG } from '../score-constants';
import type { ArbitrationInput } from '../types';

function input(): ArbitrationInput {
	let actor = testCreature();
	for (let tick = 0; tick <= 100; tick++) {
		const time = tick * 0.25;
		const peers: PeerObservation[] = [
			{
				id: 'companion',
				mature: true,
				position: { x: 0.8, y: 0 },
				observedAt: time,
				expression: null
			}
		];
		actor = {
			...actor,
			perceivedPeers: peers,
			social: updateRelationships(actor.social, peers, time, 0.25, true)
		};
		actor = observeCompanionship(actor, time, {
			perceptionIntervalSeconds: 0.25,
			sensingRadius: 3
		});
	}
	for (const [time, x] of [
		[25.25, 1],
		[25.5, 1.2]
	])
		actor = observeCompanionship(
			{
				...actor,
				perceivedPeers: [{ ...actor.perceivedPeers[0]!, position: { x, y: 0 }, observedAt: time }]
			},
			time,
			{ perceptionIntervalSeconds: 0.25, sensingRadius: 3 }
		);
	return {
		timeSeconds: 25.5,
		trigger: 'peer_perception_change',
		position: actor.position,
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		verbosity: 0,
		curiosity: 0,
		availableFood: [],
		availableWater: [],
		memory: actor.memory,
		lexicon: actor.lexicon,
		currentIntention: null,
		currentTarget: null,
		homeFeatureId: 'home',
		config: DEFAULT_COGNITION_CONFIG,
		social: { state: actor.social, peers: actor.perceivedPeers },
		physical: {
			body: actor.body,
			wildlife: [],
			bounds: { width: 20, height: 14 },
			ecology: DEFAULT_ECOLOGY_CONFIG
		}
	};
}

describe('voluntary physical following', () => {
	it('can select a directly encountered departing companion with no learned glyph or resource knowledge', () => {
		const current = { ...input(), thirst: 0.55 };
		expect(Object.values(current.lexicon).every((value) => value === null)).toBe(true);
		expect(buildFollowCandidate(current).valid).toBe(true);
		expect(arbitrate(current).selectedIntention).toBe('follow_peer');
	});
	it('rejects missing contact, lost peers, cooldown and visible predecessor geometry', () => {
		const current = input();
		expect(
			buildFollowCandidate({
				...current,
				social: {
					...current.social!,
					state: {
						...current.social!.state,
						companionship: { ...current.social!.state.companionship, contact: null }
					}
				}
			}).valid
		).toBe(false);
		expect(
			buildFollowCandidate({ ...current, social: { ...current.social!, peers: [] } }).valid
		).toBe(false);
		expect(
			buildFollowCandidate({
				...current,
				social: {
					...current.social!,
					state: {
						...current.social!.state,
						companionship: { ...current.social!.state.companionship, nextEligibleAt: 30 }
					}
				}
			}).rejectionReason
		).toBe('follow_cooldown');
		const peer = current.social!.peers[0]!;
		expect(
			buildFollowCandidate({
				...current,
				social: {
					...current.social!,
					peers: [peer, { ...peer, id: 'ahead', position: { x: 2, y: 0 } }]
				}
			}).rejectionReason
		).toBe('follow_visible_chain');
	});
	it('keeps visible thirst and acute needs above follow including continuity', () => {
		const current = { ...input(), currentIntention: 'follow_peer' as const };
		for (const condition of [
			{
				thirst: 0.45,
				availableWater: [
					{ featureId: 'water', resourceKind: 'water' as const, position: { x: 1, y: 1 } }
				]
			},
			{ thirst: 1 },
			{ energy: 0.01 }
		]) {
			const result = arbitrate({ ...current, ...condition });
			expect(result.selectedIntention).toBe(
				condition.energy !== undefined ? 'rest' : 'satisfy_thirst'
			);
			expect(
				result.candidates.find((row) => row.intention === 'follow_peer')!.score
			).toBeLessThanOrEqual(FOLLOW_DEFAULTS.maximumUtility);
		}
	});
	it('does not inspect peer intentions, target, lexicon or follow state', () => {
		const current = input();
		const peer = {
			...current.social!.peers[0]!,
			get intention(): string {
				throw Error('private intention');
			},
			get target(): never {
				throw Error('private target');
			},
			get social(): never {
				throw Error('private follow state');
			}
		};
		expect(
			buildFollowCandidate({ ...current, social: { ...current.social!, peers: [peer] } }).valid
		).toBe(true);
	});
});
