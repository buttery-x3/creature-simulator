import { distanceToHome, OUTDOOR_REST_RECOVERY } from '../../ecology/rest';
import type { ArbitrationInput, IntentionCandidate } from '../types';
import { homeTarget } from '../target-selection';
import { applyDangerRouteRisk } from './danger-policy';
import { nightRestWeight } from './physical-candidates';

export const REST_DESTINATION_POLICY = { travelEffortPerUnit: 0.04 };

/** One rest intention chooses between innate home and the exact current location. */
export function buildRestCandidate(input: ArbitrationInput): IntentionCandidate {
	const nightWeight = nightRestWeight(input);
	const pressure = 1 - input.energy + nightWeight;
	const valid = pressure >= input.config.restThreshold;
	const home: IntentionCandidate = {
		intention: 'rest',
		valid,
		score: valid ? pressure : 0,
		baseScore: valid ? pressure : 0,
		continuityAdjustment: 0,
		target: valid ? homeTarget(input.homeFeatureId) : null,
		reference: valid
			? { kind: 'feature', featureId: input.homeFeatureId, resourceKind: 'home' }
			: null,
		factors: [
			{ code: 'energy_deficit', value: 1 - input.energy },
			{ code: 'night_rest', value: nightWeight }
		],
		reasonCodes: valid ? ['energy_deficit'] : ['below_threshold'],
		rejectionReason: valid ? undefined : 'below_threshold'
	};
	if (!valid || !input.physical?.homePosition) return home;
	const distance = distanceToHome(input.position, {
		position: input.physical.homePosition,
		size: input.physical.homeSize ?? { width: 0, height: 0 }
	});
	const travelEffort = distance * REST_DESTINATION_POLICY.travelEffortPerUnit * (2 - input.energy);
	const homeQuality = 1 / (1 + travelEffort);
	// Exhaustion reduces willingness to pay travel costs for a more restorative site.
	const localRecovery = distance === 0 ? 1 : OUTDOOR_REST_RECOVERY;
	const localQuality = 1 - (1 - localRecovery) * input.energy;
	const homeOption = {
		...home,
		baseScore: pressure * homeQuality,
		score: pressure * homeQuality,
		factors: [
			...home.factors,
			{ code: 'rest_travel_distance', value: distance },
			{ code: 'rest_travel_effort', value: travelEffort },
			{ code: 'rest_destination_quality', value: homeQuality },
			{ code: 'rest_recovery_multiplier', value: 1 }
		]
	};
	const localOption: IntentionCandidate = {
		...home,
		baseScore: pressure * localQuality,
		score: pressure * localQuality,
		target: { kind: 'point', position: { ...input.position } },
		reference: { kind: 'point', position: { ...input.position } },
		factors: [
			...home.factors,
			{ code: 'rest_travel_distance', value: 0 },
			{ code: 'rest_destination_quality', value: localQuality },
			{ code: 'rest_recovery_multiplier', value: localRecovery }
		],
		reasonCodes: [...home.reasonCodes, 'local_rest']
	};
	const [safeHome, safeLocal] = applyDangerRouteRisk(input, [homeOption, localOption]);
	const selected = safeLocal.baseScore > safeHome.baseScore ? safeLocal : safeHome;
	return {
		...selected,
		factors: [
			...selected.factors,
			{ code: 'home_rest_score', value: safeHome.baseScore },
			{ code: 'local_rest_score', value: safeLocal.baseScore }
		]
	};
}
