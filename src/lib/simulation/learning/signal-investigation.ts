/**
 * Pending-signal opportunity lifecycle, curiosity acceptance and evidence qualification.
 * Learning never reads emitter contextDetail or global symbol meanings.
 *
 * Curiosity is decided once at ingest (sample < curiosity). Distance affects hearing
 * only — not post-hearing interest. Rejected opportunities remain for diagnostics but
 * never become investigation goals.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../creature-movement';
import type { CreaturePerception, SimulationConfig } from '../types';
import type { HeardSignal } from '../communication/types';
import type {
	ActiveSignalInvestigation,
	CuriosityDecision,
	CuriosityEvidence,
	LearningHistoryEntry,
	LearningOutcome,
	SignalInvestigationOpportunity
} from './types';

export type PendingConfig = Pick<
	SimulationConfig,
	'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'
>;

export type EvidenceConfig = Pick<SimulationConfig, 'learningEvidenceRadius'>;

/** Seed channel tag for one-shot curiosity samples (isolated from other streams). */
export const CURIOSITY_SAMPLE_CHANNEL = 'signal-investigation-curiosity';

/**
 * Deterministic curiosity acceptance for one listener/emission pair.
 * accepted = sample < curiosity; extremes: 0 rejects all, 1 accepts all.
 */
export function decideCuriosityAcceptance(
	simulationSeed: string,
	listenerId: string,
	emissionId: string,
	curiosity: number
): { decision: Extract<CuriosityDecision, 'accepted' | 'rejected'>; evidence: CuriosityEvidence } {
	const sample = createSeededRng(
		deriveSeed(simulationSeed, CURIOSITY_SAMPLE_CHANNEL, listenerId, emissionId)
	).next();
	const safeCuriosity = Number.isFinite(curiosity) ? curiosity : 0;
	const decision: Extract<CuriosityDecision, 'accepted' | 'rejected'> =
		sample < safeCuriosity ? 'accepted' : 'rejected';
	return {
		decision,
		evidence: {
			curiosity: safeCuriosity,
			deterministicSample: sample
		}
	};
}

export function heardToOpportunity(
	heard: HeardSignal,
	lifetimeSeconds: number,
	simulationSeed: string,
	listenerId: string,
	curiosity: number
): SignalInvestigationOpportunity {
	const { decision, evidence } = decideCuriosityAcceptance(
		simulationSeed,
		listenerId,
		heard.emissionId,
		curiosity
	);
	return {
		emissionId: heard.emissionId,
		symbolId: heard.symbolId,
		senderId: heard.senderId,
		origin: { x: heard.origin.x, y: heard.origin.y },
		heardAt: heard.heardAt,
		expiresAt: heard.heardAt + lifetimeSeconds,
		curiosityDecision: decision,
		curiosityEvidence: evidence
	};
}

/** @deprecated Use {@link heardToOpportunity} — retained name for call-site migration. */
export function heardToPending(
	heard: HeardSignal,
	lifetimeSeconds: number,
	simulationSeed: string,
	listenerId: string,
	curiosity: number
): SignalInvestigationOpportunity {
	return heardToOpportunity(heard, lifetimeSeconds, simulationSeed, listenerId, curiosity);
}

export type InsertPendingFromHeardInput = {
	pending: readonly SignalInvestigationOpportunity[];
	heardSignals: readonly HeardSignal[];
	config: PendingConfig;
	simulationSeed: string;
	listenerId: string;
	curiosity: number;
};

/**
 * Insert opportunities from heard signals, deduped by emissionId, bounded, newest last.
 * Curiosity is decided once at insert; existing entries are never recomputed.
 * Overflow drops the oldest prefix (deterministic).
 */
export function insertPendingFromHeard(
	input: InsertPendingFromHeardInput
): SignalInvestigationOpportunity[] {
	const { pending, heardSignals, config, simulationSeed, listenerId, curiosity } = input;
	let next = [...pending];
	for (const heard of heardSignals) {
		if (next.some((p) => p.emissionId === heard.emissionId)) {
			continue;
		}
		next.push(
			heardToOpportunity(
				heard,
				config.pendingSignalLifetimeSeconds,
				simulationSeed,
				listenerId,
				curiosity
			)
		);
	}
	if (next.length > config.maxPendingSignalsPerCreature) {
		next = next.slice(next.length - config.maxPendingSignalsPerCreature);
	}
	return next;
}

/** Drop pending with expiresAt <= timeSeconds. */
export function expirePendingSignals(
	pending: readonly SignalInvestigationOpportunity[],
	timeSeconds: number
): SignalInvestigationOpportunity[] {
	return pending.filter((p) => p.expiresAt > timeSeconds);
}

export function removePendingByEmissionId(
	pending: readonly SignalInvestigationOpportunity[],
	emissionId: string
): SignalInvestigationOpportunity[] {
	return pending.filter((p) => p.emissionId !== emissionId);
}

/**
 * Smooth distance falloff for presentation (signal rings): nearby ≈ 1, distant decreases,
 * never hard-zero. Not used for curiosity acceptance or goal eligibility.
 * distanceFactor = 1 / (1 + distance / scale)
 */
export function distanceFalloffFactor(distance: number, scale: number): number {
	const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
	const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
	return 1 / (1 + safeDistance / safeScale);
}

export type InvestigationSelection = {
	opportunity: SignalInvestigationOpportunity;
	/** Fixed eligible score for goal evaluation (not a multi-factor motivation blend). */
	score: number;
	reason: string;
};

/**
 * Choose the earliest-heard non-expired accepted opportunity (emissionId ASC on ties).
 * Rejected and pending opportunities are never selected.
 */
export function selectBestAcceptedOpportunity(
	opportunities: readonly SignalInvestigationOpportunity[],
	timeSeconds: number,
	eligibleScore: number
): InvestigationSelection | null {
	const liveAccepted = opportunities.filter(
		(p) => p.expiresAt > timeSeconds && p.curiosityDecision === 'accepted'
	);
	if (liveAccepted.length === 0) {
		return null;
	}
	const ordered = [...liveAccepted].sort((a, b) => {
		if (a.heardAt !== b.heardAt) {
			return a.heardAt - b.heardAt;
		}
		return a.emissionId < b.emissionId ? -1 : a.emissionId > b.emissionId ? 1 : 0;
	});
	const best = ordered[0]!;
	const sample = best.curiosityEvidence?.deterministicSample;
	const curiosity = best.curiosityEvidence?.curiosity;
	const reason =
		`curiosity accepted emission=${best.emissionId} symbol=${best.symbolId}` +
		(curiosity !== undefined && sample !== undefined
			? ` (curiosity=${curiosity.toFixed(3)} sample=${sample.toFixed(3)})`
			: '');
	return {
		opportunity: best,
		score: eligibleScore,
		reason
	};
}

/** @deprecated Prefer {@link selectBestAcceptedOpportunity}. */
export function selectBestPendingSignal(
	_creature: unknown,
	pendingSignals: readonly SignalInvestigationOpportunity[],
	timeSeconds: number,
	eligibleScore: number
): InvestigationSelection | null {
	void _creature;
	return selectBestAcceptedOpportunity(pendingSignals, timeSeconds, eligibleScore);
}

export function activeToPendingShape(
	active: ActiveSignalInvestigation,
	heardAtFallback: number
): SignalInvestigationOpportunity {
	return {
		emissionId: active.emissionId,
		symbolId: active.symbolId,
		senderId: active.senderId,
		origin: { x: active.origin.x, y: active.origin.y },
		// Use startedAt for age while travelling so age does not explode mid-trip.
		heardAt: heardAtFallback,
		// Active investigations do not expire; far-future placeholder for filters.
		expiresAt: Number.POSITIVE_INFINITY,
		// Already committed — treat as accepted for eligibility.
		curiosityDecision: 'accepted',
		curiosityEvidence: null
	};
}

export function beginInvestigation(
	pending: Pick<SignalInvestigationOpportunity, 'emissionId' | 'symbolId' | 'senderId' | 'origin'>,
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

export function countAcceptedPending(
	pending: readonly SignalInvestigationOpportunity[],
	timeSeconds: number
): number {
	return pending.filter((p) => p.expiresAt > timeSeconds && p.curiosityDecision === 'accepted')
		.length;
}

export function mostRecentCuriosityDecision(
	pending: readonly SignalInvestigationOpportunity[]
): SignalInvestigationOpportunity | null {
	if (pending.length === 0) {
		return null;
	}
	let best = pending[0]!;
	for (let i = 1; i < pending.length; i += 1) {
		const p = pending[i]!;
		if (p.heardAt > best.heardAt) {
			best = p;
		} else if (p.heardAt === best.heardAt && p.emissionId > best.emissionId) {
			best = p;
		}
	}
	return best;
}
