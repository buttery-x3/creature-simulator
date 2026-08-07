/**
 * Learning subdomain types: personal symbol evidence, exclusive lexicon, investigation.
 * Meaning is per-creature and observational only — never global or copied from emitters.
 *
 * `SymbolAssociation` is raw experiential evidence (may overlap across meanings).
 * `CreatureLexicon` is the creature's current exclusive one-to-one interpretation.
 */

import type { Vec2 } from '$lib/habitat';
import type { SymbolId } from '../communication/types';

/** Controlled semantic meanings currently resolved into the personal lexicon. */
export type LexiconMeaning = 'food' | 'water';

export const LEXICON_MEANINGS: readonly LexiconMeaning[] = ['food', 'water'] as const;

/**
 * Per-symbol raw food/water evidence for one creature.
 * Strengths are finite and clamped to the configured range (default [0, 1]).
 * Zero strength means no learned semantic knowledge. Evidence may be ambiguous;
 * exclusive interpretation lives on {@link CreatureLexicon}.
 */
export type SymbolAssociation = {
	symbolId: SymbolId;
	foodStrength: number;
	waterStrength: number;
	foodEvidenceCount: number;
	waterEvidenceCount: number;
};

/**
 * Exclusive per-creature vocabulary: at most one symbol per meaning and one
 * meaning per symbol. Null means unassigned (insufficient evidence or lost competition).
 */
export type CreatureLexicon = {
	food: SymbolId | null;
	water: SymbolId | null;
};

/** Bounded diagnostic history of exclusive lexicon reassignments (newest last). */
export type LexiconChangeEntry = {
	timeSeconds: number;
	meaning: LexiconMeaning;
	previousSymbolId: SymbolId | null;
	newSymbolId: SymbolId | null;
	assignmentScore: number;
	reason: string;
	evidenceNote: string;
};

/** Explicit curiosity outcome for one heard emission (listener-local). */
export type CuriosityDecision = 'pending' | 'accepted' | 'rejected';

/** Structured evidence for a one-shot curiosity sample (inspectable, serialisable). */
export type CuriosityEvidence = {
	/** Creature curiosity at decision time. */
	curiosity: number;
	/** Deterministic sample in [0, 1); accepted when sample < curiosity. */
	deterministicSample: number;
};

/**
 * Short-lived investigation opportunity derived from a heard signal.
 * Contains only information available to the listener — never emitter contextDetail.
 * Curiosity is decided once at ingest (accepted/rejected); rejected stays for diagnostics
 * but is never selected as an investigation goal.
 */
export type SignalInvestigationOpportunity = {
	emissionId: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	heardAt: number;
	expiresAt: number;
	curiosityDecision: CuriosityDecision;
	curiosityEvidence: CuriosityEvidence | null;
};

/** @deprecated Prefer {@link SignalInvestigationOpportunity}; alias for existing call sites. */
export type PendingSignal = SignalInvestigationOpportunity;

/**
 * Authoritative record of the signal currently being investigated.
 * Travel target is the recorded emission origin, not the sender's live position.
 * No travel timeout — investigation completes only after arrival inspection.
 */
export type ActiveSignalInvestigation = {
	emissionId: string;
	symbolId: SymbolId;
	senderId: string;
	origin: Vec2;
	startedAt: number;
};

export type LearningOutcome =
	'food_evidence' | 'water_evidence' | 'mixed_evidence' | 'no_evidence' | 'interrupted';

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
