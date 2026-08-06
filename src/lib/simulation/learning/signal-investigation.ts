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

/** Distance reference for normalising investigation distance penalty (simulation units). */
export const INVESTIGATION_DISTANCE_REFERENCE = 10;

export type PendingConfig = Pick<
	SimulationConfig,
	'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'
>;

export type InvestigationScoreConfig = Pick<
	SimulationConfig,
	| 'pendingSignalLifetimeSeconds'
	| 'investigationCuriosityBaseline'
	| 'investigationDistanceWeight'
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

export type InvestigationScore = {
	score: number;
	reason: string;
	pending: PendingSignal;
	resourceBias: number;
	ageNorm: number;
	distNorm: number;
};

/**
 * Score one pending (or active-as-pending) investigation opportunity.
 * Unknown symbols retain a non-zero curiosity baseline.
 */
export function scoreInvestigationCandidate(
	creature: {
		position: Vec2;
		hunger: number;
		thirst: number;
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

	const age = Math.max(0, timeSeconds - pending.heardAt);
	const lifetime = config.pendingSignalLifetimeSeconds;
	const ageNorm = lifetime > 0 ? Math.min(1, age / lifetime) : 0;

	const dist = Math.sqrt(distanceSquared(creature.position, pending.origin));
	const distNorm = Math.min(1, dist / INVESTIGATION_DISTANCE_REFERENCE);

	let score =
		config.investigationCuriosityBaseline +
		resourceBias -
		config.investigationAgeWeight * ageNorm -
		config.investigationDistanceWeight * distNorm;
	if (!Number.isFinite(score) || score < 0) {
		score = 0;
	}

	const reason =
		`curiosity ${config.investigationCuriosityBaseline.toFixed(3)}` +
		` + resourceBias ${resourceBias.toFixed(3)}` +
		` (food ${foodStrength.toFixed(3)}×hunger ${creature.hunger.toFixed(3)}` +
		` + water ${waterStrength.toFixed(3)}×thirst ${creature.thirst.toFixed(3)})` +
		` − age ${ageNorm.toFixed(3)}×${config.investigationAgeWeight}` +
		` − dist ${distNorm.toFixed(3)}×${config.investigationDistanceWeight}` +
		` → ${score.toFixed(3)}; symbol=${pending.symbolId} emission=${pending.emissionId}`;

	return { score, reason, pending, resourceBias, ageNorm, distNorm };
}

/**
 * Choose the highest-scoring non-expired pending signal (emissionId ASC on ties).
 */
export function selectBestPendingSignal(
	creature: {
		position: Vec2;
		hunger: number;
		thirst: number;
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
	// Stable order: score desc, then emissionId asc.
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

export function activeToPendingShape(active: ActiveSignalInvestigation): PendingSignal {
	return {
		emissionId: active.emissionId,
		symbolId: active.symbolId,
		senderId: active.senderId,
		origin: { x: active.origin.x, y: active.origin.y },
		heardAt: active.startedAt,
		expiresAt: active.expiresAt
	};
}

export function beginInvestigation(
	pending: PendingSignal,
	timeSeconds: number,
	durationSeconds: number
): ActiveSignalInvestigation {
	return {
		emissionId: pending.emissionId,
		symbolId: pending.symbolId,
		senderId: pending.senderId,
		origin: { x: pending.origin.x, y: pending.origin.y },
		startedAt: timeSeconds,
		expiresAt: timeSeconds + durationSeconds,
		arrived: false,
		foodEvidenceApplied: false,
		waterEvidenceApplied: false
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
