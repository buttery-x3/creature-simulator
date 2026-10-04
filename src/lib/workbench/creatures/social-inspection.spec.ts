import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import CreatureSocial from './CreatureSocial.svelte';
import CreatureBehaviour from './CreatureBehaviour.svelte';

function observer() {
	return createSimulation(defaultSimulationConfig('social-inspection')).creatures[0];
}

describe('physical companionship inspection', () => {
	it('shows only recorded contact, departure and bounded active episode evidence', () => {
		const creature = observer();
		creature.social.companionship = {
			contact: {
				peerId: 'peer-direct',
				lastObservedAt: 11.5,
				lastPeerPosition: { x: 2, y: 0 },
				lastSelfPosition: { x: 0, y: 0 },
				stationarySeconds: 0,
				qualifiedContactSeconds: 1.25,
				lastComfortable: true,
				qualifiedAt: 10.5,
				departureDistance: 0.625,
				heading: { x: 1, y: 0 }
			},
			active: {
				peerId: 'peer-direct',
				startedAt: 11,
				expiresAt: 19,
				travelDistance: 1.125,
				lastSelfPosition: { x: 1, y: 0 },
				lastProgressAt: 11.75,
				progressAnchor: { x: 0.75, y: 0 }
			},
			nextEligibleAt: 0,
			lastOutcome: null
		};
		const before = JSON.stringify(creature);
		const { body } = render(CreatureSocial, { props: { creature, timeSeconds: 12 } });
		expect(body).toContain('following');
		expect(body).toContain('peer-direct');
		expect(body).toContain('1.25s');
		expect(body).toContain('10.50s');
		expect(body).toContain('0.625');
		expect(body).toContain('(1.000, 0.000)');
		expect(body).toContain('19.00s');
		expect(body).toContain('7.00s remaining');
		expect(body).toContain('1.125');
		expect(body).toContain('0.25s ago');
		expect(body).toMatch(/no\s+glyph is interpreted as a follow command/);
		expect(body).not.toContain('data-testid="companion-last-outcome"');
		expect(JSON.stringify(creature)).toBe(before);
	});

	it('separates retained end reason and cooldown from an active episode', () => {
		const creature = observer();
		creature.social.companionship = {
			contact: null,
			active: null,
			nextEligibleAt: 16,
			lastOutcome: {
				peerId: 'peer-ended',
				timeSeconds: 11,
				reason: 'lost_contact',
				travelDistance: 2.375,
				durationSeconds: 3.5
			}
		};
		const { body } = render(CreatureSocial, { props: { creature, timeSeconds: 12 } });
		expect(body).toContain('cooldown');
		expect(body).toContain('4.00s cooldown remaining');
		expect(body).toContain('lost_contact at 11.00s');
		expect(body).toContain('3.50s / 2.375');
		expect(body).not.toContain('data-testid="companion-active"');
		expect(body).toContain('No retained direct contact.');
	});

	it('shows an empty initial state without inventing a companion', () => {
		const { body } = render(CreatureSocial, { props: { creature: observer(), timeSeconds: 0 } });
		expect(body).toContain('inactive');
		expect(body).toContain('No retained direct contact.');
		expect(body).toContain('No completed follow episode retained.');
		expect(body).not.toContain('data-testid="companion-active"');
	});
});

it('displays captured follow arbitration factors and reasons without rescoring them', () => {
	const creature = observer();
	const factors = [
		{ code: 'companion_affinity', value: 0.125 },
		{ code: 'observed_departure', value: 0.625 },
		{ code: 'companion_contact_seconds', value: 1.25 },
		{ code: 'unresolved_need_information', value: 0.375 },
		{ code: 'welfare_comfort', value: 0.875 },
		{ code: 'follow_time_remaining', value: 7 },
		{ code: 'follow_travel_distance', value: 1.125 }
	];
	creature.lastArbitration = {
		timeSeconds: 12,
		trigger: 'periodic',
		previousIntention: 'explore',
		selectedIntention: 'follow_peer',
		selectedTarget: { kind: 'creature', creatureId: 'peer-direct' },
		selectionReasonCodes: ['companion_departure'],
		candidates: [
			{
				intention: 'follow_peer',
				valid: true,
				score: 0.412,
				baseScore: 0.387,
				continuityAdjustment: 0.025,
				target: { kind: 'creature', creatureId: 'peer-direct' },
				reference: { kind: 'creature', creatureId: 'peer-direct' },
				factors,
				reasonCodes: ['companion_departure']
			}
		]
	};
	const before = JSON.stringify(creature);
	const { body } = render(CreatureBehaviour, { props: { creature, investigation: null } });
	expect(body).toContain('inspector-candidate-follow_peer');
	expect(body).toContain('creature:peer-direct');
	expect(body).toContain('companion_departure');
	expect(body).toContain('Total score: 0.412');
	expect(body).toContain('Base score: 0.387');
	for (const factor of factors)
		expect(body).toContain(factor.code + ': ' + factor.value.toFixed(3));
	expect(JSON.stringify(creature)).toBe(before);
});
