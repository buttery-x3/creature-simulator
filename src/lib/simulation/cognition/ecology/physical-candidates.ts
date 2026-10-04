import { distanceSquared } from '../../creature-movement';
import { bodyAbility, daylightAt } from '../../ecology/body';
import type { ArbitrationInput, IntentionCandidate } from '../types';
import { perceivedDanger, retreatFrom } from './danger-policy';

/** Reversible balance policy; all terms are exposed in arbitration factors. */
export const PHYSICAL_UTILITY = {
	nightRestBonus: 0.42,
	dangerWeight: 1.7,
	huntReward: 1.5,
	huntRiskCost: 0.3
};

export function nightRestWeight(input: ArbitrationInput): number {
	return input.physical
		? Math.max(0, 1 - 2 * daylightAt(input.timeSeconds, input.physical.ecology)) *
				PHYSICAL_UTILITY.nightRestBonus
		: 0;
}

function empty(intention: 'flee' | 'hunt'): IntentionCandidate {
	return {
		intention,
		valid: false,
		score: 0,
		baseScore: 0,
		continuityAdjustment: 0,
		target: null,
		reference: null,
		factors: [],
		reasonCodes: ['no_local_wildlife'],
		rejectionReason: 'no_local_wildlife'
	};
}

/** No world lookup: only current local observations may motivate physical pursuit. */
export function buildPhysicalCandidates(input: ArbitrationInput): IntentionCandidate[] {
	let flee = empty('flee');
	let hunt = empty('hunt');
	const physical = input.physical;
	if (!physical) return [flee, hunt];
	const ability = bodyAbility(physical.body, input.energy);
	for (const evidence of perceivedDanger(input)) {
		const distance = Math.sqrt(distanceSquared(input.position, evidence.position));
		const proximity = 1 / (1 + distance / 2);
		const danger = Math.min(
			1.5,
			Math.max(0, evidence.opponentAbility / Math.max(0.05, ability) - 0.65)
		);
		const fleeScore = PHYSICAL_UTILITY.dangerWeight * danger * proximity * evidence.confidence;
		if (fleeScore > flee.baseScore) {
			flee = {
				...empty('flee'),
				valid: true,
				score: fleeScore,
				baseScore: fleeScore,
				target: {
					kind: 'point',
					position: retreatFrom(input.position, evidence.position, physical.bounds)
				},
				reference: { kind: 'wildlife', wildlifeId: evidence.wildlifeId },
				factors: [
					{ code: 'danger', value: danger },
					{ code: 'proximity', value: proximity },
					{ code: 'body_ability', value: ability },
					{ code: 'opponent_ability', value: evidence.opponentAbility },
					{ code: 'evidence_confidence', value: evidence.confidence }
				],
				reasonCodes: [evidence.remembered ? 'remembered_danger' : 'local_danger'],
				rejectionReason: undefined
			};
		}
	}
	// Remembered predators cannot become hunt targets; pursuit still requires current local sight.
	for (const animal of [...physical.wildlife].sort((a, b) => a.id.localeCompare(b.id))) {
		const distance = Math.sqrt(distanceSquared(input.position, animal.position));
		const opponent =
			animal.health > 0 ? bodyAbility({ ...animal, nextAttackAt: 0 }, animal.energy) : 0;
		const confidence = ability / Math.max(0.001, ability + opponent);
		const proximity = 1 / (1 + distance / 2);
		const reward =
			input.hunger * PHYSICAL_UTILITY.huntReward * confidence * (0.6 + 0.4 * proximity);
		const risk = (1 - confidence) * PHYSICAL_UTILITY.huntRiskCost;
		const huntScore = Math.max(0, reward - risk);
		if (
			input.hunger >= input.config.seekFoodThreshold &&
			(animal.health > 0 || animal.foodAmount > 0) &&
			huntScore > hunt.baseScore
		) {
			hunt = {
				...empty('hunt'),
				valid: true,
				score: huntScore,
				baseScore: huntScore,
				target: { kind: 'wildlife', wildlifeId: animal.id },
				reference: { kind: 'wildlife', wildlifeId: animal.id },
				factors: [
					{ code: 'hunger_pressure', value: input.hunger },
					{ code: 'physical_confidence', value: confidence },
					{ code: 'expected_food_payoff', value: reward },
					{ code: 'injury_risk', value: risk }
				],
				reasonCodes: ['hunting_payoff'],
				rejectionReason: undefined
			};
		}
	}
	return [flee, hunt];
}
