import { describe, it, expect } from 'vitest';
import { defaultSimulationConfig, createSimulation } from '../../create-simulation';
import { testCreature } from '../../test-creature';
import { buildArbitrationInput } from '../../behaviour/build-arbitration-input';
import { arbitrate } from '../arbitrate';
import { applyArbitration } from '../../behaviour/actions';
import {
	requestMovementCall,
	releaseInterruptedMovementResponse
} from '../../behaviour/execution/movement-expression';

function fixture() {
	const config = defaultSimulationConfig('movement-plans');
	const world = createSimulation(config);
	const creature = testCreature({
		hunger: 0.05,
		thirst: 0.05,
		energy: 1,
		verbosity: 1,
		curiosity: 0
	});
	creature.lifecycle.nextReproductionAt = 1000;
	creature.social.nextExpressionAt = 1000;
	creature.social.relationships = [
		{ peerId: 'peer', familiarity: 1, liking: 1, lastSeenAt: 2, lastExpressionId: null }
	];
	creature.perceivedPeers = [
		{ id: 'peer', position: { x: 2, y: 0 }, observedAt: 2, mature: true, expression: null }
	];
	const input = buildArbitrationInput(creature, world.habitat, 2, 'periodic', config);
	const record = arbitrate(input);
	const selected = { ...creature, ...applyArbitration(creature, record, false, config) };
	return { config, creature, input, record, selected };
}

describe('cognition-owned movement calls', () => {
	it('selects a calling plan with visible utility and executes once per selected episode', () => {
		const { selected, record } = fixture();
		expect(record.selectedIntention).toBe('approach_peer');
		expect(record.candidates.find((c) => c.intention === 'approach_peer')?.reasonCodes).toContain(
			'approach_call_plan'
		);
		const first = requestMovementCall(selected, 2);
		expect(first.emissionRequest).toMatchObject({
			context: 'approach_started',
			contextDetail: 'approach',
			origin: selected.position
		});
		expect(requestMovementCall(first.creature, 2.1).emissionRequest).toBeNull();
		expect(requestMovementCall(first.creature, 30).emissionRequest).toBeNull();
		expect(
			requestMovementCall({ ...first.creature, intentionStartedAt: 30 }, 30).emissionRequest
		).not.toBeNull();
	});
	it('does not call without a selected movement plan or while another action is executing', () => {
		const { creature, selected } = fixture();
		expect(requestMovementCall(creature, 2).emissionRequest).toBeNull();
		expect(requestMovementCall({ ...selected, action: 'sleep' }, 2).emissionRequest).toBeNull();
	});
	it('keeps quiet plans valid and suppresses calls back to a source with a pending response opportunity', () => {
		const { input } = fixture();
		for (const state of [
			{ ...input, verbosity: 0 },
			{
				...input,
				social: {
					...input.social!,
					response: {
						peerId: 'peer',
						symbolId: 'glyph-3' as const,
						emissionId: 'heard',
						heardAt: 2,
						expiresAt: 6
					}
				}
			}
		]) {
			const record = arbitrate(state);
			const candidate = record.candidates.find((c) => c.intention === 'approach_peer')!;
			expect(candidate.valid).toBe(true);
			expect(candidate.factors.find((f) => f.code === 'movement_call_selected')?.value).toBe(0);
		}
	});
	it('spends an active learned response when another intention wins, without cancelling independent approach', () => {
		const { input, creature, config } = fixture();
		creature.lexicon.approach = 'glyph-3';
		creature.symbolAssociations.find((a) => a.symbolId === 'glyph-3')!.evidence.approach = {
			strength: 0.5,
			count: 2
		};
		const response = {
			peerId: 'peer',
			symbolId: 'glyph-3' as const,
			emissionId: 'heard',
			heardAt: 2,
			expiresAt: 6
		};
		const record = arbitrate({
			...input,
			lexicon: creature.lexicon,
			symbolAssociations: creature.symbolAssociations,
			social: { ...input.social!, response }
		});
		const previous = {
			...creature,
			...applyArbitration(creature, record, false, config),
			movementLearning: { ...creature.movementLearning, response }
		};
		expect(
			releaseInterruptedMovementResponse(previous, previous, 2.1).movementLearning.response
		).toEqual(response);
		const released = releaseInterruptedMovementResponse(
			previous,
			{ ...previous, intention: 'satisfy_thirst', action: 'search', target: null },
			2.1
		);
		expect(released.movementLearning.response).toBeNull();
		expect(released.intention).toBe('satisfy_thirst');
	});
});
