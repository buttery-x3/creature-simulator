import { bodyAbility } from '../../ecology/body';
import { listHeardSignalMemories } from '../../memory/query';
import { retreatFrom } from '../ecology/danger-policy';
import type { ArbitrationInput, IntentionCandidate } from '../types';
import type { CreatureLexicon } from '../../learning/types';
import type { CreatureMemory } from '../../memory/types';

/** Moving danger cannot be pinned to a warning's old origin indefinitely. */
export const WARNING_MAX_AGE_SECONDS = 12;

export function hasFreshDangerSignal(
	memory: CreatureMemory,
	lexicon: CreatureLexicon,
	time: number
): boolean {
	return listHeardSignalMemories(memory).some(
		(entry) =>
			entry.symbolId === lexicon.danger && time - entry.rememberedAt < WARNING_MAX_AGE_SECONDS
	);
}

function empty(intention: 'warn_danger' | 'avoid_danger'): IntentionCandidate {
	return {
		intention,
		valid: false,
		score: 0,
		baseScore: 0,
		continuityAdjustment: 0,
		target: null,
		reference: null,
		factors: [],
		reasonCodes: ['no_warning_evidence'],
		rejectionReason: 'no_warning_evidence'
	};
}

/** Learned warnings influence voluntary retreat; they disclose no hidden entity or position. */
export function buildWarningCandidates(
	input: ArbitrationInput,
	physicalCandidates: readonly IntentionCandidate[]
): IntentionCandidate[] {
	let avoid = empty('avoid_danger');
	let warn = empty('warn_danger');
	const physical = input.physical;
	if (!physical) return [avoid, warn];
	const ability = bodyAbility(physical.body, input.energy);
	const flee = physicalCandidates.find((c) => c.intention === 'flee' && c.valid);
	const seesDanger = physical.wildlife.some(
		(w) => w.health > 0 && bodyAbility({ ...w, nextAttackAt: 0 }, w.energy) > ability * 0.65
	);
	if (seesDanger && flee && input.speechReady && input.verbosity > 0) {
		const score = flee.baseScore + input.verbosity * 0.08;
		warn = {
			...flee,
			intention: 'warn_danger',
			score,
			baseScore: score,
			factors: [...flee.factors, { code: 'warning_expression', value: input.verbosity * 0.08 }],
			reasonCodes: ['local_danger', 'warning_opportunity'],
			rejectionReason: undefined
		};
	}
	for (const memory of listHeardSignalMemories(input.memory)) {
		if (input.lexicon.danger !== memory.symbolId) continue;
		const age = Math.max(0, input.timeSeconds - memory.rememberedAt);
		if (age >= WARNING_MAX_AGE_SECONDS) continue;
		const association = input.symbolAssociations?.find((a) => a.symbolId === memory.symbolId);
		const strength = Math.min(1, Math.max(0, association?.dangerStrength ?? 0));
		// The resolved assignment establishes a tentative interpretation; raw evidence sets confidence.
		const confidence = 0.4 + strength * 0.6;
		const distance = Math.hypot(
			input.position.x - memory.origin.x,
			input.position.y - memory.origin.y
		);
		const freshness = 1 - age / WARNING_MAX_AGE_SECONDS;
		const proximity = 1 / (1 + distance / 4);
		const vulnerability = Math.min(1.5, 1 / (0.5 + ability));
		const score = Math.min(0.95, confidence * freshness * proximity * vulnerability);
		if (score <= avoid.baseScore) continue;
		avoid = {
			...empty('avoid_danger'),
			valid: true,
			score,
			baseScore: score,
			target: {
				kind: 'point',
				position: retreatFrom(input.position, memory.origin, physical.bounds)
			},
			reference: { kind: 'heard_signal', emissionId: memory.emissionId, symbolId: memory.symbolId },
			factors: [
				{ code: 'learned_danger_confidence', value: confidence },
				{ code: 'warning_age', value: age },
				{ code: 'warning_freshness', value: freshness },
				{ code: 'origin_proximity', value: proximity },
				{ code: 'physical_vulnerability', value: vulnerability }
			],
			reasonCodes: ['learned_danger'],
			rejectionReason: undefined
		};
	}
	return [avoid, warn];
}
