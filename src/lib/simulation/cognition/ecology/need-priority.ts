import type { CandidateFactor, CandidateReasonCode, CognitionConfig } from '../types';
import type { ResourceTargetResult } from '../target-selection';

/** Ordinary quality ordering remains intact; even acute unknown resources remain uncertain. */
export const ACUTE_NEED_POLICY = { onset: 0.9, discountRelief: 0.8 };

/** Smoothstep keeps value and slope continuous at the onset and saturated pressure. */
export function acuteNeedUrgency(pressure: number): number {
	const t = Math.max(
		0,
		Math.min(1, (pressure - ACUTE_NEED_POLICY.onset) / (1 - ACUTE_NEED_POLICY.onset))
	);
	return t * t * (3 - 2 * t);
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
 * Effective need score = pressure × quality, with smooth uncertainty relief for acute pressure.
 * Factors always expose raw pressure and the quality multiplier used.
 */
export function scoreResourceNeed(
	pressure: number,
	source: ResourceTargetResult['source'],
	config: CognitionConfig,
	pressureCode: 'hunger_pressure' | 'thirst_pressure',
	targetReasonCodes: readonly CandidateReasonCode[]
): { baseScore: number; factors: CandidateFactor[]; reasonCodes: CandidateReasonCode[] } {
	const quality = targetQualityFactor(source, config);
	const urgency = acuteNeedUrgency(pressure);
	const effectiveQuality =
		quality +
		Math.max(0, config.targetQualityVisible - quality) * ACUTE_NEED_POLICY.discountRelief * urgency;
	return {
		baseScore: pressure * effectiveQuality,
		factors: [
			{ code: pressureCode, value: pressure },
			{ code: 'target_quality', value: quality },
			{ code: 'acute_need_urgency', value: urgency },
			{ code: 'effective_target_quality', value: effectiveQuality }
		],
		reasonCodes: [pressureCode, 'target_quality', ...targetReasonCodes]
	};
}
