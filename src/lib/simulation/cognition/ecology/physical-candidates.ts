import { clampToInterior, distanceSquared } from '../../creature-movement';
import { bodyAbility, daylightAt } from '../../ecology/body';
import type { ArbitrationInput, IntentionCandidate } from '../types';

/** Reversible balance policy; all terms are exposed in arbitration factors. */
export const PHYSICAL_UTILITY = {
	nightRestBonus: 0.42,
	dangerWeight: 1.7,
	huntReward: 1.5,
	huntRiskCost: 0.3,
	retreatDistance: 3
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
	for (const animal of [...physical.wildlife].sort((a, b) => a.id.localeCompare(b.id))) {
		const distance = Math.sqrt(distanceSquared(input.position, animal.position));
		const opponent =
			animal.health > 0 ? bodyAbility({ ...animal, nextAttackAt: 0 }, animal.energy) : 0;
		const confidence = ability / Math.max(0.001, ability + opponent);
		const proximity = 1 / (1 + distance / 2);
		const danger =
			animal.health > 0 ? Math.min(1.5, Math.max(0, opponent / Math.max(0.05, ability) - 0.65)) : 0;
		const fleeScore = PHYSICAL_UTILITY.dangerWeight * danger * proximity;
		if (fleeScore > flee.baseScore) {
			let dx = input.position.x - animal.position.x;
			const dy = input.position.y - animal.position.y;
			if (dx === 0 && dy === 0) dx = 1;
			const norm = Math.hypot(dx, dy);
			let destination = clampToInterior(
				{
					x: input.position.x + (dx / norm) * PHYSICAL_UTILITY.retreatDistance,
					y: input.position.y + (dy / norm) * PHYSICAL_UTILITY.retreatDistance
				},
				physical.bounds,
				0.3
			);
			// At an edge, a tangential escape remains possible instead of pushing into the wall.
			if (distanceSquared(input.position, destination) < 0.1) {
				destination = clampToInterior(
					{
						x: input.position.x - (dy / norm) * PHYSICAL_UTILITY.retreatDistance,
						y: input.position.y + (dx / norm) * PHYSICAL_UTILITY.retreatDistance
					},
					physical.bounds,
					0.3
				);
			}
			flee = {
				...empty('flee'),
				valid: true,
				score: fleeScore,
				baseScore: fleeScore,
				target: { kind: 'point', position: destination },
				reference: { kind: 'wildlife', wildlifeId: animal.id },
				factors: [
					{ code: 'danger', value: danger },
					{ code: 'proximity', value: proximity },
					{ code: 'body_ability', value: ability },
					{ code: 'opponent_ability', value: opponent }
				],
				reasonCodes: ['local_danger'],
				rejectionReason: undefined
			};
		}
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
