import { describe, expect, it } from 'vitest';
import { testCreature } from '../../test-creature';
import type { Creature } from '../../types';
import type { PeerObservation } from '../types';
import { observeCompanionship, hasVisiblePredecessor } from './observations';
import {
	applyCompanionshipSelection,
	advanceCompanionship,
	hasCompanionDeparture
} from './session';

const config = { perceptionIntervalSeconds: 0.25, sensingRadius: 3 };
const peer = (x: number, time: number, id = 'companion'): PeerObservation => ({
	id,
	position: { x, y: 0 },
	observedAt: time,
	mature: true,
	expression: null
});
function sense(
	creature: Creature,
	time: number,
	x: number | null,
	self = creature.position.x,
	others: PeerObservation[] = []
): Creature {
	return observeCompanionship(
		{
			...creature,
			position: { x: self, y: 0 },
			perceivedPeers: x === null ? others : [peer(x, time), ...others]
		},
		time,
		config
	);
}
function departure(): Creature {
	let next = testCreature();
	for (const time of [0, 0.25, 0.5]) next = sense(next, time, 0.8);
	next = sense(next, 0.75, 1);
	return sense(next, 1, 1.2);
}
function active(): Creature {
	const next = departure();
	return applyCompanionshipSelection(
		{ ...next, intention: 'follow_peer', target: { kind: 'creature', creatureId: 'companion' } },
		next.intention,
		1
	);
}

describe('direct physical companionship', () => {
	it('records stationary contact then independent peer departure, without learning any symbol', () => {
		const next = departure();
		expect(next.social.companionship.contact).toMatchObject({
			qualifiedAt: 0.5,
			qualifiedContactSeconds: 0.5,
			heading: { x: 1, y: 0 }
		});
		expect(next.social.companionship.contact!.departureDistance).toBeCloseTo(0.4);
		expect(hasCompanionDeparture(next.social.companionship, 1)).toBe(true);
		expect(
			next.symbolAssociations.every((row) =>
				Object.values(row.evidence).every((value) => value.count === 0)
			)
		).toBe(true);
		expect(next.recentLearning).toEqual([]);
	});
	it('cannot manufacture departure from listener movement or first observing a moving group', () => {
		let self = testCreature();
		for (const t of [0, 0.25, 0.5]) self = sense(self, t, 0.8);
		self = sense(self, 0.75, 0.8, -0.4);
		expect(hasCompanionDeparture(self.social.companionship, 0.75)).toBe(false);
		let group = testCreature();
		group = sense(group, 0, 0.8, 0, [peer(0.8, 0, 'another')]);
		group = sense(group, 0.25, 1.2, 0, [peer(1.2, 0.25, 'another')]);
		expect(hasCompanionDeparture(group.social.companionship, 0.25)).toBe(false);
	});
	it('requires consecutive observations and both comfortable endpoints', () => {
		let next = sense({ ...testCreature(), hunger: 1 }, 0, 0.8);
		next = sense({ ...next, hunger: 0.2 }, 0.25, 0.8);
		expect(next.social.companionship.contact!.stationarySeconds).toBe(0);
		next = sense(next, 0.5, 0.8);
		expect(next.social.companionship.contact!.qualifiedAt).toBeNull();
		next = sense(next, 0.75, 0.8);
		expect(next.social.companionship.contact!.qualifiedAt).toBe(0.75);
		next = sense(next, 2, 0.8);
		expect(next.social.companionship.contact!.qualifiedAt).toBeNull();
	});
	it('bounds contact and outcome retention and gives deterministic crowded contact selection', () => {
		const view = [peer(0.8, 0, 'b'), peer(0.8, 0, 'a')];
		const run = (peers: PeerObservation[]) =>
			observeCompanionship({ ...testCreature(), perceivedPeers: peers }, 0, config);
		expect(run(view).social.companionship).toEqual(run([...view].reverse()).social.companionship);
		expect(run(view).social.companionship.contact!.peerId).toBe('a');
	});
	it('starts only when follow is actually selected and preserves a fixed deadline', () => {
		const opportunity = departure();
		expect(opportunity.social.companionship.active).toBeNull();
		const next = active();
		expect(next.social.companionship.active?.expiresAt).toBe(9);
		expect(
			applyCompanionshipSelection(next, 'follow_peer', 2).social.companionship.active?.expiresAt
		).toBe(9);
	});
	it('records hard time/path limits and prevents immediate restart', () => {
		for (const next of [
			advanceCompanionship(active(), 9),
			advanceCompanionship({ ...active(), position: { x: 6, y: 0 } }, 1.5)
		]) {
			expect(next.social.companionship.active).toBeNull();
			expect(next.social.companionship.contact).toBeNull();
			expect(next.social.companionship.nextEligibleAt).toBeGreaterThan(12);
			expect(hasCompanionDeparture(next.social.companionship, 10)).toBe(false);
		}
	});
	it.each(['lost_contact', 'turn_back', 'visible_chain', 'no_progress'] as const)(
		'ends on observed %s',
		(reason) => {
			let next = active();
			if (reason === 'lost_contact') next = sense(next, 1.25, null);
			if (reason === 'turn_back') next = sense(next, 1.25, 1);
			if (reason === 'visible_chain') next = sense(next, 1.25, 1.4, 0, [peer(2, 1.25, 'ahead')]);
			if (reason === 'no_progress')
				for (let tick = 5; tick <= 10; tick++) next = sense(next, tick / 4, 1.2);
			expect(next.social.companionship.active).toBeNull();
			expect(next.social.companionship.lastOutcome?.reason).toBe(reason);
		}
	);
	it('classifies actual visible-resource selection without assigning helpfulness', () => {
		const next = applyCompanionshipSelection(
			{
				...active(),
				intention: 'satisfy_thirst',
				target: { kind: 'feature', featureId: 'water', featureKind: 'water' }
			},
			'follow_peer',
			2
		);
		expect(next.social.companionship.lastOutcome?.reason).toBe('resource_found');
		expect(next.social.relationships).toEqual(active().social.relationships);
		const interrupted = applyCompanionshipSelection(
			{ ...active(), intention: 'satisfy_thirst', target: null },
			'follow_peer',
			2
		);
		expect(interrupted.social.companionship.lastOutcome?.reason).toBe('interrupted');
	});
	it('uses only visible corridor geometry to reject obvious chains', () => {
		expect(
			hasVisiblePredecessor('companion', { x: 1, y: 0 }, { x: 1, y: 0 }, [peer(2, 1, 'ahead')])
		).toBe(true);
		expect(
			hasVisiblePredecessor('companion', { x: 1, y: 0 }, { x: 1, y: 0 }, [peer(0, 1, 'behind')])
		).toBe(false);
		expect(hasVisiblePredecessor('companion', { x: 1, y: 0 }, { x: 1, y: 0 }, [])).toBe(false);
	});
});
