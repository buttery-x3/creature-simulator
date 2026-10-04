import { describe, expect, it } from 'vitest';
import { testCreature } from '../test-creature';
import {
	advanceSocial,
	deriveMood,
	emptySocialState,
	executeExpression,
	observePeers,
	recordInjury,
	SOCIAL_DEFAULTS,
	updateRelationships,
	type PeerObservation
} from './index';

const peer = (
	id: string,
	time: number,
	expression: PeerObservation['expression'] = null
): PeerObservation => ({ id, position: { x: 1, y: 0 }, observedAt: time, expression });

describe('local peer observation', () => {
	it('contains visible identity and display, never internal needs, intent, relationships or language', () => {
		const observer = testCreature({ id: 'observer' });
		const visible = executeExpression(testCreature({ id: 'visible', action: 'dance' }), 1);
		const hidden = testCreature({ id: 'hidden', position: { x: 30, y: 0 } });
		const seen = observePeers(observer, [observer, visible, hidden], 1.2, 3);
		expect(seen).toHaveLength(1);
		expect(Object.keys(seen[0]!).sort()).toEqual(['expression', 'id', 'observedAt', 'position']);
		expect(Object.keys(seen[0]!.expression!).sort()).toEqual(['id', 'intensity', 'kind']);
		expect(seen[0]!.position).not.toBe(visible.position);
		expect(observePeers(observer, [visible], 2, 3)[0]!.expression).toBeNull();
	});

	it('caps nearest peers and resolves distance ties by identity independently of population order', () => {
		const observer = testCreature({ id: 'observer' });
		const population = Array.from({ length: 24 }, (_, i) =>
			testCreature({ id: `peer-${String(i).padStart(2, '0')}`, position: { x: i / 10, y: 0 } })
		);
		const expected = observePeers(observer, population, 1, 5);
		expect(expected).toHaveLength(SOCIAL_DEFAULTS.peerCapacity);
		expect(observePeers(observer, [...population].reverse(), 1, 5)).toEqual(expected);
		const tied = population.map((row) => ({ ...row, position: { x: 1, y: 0 } }));
		expect(observePeers(observer, tied.reverse(), 1, 5).map((row) => row.id)).toEqual(
			expected.map((row) => row.id)
		);
	});
});

describe('personal relationships', () => {
	it('starts independently empty and learns familiarity only from measured consecutive contact', () => {
		const first = emptySocialState();
		expect(first.relationships).not.toBe(emptySocialState().relationships);
		const met = updateRelationships(first, [peer('a', 1)], 1, 100, true);
		expect(met.relationships[0]!.familiarity).toBe(0);
		const nearby = updateRelationships(met, [peer('a', 1.5)], 1.5, 100, true);
		expect(nearby.relationships[0]!.familiarity).toBeCloseTo(
			0.5 * SOCIAL_DEFAULTS.familiarityPerSecond
		);
		expect(nearby.relationships[0]!.liking).toBeGreaterThan(0);
		const reunion = updateRelationships(nearby, [peer('a', 50)], 50, 100, true);
		expect(reunion.relationships[0]!.familiarity).toBe(nearby.relationships[0]!.familiarity);
		expect(first.relationships).toEqual([]);
	});

	it('ignores stale observations and duplicate sensing updates', () => {
		const first = updateRelationships(emptySocialState(), [peer('a', 1)], 1, 0.25, true);
		expect(updateRelationships(first, [peer('a', 1)], 1, 0.25, true)).toEqual(first);
		expect(
			updateRelationships(emptySocialState(), [peer('a', 1)], 2, 0.25, true).relationships
		).toEqual([]);
	});

	it('credits each dance once while co-presence remains independently measurable', () => {
		const display = { id: 'dance-1', kind: 'dance' as const, intensity: 1 };
		const first = updateRelationships(emptySocialState(), [peer('a', 1, display)], 1, 0.25, true);
		const repeated = updateRelationships(first, [peer('a', 1.25, display)], 1.25, 0.25, true);
		expect(first.relationships[0]!.liking).toBe(SOCIAL_DEFAULTS.danceLikingGain);
		expect(repeated.relationships[0]!.liking - first.relationships[0]!.liking).toBeCloseTo(
			0.25 * SOCIAL_DEFAULTS.comfortableLikingPerSecond
		);
		const distinct = updateRelationships(
			repeated,
			[peer('a', 1.5, { ...display, id: 'dance-2' })],
			1.5,
			0.25,
			true
		);
		expect(distinct.relationships[0]!.liking - repeated.relationships[0]!.liking).toBeCloseTo(
			SOCIAL_DEFAULTS.danceLikingGain + 0.25 * SOCIAL_DEFAULTS.comfortableLikingPerSecond
		);
	});

	it('does not fabricate liking or blame from uncomfortable contact, crying, or received wildlife injury', () => {
		const display = { id: 'cry-1', kind: 'cry' as const, intensity: 1 };
		const first = updateRelationships(emptySocialState(), [peer('a', 1, display)], 1, 0.25, false);
		const repeated = updateRelationships(first, [peer('a', 1.25, display)], 1.25, 0.25, false);
		expect(repeated.relationships[0]!.familiarity).toBeGreaterThan(0);
		expect(repeated.relationships[0]!.liking).toBe(0);
		expect(recordInjury(repeated, 0.2).relationships).toEqual(repeated.relationships);
	});

	it('bounds relationships, evicts deterministically and forgets through local elapsed time', () => {
		const peers = Array.from({ length: 16 }, (_, i) =>
			peer(`peer-${String(i).padStart(2, '0')}`, 1)
		);
		const first = updateRelationships(emptySocialState(), peers, 1, 0.25, true);
		expect(first.relationships).toHaveLength(SOCIAL_DEFAULTS.relationshipCapacity);
		expect(updateRelationships(emptySocialState(), [...peers].reverse(), 1, 0.25, true)).toEqual(
			first
		);
		expect(
			advanceSocial(first, 1, 1 + SOCIAL_DEFAULTS.relationshipLifetimeSeconds).relationships
		).toEqual([]);
	});
});

describe('welfare and innate displays', () => {
	it('derives mood from condition and experienced pain without inventing a social need', () => {
		const comfortable = testCreature({ hunger: 0.05, thirst: 0.05, energy: 1 });
		const hurt = { ...comfortable, social: recordInjury(comfortable.social, 0.2) };
		expect(deriveMood(hurt).positive).toBeLessThan(deriveMood(comfortable).positive);
		expect(deriveMood(hurt).distress).toBeGreaterThan(deriveMood(comfortable).distress);
		const recovered = advanceSocial(hurt.social, 20, 20);
		expect(recovered.recentPain).toBe(0);
		expect(recordInjury(recovered, 100).recentPain).toBe(1);
	});

	it('starts only the selected expression, charges once, and does not modify language or relationships', () => {
		const creature = testCreature({ action: 'dance' });
		const started = executeExpression(creature, 1);
		expect(started.social.expression).toMatchObject({ kind: 'dance', startedAt: 1, expiresAt: 2 });
		expect(started.energy).toBeCloseTo(creature.energy - SOCIAL_DEFAULTS.expressionEnergyCost);
		expect(started.symbolAssociations).toBe(creature.symbolAssociations);
		expect(started.social.relationships).toBe(creature.social.relationships);
		expect(executeExpression(started, 1.5)).toBe(started);
		expect(executeExpression(testCreature(), 1).social.expression).toBeNull();
	});

	it('expires and cannot restart immediately; interruptions clear display but preserve cooldown', () => {
		const started = executeExpression(testCreature({ action: 'cry' }), 1);
		const expired = { ...started, social: advanceSocial(started.social, 1, 2) };
		expect(executeExpression(expired, 2).social.expression).toBeNull();
		const aborted = executeExpression({ ...started, action: 'move' }, 1.2);
		expect(aborted.social.expression).toBeNull();
		expect(aborted.social.nextExpressionAt).toBe(started.social.nextExpressionAt);
		expect(executeExpression({ ...aborted, action: 'cry' }, 2).social.expression).toBeNull();
		const restarted = executeExpression(
			{ ...aborted, action: 'cry' },
			started.social.nextExpressionAt
		);
		expect(restarted.social.expression?.id).not.toBe(started.social.expression?.id);
	});
});
