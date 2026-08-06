/**
 * Learning subdomain types: personal symbol associations and signal investigation.
 * Meaning is per-creature and observational only — never global or copied from emitters.
 */

import type { Vec2 } from '$lib/habitat';
import type { SymbolId } from '../communication/types';

/**
 * Per-symbol food/water association for one creature.
 * Strengths are finite and clamped to the configured range (default [0, 1]).
 * Zero strength means no learned semantic knowledge.
 */
export type SymbolAssociation = {
	symbolId: SymbolId;
	foodStrength: number;
	waterStrength: number;
	foodEvidenceCount: number;
	waterEvidenceCount: number;
};

/**
 * Short-lived investigation candidate derived from a heard signal.
 * Contains only information available to the listener — never emitter contextDetail.
 */
export type PendingSignal = {
	emissionId: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	heardAt: number;
	expiresAt: number;
};

/**
 * Authoritative record of the signal currently being investigated.
 * Travel target is the recorded emission origin, not the sender's live position.
 */
export type ActiveSignalInvestigation = {
	emissionId: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	startedAt: number;
	expiresAt: number;
	/** True once the creature has arrived within arrival distance of origin. */
	arrived: boolean;
	/** Whether food evidence already reinforced this investigation. */
	foodEvidenceApplied: boolean;
	/** Whether water evidence already reinforced this investigation. */
	waterEvidenceApplied: boolean;
};

export type LearningOutcome =
	'food_evidence' | 'water_evidence' | 'mixed_evidence' | 'no_evidence' | 'expired' | 'interrupted';

/** Bounded diagnostic history of learning outcomes (newest last). */
export type LearningHistoryEntry = {
	timeSeconds: number;
	outcome: LearningOutcome;
	symbolId: SymbolId;
	emissionId: string;
	reason: string;
	foodStrengthBefore: number;
	foodStrengthAfter: number;
	waterStrengthBefore: number;
	waterStrengthAfter: number;
};
