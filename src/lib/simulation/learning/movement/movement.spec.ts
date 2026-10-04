import { describe, expect, it } from 'vitest';
import { defaultSimulationConfig } from '../../creation/config';
import { testCreature } from '../../test-creature';
import type { Creature } from '../../types';
import type { PeerObservation } from '../../social';
import { applyNoEvidenceReduction } from '../signal-associations';
import { resolveCreatureLexicon } from '../lexicon-resolution';
import {
	emptyMovementLearningState,
	hearMovementLearning,
	observeMovementLearning,
	consumeMovementResponse
} from './observations';
import { MOVEMENT_DEFAULTS } from './defaults';

const config = {
	...defaultSimulationConfig('movement-test'),
	perceptionIntervalSeconds: 0.5,
	sensingRadius: 20
};
const peer = (x: number, time: number, id = 'visible-peer'): PeerObservation => ({
	id,
	position: { x, y: 0 },
	observedAt: time,
	mature: true,
	expression: null
});
const receiver = () =>
	testCreature({ movementLearning: emptyMovementLearningState(), perceivedPeers: [peer(2, 0)] });
function sense(
	creature: Creature,
	time: number,
	peers: PeerObservation[],
	selfX = creature.position.x
): Creature {
	return observeMovementLearning(
		{ ...creature, position: { x: selfX, y: 0 }, perceivedPeers: peers },
		time,
		config
	);
}
function hear(
	creature: Creature,
	time = 0,
	emissionId = 'sound-0',
	x = 2,
	symbolId: 'glyph-0' | 'glyph-1' = 'glyph-0'
): Creature {
	return hearMovementLearning(
		creature,
		[{ emissionId, symbolId, origin: { x, y: 0 }, heardAt: time }],
		time,
		config
	);
}
function closeEpisode(creature: Creature, start = 0): Creature {
	let next = sense(creature, start + 0.5, [peer(1.5, start + 0.5)]);
	next = sense(next, start + 1, [peer(1, start + 1)]);
	return sense(next, start + 1.5, [peer(0.8, start + 1.5)]);
}
const approach = (creature: Creature) => creature.symbolAssociations[0]!.evidence.approach;

describe('grounded local approach sequences', () => {
	it('requires two independently observed heard encounters for an exclusive assignment', () => {
		let next = closeEpisode(hear(receiver()));
		expect(approach(next)).toEqual({ strength: 0.25, count: 1 });
		expect(next.lexicon.approach).toBeNull();
		expect(next.movementLearning.encounters[0]!.trace).toMatchObject({
			status: 'confirmed',
			peerTowardDistance: 1.2,
			comfortableContactSeconds: 0.5
		});
		next = sense(next, 14, []);
		expect(next.movementLearning.encounters).toHaveLength(0);
		next = sense(next, 15, [peer(2, 15)]);
		next = closeEpisode(hear(next, 15, 'sound-1'), 15);
		expect(approach(next)).toEqual({ strength: 0.5, count: 2 });
		expect(next.lexicon.approach).toBe('glyph-0');
	});

	it('does not infer approach without hearing or from the receiver moving alone', () => {
		expect(approach(closeEpisode(receiver())).count).toBe(0);
		let next = hear(receiver());
		for (let step = 1; step <= 8; step++)
			next = sense(next, step * 0.5, [peer(2, step * 0.5)], Math.min(1.5, step * 0.4));
		expect(approach(next).count).toBe(0);
		expect(next.movementLearning.encounters[0]!.trace?.status).toBe('contradicted');
	});

	it('never reads diagnostic sender identity, intent, needs or target', () => {
		const event = {
			emissionId: 'private-getters',
			symbolId: 'glyph-0' as const,
			origin: { x: 2, y: 0 },
			heardAt: 0,
			get senderId(): string {
				throw Error('private sender identity read');
			},
			get contextDetail(): string {
				throw Error('private meaning read');
			}
		};
		const next = closeEpisode(hearMovementLearning(receiver(), [event], 0, config));
		expect(approach(next).count).toBe(1);
		expect(JSON.stringify(next.movementLearning)).not.toContain('senderId');
		expect(JSON.stringify(next.movementLearning)).not.toContain('contextDetail');
	});

	it('rejects ambiguous, stale, distant and unseen sources', () => {
		for (const peers of [[], [peer(2, 0), peer(2.1, 0, 'overlap')], [peer(2, -1)], [peer(30, 0)]]) {
			const next = hear({ ...receiver(), perceivedPeers: peers });
			expect(next.movementLearning.encounters.every((row) => !row.trace)).toBe(true);
			expect(next.movementLearning.response).toBeNull();
		}
		expect(
			hear({ ...receiver(), perceivedPeers: [peer(2, 0), peer(2.1, 0, 'overlap')] })
				.movementLearning.lastBinding?.status
		).toBe('ambiguous');
	});

	it('keeps one credited outcome through repeated emissions, alternating glyphs and shared-memory eviction', () => {
		let next = closeEpisode(
			hear({ ...receiver(), memory: { capacity: 1, nextSequence: 0, entries: [] } })
		);
		const onset = next.movementLearning.encounters[0]!.firstObservedAt;
		for (let tick = 4; tick < 60; tick++) {
			const time = tick * 0.5;
			next = sense(next, time, [peer(0.8, time)]);
			next = hear(
				{ ...next, memory: { capacity: 1, nextSequence: tick, entries: [] } },
				time,
				`sound-${tick}`,
				0.8,
				tick % 2 ? 'glyph-0' : 'glyph-1'
			);
		}
		expect(approach(next).count).toBe(1);
		expect(next.symbolAssociations[1]!.evidence.approach.count).toBe(0);
		expect(
			next.recentLearning.filter((entry) => entry.outcome === 'approach_evidence')
		).toHaveLength(1);
		expect(next.movementLearning.encounters[0]!.firstObservedAt).toBe(onset);
	});

	it('keeps sight loss and partial approach unresolved rather than negative', () => {
		const original = receiver();
		original.symbolAssociations[0]!.evidence.approach = { strength: 0.5, count: 2 };
		let lost = sense(hear(original), 1.1, []);
		expect(lost.movementLearning.encounters[0]!.trace?.status).toBe('unobserved');
		expect(approach(lost)).toEqual({ strength: 0.5, count: 2 });
		lost = sense(lost, 1.5, [peer(0.5, 1.5)]);
		expect(approach(lost).count).toBe(2);
		let partial = hear(original);
		for (let tick = 1; tick <= 8; tick++)
			partial = sense(partial, tick * 0.5, [peer(1.8, tick * 0.5)]);
		expect(partial.movementLearning.encounters[0]!.trace?.status).toBe('unobserved');
		expect(approach(partial).strength).toBe(0.5);
	});

	it('weakens only approach after a fully observed stationary or withdrawing peer', () => {
		for (const withdrawal of [false, true]) {
			const original = receiver();
			original.symbolAssociations[0]!.evidence.approach = { strength: 0.5, count: 2 };
			original.symbolAssociations[0]!.evidence.food = { strength: 0.7, count: 3 };
			let next = hear(original);
			for (let tick = 1; tick <= 8; tick++)
				next = sense(next, tick * 0.5, [peer(withdrawal ? 2 + tick * 0.1 : 2, tick * 0.5)]);
			expect(approach(next)).toEqual({ strength: 0.4, count: 2 });
			expect(next.symbolAssociations[0]!.evidence.food).toEqual({ strength: 0.7, count: 3 });
			expect(next.recentLearning.at(-1)?.outcome).toBe('approach_contradicted');
		}
	});

	it('requires sustained personal comfortable contact, not a passing close position', () => {
		let next = hear(receiver());
		next = sense(next, 0.5, [peer(0.8, 0.5)]);
		next = sense(next, 1, [peer(1.5, 1)]);
		expect(approach(next).count).toBe(0);
		const distressed = { ...hear(receiver()), hunger: 1, thirst: 1 };
		expect(approach(closeEpisode(distressed)).count).toBe(0);
	});

	it('preserves simultaneous physical evidence and ignores its already-applied marker', () => {
		const original = receiver();
		original.symbolAssociations[0]!.evidence.danger = { strength: 0.5, count: 2 };
		original.memory.entries = [
			{
				kind: 'heard_signal',
				sequence: 0,
				rememberedAt: 0,
				emissionId: 'sound-0',
				symbolId: 'glyph-0',
				origin: { x: 2, y: 0 },
				evidenceApplied: true
			}
		];
		const next = closeEpisode(hear(original));
		expect(approach(next).count).toBe(1);
		expect(next.symbolAssociations[0]!.evidence.danger).toEqual({ strength: 0.5, count: 2 });
		expect(next.recentLearning.at(-1)?.before.danger).toBe(0.5);
		expect(next.recentLearning.at(-1)?.after.danger).toBe(0.5);
	});
});

describe('bounded response opportunities and state', () => {
	it('keeps quiet hearing inert while actual sensing still expires responses and traces', () => {
		const pending = hear(receiver());
		const quiet = {
			...pending,
			get perceivedPeers(): PeerObservation[] {
				throw Error('quiet hearing must not inspect peers');
			}
		};
		expect(hearMovementLearning(quiet, [], 5, config)).toBe(quiet);
		expect(quiet.movementLearning.response).not.toBeNull();
		expect(quiet.movementLearning.encounters[0].trace?.status).toBe('pending');
		const observed = sense(pending, 5, []);
		expect(observed.movementLearning.response).toBeNull();
		expect(observed.movementLearning.encounters[0].trace?.status).toBe('unobserved');
	});

	it('returns the same creature for stale-only or future-only hearing without touching source geometry', () => {
		const original = receiver();
		for (const heardAt of [-1, 1]) {
			const event = {
				emissionId: 'irrelevant',
				symbolId: 'glyph-0' as const,
				heardAt,
				get origin(): { x: number; y: number } {
					throw Error('non-current source read');
				}
			};
			expect(hearMovementLearning(original, [event], 0, config)).toBe(original);
		}
	});

	it('preserves current-signal ordering and binding when mixed with stale hearing', () => {
		const original = receiver();
		const event = (emissionId: string, heardAt = 0) => ({
			emissionId,
			heardAt,
			symbolId: 'glyph-0' as const,
			origin: { x: 2, y: 0 }
		});
		const current = [event('b'), event('a')];
		const mixed = [current[0], event('stale', -1), current[1], event('future', 1)];
		const snapshot = JSON.stringify(mixed);
		const next = hearMovementLearning(original, mixed, 0, config);
		expect(next).toEqual(hearMovementLearning(original, current, 0, config));
		expect(next.movementLearning.encounters[0].trace?.emissionId).toBe('a');
		expect(next.movementLearning.lastBinding?.emissionId).toBe('b');
		expect(JSON.stringify(mixed)).toBe(snapshot);
	});

	it('does not extend a response by rehearing, and consumes arrival, loss and expiry', () => {
		const initial = hear(receiver());
		const repeated = hear({ ...initial, perceivedPeers: [peer(2, 0.5)] }, 0.5, 'repeat');
		expect(repeated.movementLearning.response?.expiresAt).toBe(4);
		for (const next of [
			sense(initial, 0.5, [peer(0.9, 0.5)]),
			sense(initial, 0.5, []),
			sense(initial, 4, [peer(2, 4)])
		]) {
			expect(next.movementLearning.response).toBeNull();
			expect(next.movementLearning.encounters[0]!.nextResponseAt).toBeGreaterThanOrEqual(12.5);
		}
		const consumed = {
			...initial,
			movementLearning: consumeMovementResponse(initial.movementLearning, 0.5)
		};
		expect(
			hear({ ...consumed, perceivedPeers: [peer(2, 20)] }, 20, 'late-repeat').movementLearning
				.response
		).toBeNull();
	});

	it('keeps at most16 local encounters and4 pending traces regardless of population order', () => {
		const peers = Array.from({ length: 20 }, (_, index) =>
			peer(2 + index * 0.6, 0, `peer-${String(index).padStart(2, '0')}`)
		);
		const events = peers.map((p, index) => ({
			emissionId: `sound-${index}`,
			symbolId: 'glyph-0' as const,
			origin: p.position,
			heardAt: 0
		}));
		const run = (view: PeerObservation[], heard = events) =>
			hearMovementLearning(
				sense({ ...receiver(), perceivedPeers: view }, 0, view),
				heard,
				0,
				config
			);
		const forward = run(peers);
		const reversed = run([...peers].reverse(), [...events].reverse());
		expect(forward.movementLearning).toEqual(reversed.movementLearning);
		expect(forward.movementLearning.encounters).toHaveLength(MOVEMENT_DEFAULTS.encounterCapacity);
		expect(
			forward.movementLearning.encounters.filter((row) => row.trace?.status === 'pending')
		).toHaveLength(MOVEMENT_DEFAULTS.pendingCapacity);
	});

	it('does not retrospectively confirm a peer first seen after the four-second window', () => {
		const next = sense(hear(receiver()), 5, [peer(0.5, 5)]);
		expect(approach(next).count).toBe(0);
		expect(next.movementLearning.encounters[0]!.trace?.status).toBe('unobserved');
	});

	it('requires two approach confirmations even with a lower general threshold, and physical no-evidence does not erase approach', () => {
		const original = receiver();
		original.symbolAssociations[0]!.evidence.approach = { strength: 1, count: 1 };
		expect(
			resolveCreatureLexicon(original.symbolAssociations, config.symbolInventory, {
				...config,
				lexiconAssignmentMinEvidenceCount: 0
			}).lexicon.approach
		).toBeNull();
		const reduced = applyNoEvidenceReduction(original.symbolAssociations, 'glyph-0', 0.5, config);
		expect(reduced.after.approach).toBe(1);
	});
});

it('preserves response cooldown across encounter absence and reacquisition', () => {
	let next = hear(receiver());
	next = { ...next, movementLearning: consumeMovementResponse(next.movementLearning, 4) };
	next = sense(next, 12, []);
	next = sense(next, 12.5, [peer(2, 12.5)]);
	next = hear(next, 12.5, 'reacquired');
	expect(next.movementLearning.response).toBeNull();
	expect(next.movementLearning.encounters[0]!.nextResponseAt).toBe(16);
});
