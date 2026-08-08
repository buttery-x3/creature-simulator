/**
 * Build the baseline intention candidate set from body, perception and memory.
 * Candidates are ephemeral — no opportunity lifecycle objects.
 *
 * Resource need scores (FLAME-82): pressure × target-quality multiplier so
 * visible evidence outranks remembered locations, which outrank blind search.
 */

import type {
	ArbitrationInput,
	CandidateFactor,
	CandidateReasonCode,
	CandidateReference,
	CognitionConfig,
	IntentionCandidate,
	IntentionKind
} from './types';
import { curiosityToInvestigationWeight } from './curiosity-weight';
import { verbosityToSpeechWeight } from './speech-weight';
import {
	homeTarget,
	selectAnnounceTarget,
	selectResourceNeedTarget,
	selectSignalInvestigationTarget,
	type ResourceTargetResult
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

function targetQualityFactor(
	source: ResourceTargetResult['source'],
	config: CognitionConfig
): number {
	if (source === 'visible') {
		return config.targetQualityVisible;
	}
	if (source === 'remembered') {
		return config.targetQualityRemembered;
	}
	return config.targetQualitySearch;
}

/**
 * Effective need score = pressure × target quality.
 * Factors always expose raw pressure and the quality multiplier used.
 */
function scoreResourceNeed(
	pressure: number,
	source: ResourceTargetResult['source'],
	config: CognitionConfig,
	pressureCode: 'hunger_pressure' | 'thirst_pressure',
	targetReasonCodes: readonly CandidateReasonCode[]
): { baseScore: number; factors: CandidateFactor[]; reasonCodes: CandidateReasonCode[] } {
	const quality = targetQualityFactor(source, config);
	return {
		baseScore: pressure * quality,
		factors: [
			{ code: pressureCode, value: pressure },
			{ code: 'target_quality', value: quality }
		],
		reasonCodes: [pressureCode, 'target_quality', ...targetReasonCodes]
	};
}

/**
 * Always returns one entry per baseline intention kind (valid or invalid).
 * Order follows INTENTION_TIE_BREAK_ORDER for stable diagnostics.
 */
export function buildCandidates(input: ArbitrationInput): IntentionCandidate[] {
	const { config, hunger, thirst, energy, memory, position } = input;

	const hungerPressure = hunger;
	const thirstPressure = thirst;
	const restScore = 1 - energy;

	const foodValid = hungerPressure >= config.seekFoodThreshold;
	const waterValid = thirstPressure >= config.seekWaterThreshold;
	const restValid = restScore >= config.restThreshold;

	const foodTarget = selectResourceNeedTarget(position, input.availableFood, memory, 'food');
	const waterTarget = selectResourceNeedTarget(position, input.availableWater, memory, 'water');
	const signal = selectSignalInvestigationTarget(memory);
	const announce = selectAnnounceTarget(input.availableFood, input.availableWater, memory);

	const foodScored = foodValid
		? scoreResourceNeed(
				hungerPressure,
				foodTarget.source,
				config,
				'hunger_pressure',
				foodTarget.reasonCodes
			)
		: {
				baseScore: 0,
				factors: [{ code: 'hunger_pressure', value: hungerPressure }] as CandidateFactor[],
				reasonCodes: ['below_threshold'] as CandidateReasonCode[]
			};

	const waterScored = waterValid
		? scoreResourceNeed(
				thirstPressure,
				waterTarget.source,
				config,
				'thirst_pressure',
				waterTarget.reasonCodes
			)
		: {
				baseScore: 0,
				factors: [{ code: 'thirst_pressure', value: thirstPressure }] as CandidateFactor[],
				reasonCodes: ['below_threshold'] as CandidateReasonCode[]
			};

	const restFactors: CandidateFactor[] = [{ code: 'energy_deficit', value: restScore }];
	const restReasons: CandidateReasonCode[] = restValid ? ['energy_deficit'] : ['below_threshold'];

	const signalValid = signal.memory !== null;
	const signalRecencyBoost = signalValid ? config.signalRecencyBoostMax * signal.recencyFactor : 0;
	// Unweighted signal motivation: used as need-driven information floor (trait-independent).
	const unweightedSignal = signalValid ? config.signalBaseline + signalRecencyBoost : 0;
	// Preference weight only — curiosity never decides validity.
	// Map trait → bounded optional-investigation multiplier so mid-range stays quieter
	// than the old uniform signal baseline while high curiosity can still compete.
	const curiosityWeight = curiosityToInvestigationWeight(input.curiosity);
	const optionalSignalScore = signalValid ? unweightedSignal * curiosityWeight : 0;
	// Need-driven floor: meaningful unmet need with only blind search knowledge
	// (target source `none` / reason `search_fallback`) may treat a retained signal
	// as potentially useful information, independent of curiosity.
	const hungerNeedsInformation = foodValid && foodTarget.source === 'none' && signalValid;
	const thirstNeedsInformation = waterValid && waterTarget.source === 'none' && signalValid;
	const needInformationFloor =
		hungerNeedsInformation || thirstNeedsInformation ? unweightedSignal : 0;
	const signalBase = Math.max(optionalSignalScore, needInformationFloor);
	const signalFactors: CandidateFactor[] = signalValid
		? [
				{ code: 'signal_baseline', value: config.signalBaseline },
				{ code: 'signal_recency', value: signalRecencyBoost },
				{ code: 'curiosity', value: input.curiosity },
				{ code: 'curiosity_weight', value: curiosityWeight },
				{ code: 'optional_signal_score', value: optionalSignalScore },
				...(needInformationFloor > 0
					? ([{ code: 'need_information_value', value: needInformationFloor }] as CandidateFactor[])
					: [])
			]
		: [];
	const signalReasons: CandidateReasonCode[] = signalValid
		? [
				'signal_baseline',
				'signal_recency',
				'curiosity',
				'curiosity_weight',
				'optional_signal_score',
				...(needInformationFloor > 0 ? (['need_information_value'] as CandidateReasonCode[]) : [])
			]
		: ['no_heard_signal'];
	const signalReference: CandidateReference | null = signal.memory
		? {
				kind: 'heard_signal',
				emissionId: signal.memory.emissionId,
				symbolId: signal.memory.symbolId
			}
		: null;

	const announceValid = announce.featureId !== null;
	// Preference weight only — verbosity never decides validity.
	// Map trait → bounded speech multiplier so mid-range stays quieter than the
	// old raw announceBaseline while high verbosity can still beat signal traffic.
	const speechWeight = verbosityToSpeechWeight(input.verbosity);
	const announceBase = announceValid ? config.announceBaseline * speechWeight : 0;
	const announceFactors: CandidateFactor[] = announceValid
		? [
				{ code: 'announce_baseline', value: config.announceBaseline },
				{ code: 'verbosity', value: input.verbosity },
				{ code: 'speech_weight', value: speechWeight }
			]
		: [];
	const announceReasons: CandidateReasonCode[] = announceValid
		? ['announce_baseline', 'verbosity', 'speech_weight']
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
			baseScore: foodScored.baseScore,
			target: foodValid ? foodTarget.target : null,
			reference:
				foodValid && foodTarget.featureId
					? {
							kind: 'feature',
							featureId: foodTarget.featureId,
							resourceKind: 'food'
						}
					: null,
			factors: foodScored.factors,
			reasonCodes: foodScored.reasonCodes,
			rejectionReason: foodValid ? undefined : 'below_threshold'
		}),
		candidate({
			intention: 'satisfy_thirst',
			valid: waterValid,
			baseScore: waterScored.baseScore,
			target: waterValid ? waterTarget.target : null,
			reference:
				waterValid && waterTarget.featureId
					? {
							kind: 'feature',
							featureId: waterTarget.featureId,
							resourceKind: 'water'
						}
					: null,
			factors: waterScored.factors,
			reasonCodes: waterScored.reasonCodes,
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
			baseScore: announceBase,
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
