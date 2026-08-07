/**
 * Investigation execution helpers and evidence qualification.
 * Learning never reads emitter contextDetail or global symbol meanings.
 *
 * Decision ownership for whether to investigate lives in cognition (heard_signal memory).
 * This module only supports execution-local investigation context and arrival evidence.
 */

import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../creature-movement';
import type { CreaturePerception, SimulationConfig } from '../types';
import type { ActiveSignalInvestigation, LearningHistoryEntry, LearningOutcome } from './types';

export type EvidenceConfig = Pick<SimulationConfig, 'learningEvidenceRadius'>;

/**
 * Characteristic smooth distance falloff for presentation (signal rings).
 * Does not affect investigation eligibility.
 * distanceFactor = 1 / (1 + distance / scale)
 */
export function distanceFalloffFactor(distance: number, scale: number): number {
	const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
	const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
	return 1 / (1 + safeDistance / safeScale);
}

export function beginInvestigation(
	source: {
		emissionId: string;
		symbolId: ActiveSignalInvestigation['symbolId'];
		origin: Vec2;
	},
	timeSeconds: number
): ActiveSignalInvestigation {
	return {
		emissionId: source.emissionId,
		symbolId: source.symbolId,
		origin: { x: source.origin.x, y: source.origin.y },
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
