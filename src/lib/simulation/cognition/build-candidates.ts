/**
 * Build the baseline intention candidate set from body, perception and memory.
 * Candidates are ephemeral — no opportunity lifecycle objects.
 */

import type {
	ArbitrationInput,
	CandidateFactor,
	CandidateReasonCode,
	CandidateReference,
	IntentionCandidate,
	IntentionKind
} from './types';
import {
	homeTarget,
	selectAnnounceTarget,
	selectResourceNeedTarget,
	selectSignalInvestigationTarget
} from './target-selection';

function candidate(partial: {
	intention: IntentionKind;
	valid: boolean;
	baseScore: number;
	target: IntentionCandidate['target'];
	reference: CandidateReference | null;
	factors: CandidateFactor[];
	reasonCodes: CandidateReasonCode[];
	rejectionReason?: CandidateReasonCode;
}): IntentionCandidate {
	return {
		intention: partial.intention,
		valid: partial.valid,
		score: partial.baseScore,
		baseScore: partial.baseScore,
		continuityAdjustment: 0,
		target: partial.target,
		reference: partial.reference,
		factors: partial.factors,
		reasonCodes: partial.reasonCodes,
		rejectionReason: partial.rejectionReason
	};
}

/**
 * Always returns one entry per baseline intention kind (valid or invalid).
 * Order follows INTENTION_TIE_BREAK_ORDER for stable diagnostics.
 */
export function buildCandidates(input: ArbitrationInput): IntentionCandidate[] {
	const { config, hunger, thirst, energy, memory, position } = input;

	const hungerScore = hunger;
	const thirstScore = thirst;
	const restScore = 1 - energy;

	const foodValid = hungerScore >= config.seekFoodThreshold;
	const waterValid = thirstScore >= config.seekWaterThreshold;
	const restValid = restScore >= config.restThreshold;

	const foodTarget = selectResourceNeedTarget(position, input.availableFood, memory, 'food');
	const waterTarget = selectResourceNeedTarget(position, input.availableWater, memory, 'water');
	const signal = selectSignalInvestigationTarget(memory);
	const announce = selectAnnounceTarget(input.availableFood, input.availableWater, memory);

	const foodFactors: CandidateFactor[] = [{ code: 'hunger_pressure', value: hungerScore }];
	const foodReasons: CandidateReasonCode[] = foodValid
		? ['hunger_pressure', ...foodTarget.reasonCodes]
		: ['below_threshold'];

	const waterFactors: CandidateFactor[] = [{ code: 'thirst_pressure', value: thirstScore }];
	const waterReasons: CandidateReasonCode[] = waterValid
		? ['thirst_pressure', ...waterTarget.reasonCodes]
		: ['below_threshold'];

	const restFactors: CandidateFactor[] = [{ code: 'energy_deficit', value: restScore }];
	const restReasons: CandidateReasonCode[] = restValid ? ['energy_deficit'] : ['below_threshold'];

	const signalValid = signal.memory !== null;
	const signalRecencyBoost = signalValid ? config.signalRecencyBoostMax * signal.recencyFactor : 0;
	const signalBase = signalValid ? config.signalBaseline + signalRecencyBoost : 0;
	const signalFactors: CandidateFactor[] = signalValid
		? [
				{ code: 'signal_baseline', value: config.signalBaseline },
				{ code: 'signal_recency', value: signalRecencyBoost }
			]
		: [];
	const signalReasons: CandidateReasonCode[] = signalValid
		? ['signal_baseline', 'signal_recency']
		: ['no_heard_signal'];
	const signalReference: CandidateReference | null = signal.memory
		? {
				kind: 'heard_signal',
				emissionId: signal.memory.emissionId,
				symbolId: signal.memory.symbolId
			}
		: null;

	const announceValid = announce.featureId !== null;
	const announceFactors: CandidateFactor[] = announceValid
		? [{ code: 'announce_baseline', value: config.announceBaseline }]
		: [];
	const announceReasons: CandidateReasonCode[] = announceValid
		? ['announce_baseline']
		: ['no_unannounced_resource'];
	const announceReference: CandidateReference | null =
		announce.featureId && announce.resourceKind
			? {
					kind: 'feature',
					featureId: announce.featureId,
					resourceKind: announce.resourceKind
				}
			: null;

	return [
		candidate({
			intention: 'satisfy_hunger',
			valid: foodValid,
			baseScore: foodValid ? hungerScore : 0,
			target: foodValid ? foodTarget.target : null,
			reference:
				foodValid && foodTarget.featureId
					? {
							kind: 'feature',
							featureId: foodTarget.featureId,
							resourceKind: 'food'
						}
					: null,
			factors: foodFactors,
			reasonCodes: foodReasons,
			rejectionReason: foodValid ? undefined : 'below_threshold'
		}),
		candidate({
			intention: 'satisfy_thirst',
			valid: waterValid,
			baseScore: waterValid ? thirstScore : 0,
			target: waterValid ? waterTarget.target : null,
			reference:
				waterValid && waterTarget.featureId
					? {
							kind: 'feature',
							featureId: waterTarget.featureId,
							resourceKind: 'water'
						}
					: null,
			factors: waterFactors,
			reasonCodes: waterReasons,
			rejectionReason: waterValid ? undefined : 'below_threshold'
		}),
		candidate({
			intention: 'rest',
			valid: restValid,
			baseScore: restValid ? restScore : 0,
			target: restValid ? homeTarget(input.homeFeatureId) : null,
			reference: restValid
				? { kind: 'feature', featureId: input.homeFeatureId, resourceKind: 'home' }
				: null,
			factors: restFactors,
			reasonCodes: restReasons,
			rejectionReason: restValid ? undefined : 'below_threshold'
		}),
		candidate({
			intention: 'investigate_signal',
			valid: signalValid,
			baseScore: signalBase,
			target: signal.target,
			reference: signalReference,
			factors: signalFactors,
			reasonCodes: signalReasons,
			rejectionReason: signalValid ? undefined : 'no_heard_signal'
		}),
		candidate({
			intention: 'announce_resource',
			valid: announceValid,
			baseScore: announceValid ? config.announceBaseline : 0,
			target: announce.target,
			reference: announceReference,
			factors: announceFactors,
			reasonCodes: announceReasons,
			rejectionReason: announceValid ? undefined : 'no_unannounced_resource'
		}),
		candidate({
			intention: 'wander',
			valid: true,
			baseScore: config.wanderBaseline,
			target: null,
			reference: null,
			factors: [{ code: 'wander_baseline', value: config.wanderBaseline }],
			reasonCodes: ['wander_baseline', 'always_valid']
		})
	];
}
