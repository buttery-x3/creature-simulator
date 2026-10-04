import type { Vec2, WorldBounds } from '$lib/habitat';
import { clampToInterior, distanceSquared } from '../../creature-movement';
import { bodyAbility } from '../../ecology/body';
import {
	DANGER_MEMORY_LIFETIME_SECONDS,
	listDangerObservations,
	listResourceObservations
} from '../../memory';
import type { ArbitrationInput, IntentionCandidate } from '../types';

export const DANGER_POLICY = {
	retreatDistance: 3,
	routePenaltyWeight: 0.8,
	maximumRoutePenalty: 0.85,
	urgentRiskTolerance: 0.65
};

export type DangerEvidence = {
	wildlifeId: string;
	position: Vec2;
	opponentAbility: number;
	confidence: number;
	remembered: boolean;
};

/** Direct local snapshots supersede the last remembered location, including disconfirming death. */
export function perceivedDanger(input: ArbitrationInput): DangerEvidence[] {
	if (!input.physical) return [];
	const seen = new Set(input.physical.wildlife.map((animal) => animal.id));
	const current = input.physical.wildlife
		.filter((animal) => animal.health > 0)
		.map((animal) => ({
			wildlifeId: animal.id,
			position: animal.position,
			opponentAbility: bodyAbility({ ...animal, nextAttackAt: 0 }, animal.energy),
			confidence: 1,
			remembered: false
		}));
	const retained = listDangerObservations(input.memory, input.timeSeconds)
		.filter((entry) => !seen.has(entry.wildlifeId))
		.map((entry) => ({
			wildlifeId: entry.wildlifeId,
			position: entry.position,
			opponentAbility: bodyAbility({ ...entry, nextAttackAt: 0 }, entry.energy),
			confidence: 1 - (input.timeSeconds - entry.rememberedAt) / DANGER_MEMORY_LIFETIME_SECONDS,
			remembered: true
		}));
	return [...current, ...retained].sort((a, b) => a.wildlifeId.localeCompare(b.wildlifeId));
}

/** Pure destination geometry shared by physical and learned-warning candidates. */
export function retreatFrom(position: Vec2, origin: Vec2, bounds: WorldBounds): Vec2 {
	let dx = position.x - origin.x;
	const dy = position.y - origin.y;
	if (dx === 0 && dy === 0) dx = 1;
	const norm = Math.hypot(dx, dy);
	const distance = DANGER_POLICY.retreatDistance;
	let destination = clampToInterior(
		{ x: position.x + (dx / norm) * distance, y: position.y + (dy / norm) * distance },
		bounds,
		0.3
	);
	if (distanceSquared(position, destination) < 0.1) {
		const alternatives = [-1, 1].map((sign) =>
			clampToInterior(
				{
					x: position.x - ((sign * dy) / norm) * distance,
					y: position.y + ((sign * dx) / norm) * distance
				},
				bounds,
				0.3
			)
		);
		destination = alternatives.sort(
			(a, b) => distanceSquared(position, b) - distanceSquared(position, a)
		)[0];
	}
	return destination;
}

function destinationFor(input: ArbitrationInput, candidate: IntentionCandidate): Vec2 | null {
	const target = candidate.target;
	if (target?.kind === 'point') return target.position;
	if (target?.kind !== 'feature') return null;
	if (target.featureKind === 'home') return input.physical?.homePosition ?? null;
	const visible = [...input.availableFood, ...input.availableWater].find(
		(resource) => resource.featureId === target.featureId
	);
	return (
		visible?.position ??
		listResourceObservations(input.memory).find((entry) => entry.featureId === target.featureId)
			?.position ??
		null
	);
}

function routeExposure(start: Vec2, end: Vec2, danger: DangerEvidence): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = dx * dx + dy * dy;
	const fraction =
		length > 0
			? Math.max(
					0,
					Math.min(
						1,
						((danger.position.x - start.x) * dx + (danger.position.y - start.y) * dy) / length
					)
				)
			: 0;
	const nearest = { x: start.x + fraction * dx, y: start.y + fraction * dy };
	const distance = Math.sqrt(distanceSquared(nearest, danger.position));
	// A route leading away from danger is useful; merely starting nearby is not penalised.
	if (fraction === 0 || distance >= Math.sqrt(distanceSquared(start, danger.position)) - 0.1)
		return 0;
	return danger.confidence / (1 + distance / 2);
}

/** Retained risk changes utility only; urgent needs and strong bodies retain competing choices. */
export function applyDangerRouteRisk(
	input: ArbitrationInput,
	candidates: IntentionCandidate[]
): IntentionCandidate[] {
	if (!input.physical) return candidates;
	const ability = bodyAbility(input.physical.body, input.energy);
	const evidence = perceivedDanger(input);
	return candidates.map((candidate) => {
		if (
			!candidate.valid ||
			['flee', 'hunt', 'avoid_danger', 'warn_danger'].includes(candidate.intention)
		)
			return candidate;
		const destination = destinationFor(input, candidate);
		if (!destination) return candidate;
		const risk = Math.max(
			0,
			...evidence.map(
				(danger) =>
					Math.min(1.5, Math.max(0, danger.opponentAbility / Math.max(0.05, ability) - 0.65)) *
					routeExposure(input.position, destination, danger)
			)
		);
		if (risk === 0) return candidate;
		const urgency =
			candidate.intention === 'rest'
				? 1 - input.energy
				: candidate.intention === 'satisfy_hunger'
					? input.hunger
					: candidate.intention === 'satisfy_thirst'
						? input.thirst
						: 0;
		const penalty = Math.min(
			DANGER_POLICY.maximumRoutePenalty,
			risk * DANGER_POLICY.routePenaltyWeight * (1 - DANGER_POLICY.urgentRiskTolerance * urgency)
		);
		const score = candidate.baseScore * (1 - penalty);
		return {
			...candidate,
			baseScore: score,
			score,
			factors: [
				...candidate.factors,
				{ code: 'danger_route_risk', value: risk },
				{ code: 'danger_route_multiplier', value: 1 - penalty }
			],
			reasonCodes: [...candidate.reasonCodes, 'danger_aware_route']
		};
	});
}
