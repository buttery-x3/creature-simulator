import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import CreatureLanguage from './CreatureLanguage.svelte';

describe('movement sequence inspection', () => {
	it('shows recorded local sequence outcomes without inventing an assignment or resolving ambiguous identity', () => {
		const config = defaultSimulationConfig('movement-inspection');
		const creature = createSimulation(config).creatures[0];
		creature.movementLearning = {
			response: null,
			lastBinding: {
				emissionId: 'e-ambiguous',
				symbolId: 'glyph-0',
				heardAt: 1,
				status: 'ambiguous',
				peerId: null
			},
			encounters: []
		};
		for (const [index, status] of (
			['pending', 'confirmed', 'contradicted', 'unobserved'] as const
		).entries()) {
			creature.movementLearning.encounters.push({
				peerId: 'peer-' + index,
				firstObservedAt: 0,
				lastObservedAt: 2,
				lastPeerPosition: { x: 1, y: 0 },
				lastListenerPosition: { x: 0, y: 0 },
				responseOffered: false,
				nextResponseAt: 0,
				trace: {
					emissionId: 'e-' + index,
					symbolId: 'glyph-0',
					heardAt: 1,
					expiresAt: 5,
					status,
					peerTowardDistance: 0.375,
					closestDistance: 0.625,
					comfortableContactSeconds: 0.5,
					lastComfortableContact: true,
					lastObservedAt: 2,
					reason: 'measured local trace'
				}
			});
		}
		const before = JSON.stringify(creature);
		const { body } = render(CreatureLanguage, {
			props: { selectedCreature: creature, config, investigation: null, onNavigate: () => {} }
		});
		for (const [index, status] of [
			'pending',
			'confirmed',
			'contradicted',
			'unobserved'
		].entries()) {
			expect(body).toContain('movement-sequence-peer-' + index);
			expect(body).toContain(status);
		}
		expect(body).toContain('ambiguous');
		expect(body).toContain('0.375');
		expect(body).toContain('0.625');
		expect(body).toContain('0.50s');
		expect(body).toMatch(/inspector-lexicon-approach[^>]*>[^<]*(?:<!--[\s\S]*?-->)?\s*unassigned/);
		expect(body).toMatch(/learned\s+prediction, not a command/);
		expect(JSON.stringify(creature)).toBe(before);
	});
});
