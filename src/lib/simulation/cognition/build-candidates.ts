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
import { INTENTION_RANK } from './types';
import { buildWarningCandidates } from './danger/warning-candidates';
import { applyDangerRouteRisk } from './ecology/danger-policy';
import { buildPhysicalCandidates, nightRestWeight } from './ecology/physical-candidates';
import { buildSignalCandidate } from './investigation/signal-candidate';
import { verbosityToSpeechWeight } from './speech-weight';
import {
	homeTarget,
	selectAnnounceTarget,
	selectResourceNeedTarget,
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
	const nightWeight = nightRestWeight(input);
	const restScore = 1 - energy + nightWeight;

	const foodValid = hungerPressure >= config.seekFoodThreshold;
	const waterValid = thirstPressure >= config.seekWaterThreshold;
	const restValid = restScore >= config.restThreshold;

	const foodTarget = selectResourceNeedTarget(position, input.availableFood, memory, 'food');
	const waterTarget = selectResourceNeedTarget(position, input.availableWater, memory, 'water');
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

	const restFactors: CandidateFactor[] = [
		{ code: 'energy_deficit', value: 1 - energy },
		{ code: 'night_rest', value: nightWeight }
	];
	const restReasons: CandidateReasonCode[] = restValid ? ['energy_deficit'] : ['below_threshold'];

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

	const physicalCandidates = buildPhysicalCandidates(input);
	return applyDangerRouteRisk(input, [
		...physicalCandidates,
		...buildWarningCandidates(input, physicalCandidates),
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
		buildSignalCandidate(input, foodTarget.source, waterTarget.source),
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
			intention: 'explore',
			valid: true,
			baseScore: config.exploreBaseline,
			target: null,
			reference: null,
			factors: [{ code: 'explore_baseline', value: config.exploreBaseline }],
			reasonCodes: ['explore_baseline', 'always_valid']
		})
	]).sort((a, b) => INTENTION_RANK[a.intention] - INTENTION_RANK[b.intention]);
}
