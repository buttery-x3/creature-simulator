/**
 * Continuity adjustment and deterministic intention selection (FLAME-79).
 *
 * Soft continuity bonus on the current intention’s matching candidate —
 * not min-commitment, switch-margin gates, or explore exemptions.
 */

import type {
	ArbitrationRecord,
	ArbitrationTrigger,
	CandidateReasonCode,
	CognitionConfig,
	IntentionCandidate,
	IntentionKind
} from './types';
import { INTENTION_RANK } from './types';

/**
 * Apply continuity bonus to the current intention when it is still valid.
 * Preferred open decision: bonus on the matching candidate, not a separate
 * “continue” intention kind.
 *
 * Wander is excluded: aimless roaming must not stick via continuity and block
 * optional behaviours (announce, investigate) that beat the bare wander baseline.
 */
export function applyContinuity(
	candidates: readonly IntentionCandidate[],
	currentIntention: IntentionKind | null,
	config: CognitionConfig
): IntentionCandidate[] {
	if (!currentIntention) {
		return candidates.map((c) => ({ ...c, score: c.baseScore, continuityAdjustment: 0 }));
	}

	return candidates.map((c) => {
		if (c.intention !== currentIntention || !c.valid) {
			return { ...c, score: c.baseScore, continuityAdjustment: 0 };
		}
		// Negligible / zero continuity for wander — do not sticky-roam past announce.
		const continuityAdjustment = currentIntention === 'wander' ? 0 : config.continuityBonus;
		if (continuityAdjustment === 0) {
			return { ...c, score: c.baseScore, continuityAdjustment: 0 };
		}
		return {
			...c,
			continuityAdjustment,
			score: c.baseScore + continuityAdjustment,
			factors: [...c.factors, { code: 'continuity_bonus', value: continuityAdjustment }],
			reasonCodes: [...c.reasonCodes, 'continuity_bonus' as CandidateReasonCode]
		};
	});
}

/**
 * Highest score among valid candidates; explicit intention rank on ties.
 * Wander is always valid and acts as the safe fallback pool.
 */
export function selectBestCandidate(candidates: readonly IntentionCandidate[]): IntentionCandidate {
	const valid = candidates.filter((c) => c.valid);
	const pool = valid.length > 0 ? valid : candidates.filter((c) => c.intention === 'wander');
	let best = pool[0]!;
	for (let i = 1; i < pool.length; i += 1) {
		const candidate = pool[i]!;
		if (
			candidate.score > best.score ||
			(candidate.score === best.score &&
				INTENTION_RANK[candidate.intention] < INTENTION_RANK[best.intention])
		) {
			best = candidate;
		}
	}
	return best;
}

export function annotateSelection(
	candidates: readonly IntentionCandidate[],
	selected: IntentionCandidate
): IntentionCandidate[] {
	return candidates.map((c) => {
		if (c.intention === selected.intention) {
			const rest = { ...c };
			delete rest.rejectionReason;
			return rest;
		}
		if (!c.valid) {
			return {
				...c,
				rejectionReason: c.rejectionReason ?? 'invalid_not_selected'
			};
		}
		return {
			...c,
			rejectionReason: c.rejectionReason ?? 'not_selected'
		};
	});
}

export function buildArbitrationRecord(input: {
	timeSeconds: number;
	trigger: ArbitrationTrigger;
	previousIntention: IntentionKind | null;
	candidates: readonly IntentionCandidate[];
}): ArbitrationRecord {
	const selected = selectBestCandidate(input.candidates);
	const annotated = annotateSelection(input.candidates, selected);

	const selectionReasonCodes: CandidateReasonCode[] = ['selected_highest_score'];
	const tied = input.candidates.filter(
		(c) => c.valid && c.score === selected.score && c.intention !== selected.intention
	);
	if (tied.length > 0) {
		selectionReasonCodes.push('selected_tie_break');
	}
	if (selected.continuityAdjustment > 0) {
		selectionReasonCodes.push('continuity_bonus');
	}

	return {
		timeSeconds: input.timeSeconds,
		trigger: input.trigger,
		previousIntention: input.previousIntention,
		selectedIntention: selected.intention,
		selectedTarget: selected.target,
		selectionReasonCodes,
		candidates: annotated
	};
}
