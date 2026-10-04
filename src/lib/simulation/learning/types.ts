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
export type LexiconMeaning = 'food' | 'water' | 'danger';

export const LEXICON_MEANINGS: readonly LexiconMeaning[] = ['food', 'water', 'danger'] as const;

/**
 * Per-symbol raw meaning evidence for one creature.
 * Strengths are finite and clamped to the configured range (default [0, 1]).
 * Zero strength means no learned semantic knowledge. Evidence may be ambiguous;
 * exclusive interpretation lives on {@link CreatureLexicon}.
 */
export type MeaningEvidence = { strength: number; count: number };
export type MeaningStrengths = Record<LexiconMeaning, number>;

export type SymbolAssociation = {
	symbolId: SymbolId;
	evidence: Record<LexiconMeaning, MeaningEvidence>;
	/** Bounded listener-local observation episodes already credited for danger. */
	dangerEvidenceEpisodes: string[];
};

/**
 * Exclusive per-creature vocabulary: at most one symbol per meaning and one
 * meaning per symbol. Null means unassigned (insufficient evidence or lost competition).
 */
export type CreatureLexicon = Record<LexiconMeaning, SymbolId | null>;

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

/**
 * Execution-local record of the signal currently being investigated.
 * Travel target is the recorded emission origin, not a live sender position.
 * Not a behaviour lock — ordinary arbitration may replace the intention.
 * No travel timeout — investigation completes only after arrival inspection.
 */
export type ActiveSignalInvestigation = {
	emissionId: string;
	symbolId: SymbolId;
	origin: Vec2;
	startedAt: number;
};

export type LearningOutcome =
	| 'food_evidence'
	| 'water_evidence'
	| 'danger_evidence'
	| 'mixed_evidence'
	| 'no_evidence'
	| 'interrupted';

/** Bounded diagnostic history of learning outcomes (newest last). */
export type LearningHistoryEntry = {
	timeSeconds: number;
	outcome: LearningOutcome;
	symbolId: SymbolId;
	emissionId: string;
	reason: string;
	before: MeaningStrengths;
	after: MeaningStrengths;
};
