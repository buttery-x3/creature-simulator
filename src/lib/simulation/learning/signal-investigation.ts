/**
 * Pending-signal lifecycle, investigation scoring and evidence qualification.
 * Learning never reads emitter contextDetail or global symbol meanings.
 */

import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../creature-movement';
import type { CreaturePerception, SimulationConfig } from '../types';
import type { HeardSignal } from '../communication/types';
import { findAssociation } from './signal-associations';
import type {
	ActiveSignalInvestigation,
	LearningHistoryEntry,
	LearningOutcome,
	PendingSignal,
	SymbolAssociation
} from './types';

export type PendingConfig = Pick<
	SimulationConfig,
	'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'
>;

export type InvestigationScoreConfig = Pick<
	SimulationConfig,
	| 'pendingSignalLifetimeSeconds'
	| 'investigationCuriosityWeight'
	| 'investigationDistanceScale'
	| 'investigationAgeWeight'
>;

export type EvidenceConfig = Pick<SimulationConfig, 'learningEvidenceRadius'>;

export function heardToPending(heard: HeardSignal, lifetimeSeconds: number): PendingSignal {
	return {
		emissionId: heard.emissionId,
		symbolId: heard.symbolId,
		senderId: heard.senderId,
		origin: { x: heard.origin.x, y: heard.origin.y },
		heardAt: heard.heardAt,
		expiresAt: heard.heardAt + lifetimeSeconds
	};
}

/**
 * Insert pending candidates from heard signals, deduped by emissionId, bounded, newest last.
 * Existing pending for the same emissionId is not duplicated.
 */
export function insertPendingFromHeard(
	pending: readonly PendingSignal[],
	heardSignals: readonly HeardSignal[],
	config: PendingConfig
): PendingSignal[] {
	let next = [...pending];
	for (const heard of heardSignals) {
		if (next.some((p) => p.emissionId === heard.emissionId)) {
			continue;
		}
		next.push(heardToPending(heard, config.pendingSignalLifetimeSeconds));
	}
	if (next.length > config.maxPendingSignalsPerCreature) {
		next = next.slice(next.length - config.maxPendingSignalsPerCreature);
	}
	return next;
}

/** Drop pending with expiresAt <= timeSeconds. */
export function expirePendingSignals(
	pending: readonly PendingSignal[],
	timeSeconds: number
): PendingSignal[] {
	return pending.filter((p) => p.expiresAt > timeSeconds);
}

export function removePendingByEmissionId(
	pending: readonly PendingSignal[],
	emissionId: string
): PendingSignal[] {
	return pending.filter((p) => p.emissionId !== emissionId);
}

/**
 * Smooth distance falloff: nearby ≈ 1, distant decreases continuously, never hard-zero.
 * distanceFactor = 1 / (1 + distance / scale)
 */
export function distanceFalloffFactor(distance: number, scale: number): number {
	const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
	const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
	return 1 / (1 + safeDistance / safeScale);
}

export type InvestigationScore = {
	score: number;
	reason: string;
	pending: PendingSignal;
	curiosity: number;
	curiosityTerm: number;
	resourceBias: number;
	distance: number;
	distanceScale: number;
	distanceFactor: number;
	ageNorm: number;
	agePenalty: number;
};

/**
 * Score one pending (or active-as-pending) investigation opportunity.
 * Per-creature curiosity is the primary unknown-symbol interest term.
 */
export function scoreInvestigationCandidate(
	creature: {
		position: Vec2;
		hunger: number;
		thirst: number;
		curiosity: number;
		symbolAssociations: readonly SymbolAssociation[];
	},
	pending: PendingSignal,
	timeSeconds: number,
	config: InvestigationScoreConfig
): InvestigationScore {
	const assoc = findAssociation(creature.symbolAssociations, pending.symbolId);
	const foodStrength = assoc?.foodStrength ?? 0;
	const waterStrength = assoc?.waterStrength ?? 0;
	const resourceBias = foodStrength * creature.hunger + waterStrength * creature.thirst;
	const curiosityTerm = creature.curiosity * config.investigationCuriosityWeight;

	const age = Math.max(0, timeSeconds - pending.heardAt);
	const lifetime = config.pendingSignalLifetimeSeconds;
	const ageNorm = lifetime > 0 ? Math.min(1, age / lifetime) : 0;
	const agePenalty = config.investigationAgeWeight * ageNorm;

	const distance = Math.sqrt(distanceSquared(creature.position, pending.origin));
	const distanceScale = config.investigationDistanceScale;
	const distanceFactor = distanceFalloffFactor(distance, distanceScale);

	let score = (curiosityTerm + resourceBias) * distanceFactor - agePenalty;
	if (!Number.isFinite(score) || score < 0) {
		score = 0;
	}

	const reason =
		`curiosity ${creature.curiosity.toFixed(3)}×${config.investigationCuriosityWeight.toFixed(3)}` +
		`=${curiosityTerm.toFixed(3)}` +
		` + resourceBias ${resourceBias.toFixed(3)}` +
		` (food ${foodStrength.toFixed(3)}×hunger ${creature.hunger.toFixed(3)}` +
		` + water ${waterStrength.toFixed(3)}×thirst ${creature.thirst.toFixed(3)})` +
		` × distanceFactor ${distanceFactor.toFixed(3)}` +
		` (dist=${distance.toFixed(3)}, scale=${distanceScale.toFixed(3)})` +
		` − agePenalty ${agePenalty.toFixed(3)}` +
		` → ${score.toFixed(3)}; symbol=${pending.symbolId} emission=${pending.emissionId}`;

	return {
		score,
		reason,
		pending,
		curiosity: creature.curiosity,
		curiosityTerm,
		resourceBias,
		distance,
		distanceScale,
		distanceFactor,
		ageNorm,
		agePenalty
	};
}

/**
 * Choose the highest-scoring non-expired pending signal (emissionId ASC on ties).
 */
export function selectBestPendingSignal(
	creature: {
		position: Vec2;
		hunger: number;
		thirst: number;
		curiosity: number;
		symbolAssociations: readonly SymbolAssociation[];
	},
	pendingSignals: readonly PendingSignal[],
	timeSeconds: number,
	config: InvestigationScoreConfig
): InvestigationScore | null {
	const live = pendingSignals.filter((p) => p.expiresAt > timeSeconds);
	if (live.length === 0) {
		return null;
	}
	let best: InvestigationScore | null = null;
	const ordered = [...live].sort((a, b) =>
		a.emissionId < b.emissionId ? -1 : a.emissionId > b.emissionId ? 1 : 0
	);
	for (const pending of ordered) {
		const scored = scoreInvestigationCandidate(creature, pending, timeSeconds, config);
		if (
			!best ||
			scored.score > best.score ||
			(scored.score === best.score && scored.pending.emissionId < best.pending.emissionId)
		) {
			best = scored;
		}
	}
	return best;
}

export function activeToPendingShape(
	active: ActiveSignalInvestigation,
	heardAtFallback: number
): PendingSignal {
	return {
		emissionId: active.emissionId,
		symbolId: active.symbolId,
		senderId: active.senderId,
		origin: { x: active.origin.x, y: active.origin.y },
		// Use startedAt for age while travelling so age does not explode mid-trip.
		heardAt: heardAtFallback,
		// Active investigations do not expire; far-future placeholder for scoring filters.
		expiresAt: Number.POSITIVE_INFINITY
	};
}

export function beginInvestigation(
	pending: PendingSignal,
	timeSeconds: number
): ActiveSignalInvestigation {
	return {
		emissionId: pending.emissionId,
		symbolId: pending.symbolId,
		senderId: pending.senderId,
		origin: { x: pending.origin.x, y: pending.origin.y },
		startedAt: timeSeconds
	};
}

export type QualifyingEvidence = {
	food: boolean;
	water: boolean;
	/** Stable feature ids that qualified (for diagnostics). */
	foodFeatureIds: string[];
	waterFeatureIds: string[];
};

/**
 * Resources currently perceived whose centres lie within evidence radius of origin.
 * Uses the listener's perception only — never habitat-global labels beyond perception.
 */
export function qualifyEvidenceNearOrigin(
	perception: CreaturePerception,
	origin: Vec2,
	config: EvidenceConfig
): QualifyingEvidence {
	const radiusSq = config.learningEvidenceRadius * config.learningEvidenceRadius;
	const foodFeatureIds: string[] = [];
	const waterFeatureIds: string[] = [];

	const observations = [...perception.observations].sort((a, b) =>
		a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0
	);

	for (const obs of observations) {
		if (distanceSquared(obs.position, origin) > radiusSq) {
			continue;
		}
		if (obs.featureKind === 'food') {
			foodFeatureIds.push(obs.featureId);
		} else if (obs.featureKind === 'water') {
			waterFeatureIds.push(obs.featureId);
		}
	}

	return {
		food: foodFeatureIds.length > 0,
		water: waterFeatureIds.length > 0,
		foodFeatureIds,
		waterFeatureIds
	};
}

export function outcomeFromEvidenceFlags(
	food: boolean,
	water: boolean
): Extract<LearningOutcome, 'food_evidence' | 'water_evidence' | 'mixed_evidence' | 'no_evidence'> {
	if (food && water) {
		return 'mixed_evidence';
	}
	if (food) {
		return 'food_evidence';
	}
	if (water) {
		return 'water_evidence';
	}
	return 'no_evidence';
}

export function appendLearningHistory(
	history: readonly LearningHistoryEntry[],
	entry: LearningHistoryEntry,
	limit: number
): LearningHistoryEntry[] {
	const next = [...history, entry];
	if (next.length <= limit) {
		return next;
	}
	return next.slice(next.length - limit);
}

export function isNearOrigin(position: Vec2, origin: Vec2, arrivalDistance: number): boolean {
	return distanceSquared(position, origin) <= arrivalDistance * arrivalDistance;
}
