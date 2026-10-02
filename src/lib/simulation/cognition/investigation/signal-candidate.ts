/** Listener-local signal policy. Memory supplies evidence; cognition ranks uncertain information. */
import { listHeardSignalMemories } from '../../memory/query';
import type { HeardSignalMemory } from '../../memory/types';
import type { ArbitrationInput, IntentionCandidate, SignalEvaluation } from '../types';
import { curiosityToInvestigationWeight } from './curiosity-weight';

/** At most 0.20: exceeds the 0.04 recency range, below strong actionable needs/rest. */
export const MATCHED_NEED_RELEVANCE_MAX = 0.2;
type Knowledge = SignalEvaluation['foodKnowledge'];

function evaluateSignal(
	memory: HeardSignalMemory,
	input: ArbitrationInput,
	foodKnowledge: Knowledge,
	waterKnowledge: Knowledge
): SignalEvaluation {
	const { config, lexicon } = input;
	const interpretation =
		lexicon.food === memory.symbolId
			? 'food'
			: lexicon.water === memory.symbolId
				? 'water'
				: 'unknown';
	const hungerUnresolved = input.hunger >= config.seekFoodThreshold && foodKnowledge === 'none';
	const thirstUnresolved = input.thirst >= config.seekWaterThreshold && waterKnowledge === 'none';
	const recency = Math.min(
		1,
		Math.max(0, memory.sequence / Math.max(1, input.memory.nextSequence - 1))
	);
	const recencyBoost = config.signalRecencyBoostMax * recency;
	const unweighted = config.signalBaseline + recencyBoost;
	const optionalScore = unweighted * curiosityToInvestigationWeight(input.curiosity);
	const informationFloor = hungerUnresolved || thirstUnresolved ? unweighted : 0;
	const matchedPressure =
		interpretation === 'food' && hungerUnresolved
			? input.hunger
			: interpretation === 'water' && thirstUnresolved
				? input.thirst
				: 0;
	const semanticContribution =
		MATCHED_NEED_RELEVANCE_MAX * Math.min(1, Math.max(0, matchedPressure));
	return {
		emissionId: memory.emissionId,
		symbolId: memory.symbolId,
		origin: { ...memory.origin },
		sequence: memory.sequence,
		interpretation,
		hungerPressure: input.hunger,
		thirstPressure: input.thirst,
		foodKnowledge,
		waterKnowledge,
		optionalScore,
		informationFloor,
		semanticContribution,
		recencyBoost,
		score: Math.max(optionalScore, informationFloor) + semanticContribution,
		selected: false
	};
}

/** One investigation candidate, with all retained alternatives in explicit best-first order. */
export function buildSignalCandidate(
	input: ArbitrationInput,
	foodKnowledge: Knowledge,
	waterKnowledge: Knowledge
): IntentionCandidate {
	const signalEvaluations = listHeardSignalMemories(input.memory)
		.map((memory) => evaluateSignal(memory, input, foodKnowledge, waterKnowledge))
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.sequence - a.sequence ||
				(a.emissionId < b.emissionId ? -1 : a.emissionId > b.emissionId ? 1 : 0)
		);
	const best = signalEvaluations[0];
	if (best) best.selected = true;
	return {
		intention: 'investigate_signal',
		valid: !!best,
		baseScore: best?.score ?? 0,
		score: best?.score ?? 0,
		continuityAdjustment: 0,
		target: best ? { kind: 'point', position: { ...best.origin } } : null,
		reference: best
			? { kind: 'heard_signal', emissionId: best.emissionId, symbolId: best.symbolId }
			: null,
		factors: best
			? [
					{ code: 'signal_baseline', value: input.config.signalBaseline },
					{ code: 'signal_recency', value: best.recencyBoost },
					{ code: 'curiosity', value: input.curiosity },
					{ code: 'curiosity_weight', value: curiosityToInvestigationWeight(input.curiosity) },
					{ code: 'optional_signal_score', value: best.optionalScore },
					...(best.informationFloor > 0
						? [{ code: 'need_information_value', value: best.informationFloor }]
						: []),
					{ code: 'semantic_relevance', value: best.semanticContribution }
				]
			: [],
		reasonCodes: best
			? [
					'signal_baseline',
					'signal_recency',
					'curiosity',
					'curiosity_weight',
					'optional_signal_score',
					...(best.informationFloor > 0 ? ['need_information_value' as const] : []),
					...(best.semanticContribution > 0 ? ['semantic_relevance' as const] : [])
				]
			: ['no_heard_signal'],
		...(best ? {} : { rejectionReason: 'no_heard_signal' as const }),
		signalEvaluations
	};
}
