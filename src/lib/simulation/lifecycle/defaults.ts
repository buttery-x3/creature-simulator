import type { LifecycleConfig } from './types';

/** Accelerated experiment timing, not a guarantee of population replacement. */
export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
	maturitySeconds: 90,
	newbornBodyScale: 0.5,
	initialAdultAgeMinSeconds: 90,
	initialAdultAgeMaxSeconds: 240,
	senescenceAgeSeconds: 540,
	maxAgeSeconds: 900,
	ageDamagePerSecond: 0.004,
	deprivationThreshold: 0.95,
	hungerGraceSeconds: 45,
	thirstGraceSeconds: 25,
	hungerDamagePerSecond: 0.004,
	thirstDamagePerSecond: 0.006,
	deprivationRecoveryRate: 2,
	reproductionHealthMin: 0.6,
	reproductionEnergyMin: 0.6,
	reproductionNeedMax: 0.5,
	courtshipDistance: 1,
	mutualCourtshipSeconds: 3,
	courtshipTimeoutSeconds: 6,
	failedCourtshipCooldownSeconds: 15,
	reproductionCooldownSeconds: 120,
	reproductionEnergyCost: 0.2,
	reproductionHungerCost: 0.15,
	populationCap: 64,
	eventHistoryLimit: 32
};

/** Creation owns error presentation; lifecycle owns constraints on its own tunables. */
export function validateLifecycleConfig(config: LifecycleConfig): string[] {
	const errors: string[] = [];
	for (const key of Object.keys(DEFAULT_LIFECYCLE_CONFIG) as (keyof LifecycleConfig)[]) {
		if (!Number.isFinite(config[key]) || config[key] < 0)
			errors.push(`lifecycle.${key} must be finite and non-negative`);
	}
	for (const key of [
		'newbornBodyScale',
		'deprivationThreshold',
		'reproductionHealthMin',
		'reproductionEnergyMin',
		'reproductionNeedMax',
		'reproductionEnergyCost',
		'reproductionHungerCost'
	] as const) {
		if (config[key] > 1) errors.push(`lifecycle.${key} must be <= 1`);
	}
	for (const key of [
		'maturitySeconds',
		'newbornBodyScale',
		'courtshipDistance',
		'mutualCourtshipSeconds',
		'failedCourtshipCooldownSeconds',
		'reproductionCooldownSeconds'
	] as const) {
		if (config[key] <= 0) errors.push(`lifecycle.${key} must be > 0`);
	}
	for (const key of ['populationCap', 'eventHistoryLimit'] as const) {
		if (!Number.isInteger(config[key]) || config[key] < 1)
			errors.push(`lifecycle.${key} must be a positive integer`);
	}
	if (
		config.initialAdultAgeMinSeconds < config.maturitySeconds ||
		config.initialAdultAgeMaxSeconds < config.initialAdultAgeMinSeconds
	)
		errors.push('lifecycle initial ages must be mature and ordered');
	if (
		config.senescenceAgeSeconds < config.maturitySeconds ||
		config.maxAgeSeconds <= config.senescenceAgeSeconds ||
		config.initialAdultAgeMaxSeconds >= config.maxAgeSeconds
	)
		errors.push(
			'lifecycle ages must order maturity, senescence and maximum age, with founders below maximum age'
		);
	if (config.courtshipTimeoutSeconds <= config.mutualCourtshipSeconds)
		errors.push('lifecycle courtship timeout must exceed mutual duration');
	if (config.reproductionEnergyCost > config.reproductionEnergyMin)
		errors.push('lifecycle reproduction energy cost must not exceed minimum eligible energy');
	return errors;
}
