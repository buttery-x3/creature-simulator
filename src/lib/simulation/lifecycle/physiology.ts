import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Creature } from '../types';
import type { DeathCause, LifeState, LifecycleConfig } from './types';

export function createLifeState(
	seed: string,
	id: string,
	adultBody: LifeState['adultBody'],
	config: LifecycleConfig,
	ageSeconds?: number
): LifeState {
	const rng = createSeededRng(deriveSeed(seed, 'life-age', id));
	return {
		ageSeconds:
			ageSeconds ??
			rng.nextRange(config.initialAdultAgeMinSeconds, config.initialAdultAgeMaxSeconds),
		adultBody: { size: adultBody.size, physicality: adultBody.physicality },
		nextReproductionAt: 0,
		courtship: null,
		deprivationSeconds: { hunger: 0, thirst: 0 },
		generation: 0,
		parentIds: []
	};
}

export function isMature(
	life: LifeState,
	config: Pick<LifecycleConfig, 'maturitySeconds'>
): boolean {
	return life.ageSeconds >= config.maturitySeconds;
}

export function reproductionEligible(
	creature: Pick<Creature, 'lifecycle' | 'body' | 'energy' | 'hunger' | 'thirst'>,
	time: number,
	config: LifecycleConfig
): boolean {
	return (
		isMature(creature.lifecycle, config) &&
		creature.body.health > 0 &&
		creature.body.health >= config.reproductionHealthMin &&
		creature.energy >= config.reproductionEnergyMin &&
		creature.hunger <= config.reproductionNeedMax &&
		creature.thirst <= config.reproductionNeedMax &&
		time >= creature.lifecycle.nextReproductionAt
	);
}

/** Age/growth and sustained deprivation; no recovery or automatic action selection. */
export function advanceLife(
	creature: Creature,
	dt: number,
	_time: number,
	config: LifecycleConfig
): { creature: Creature; deathCause: DeathCause | null } {
	const elapsed = Math.max(0, dt);
	const life = creature.lifecycle;
	const ageSeconds = life.ageSeconds + elapsed;
	const deprivation = { ...life.deprivationSeconds };
	let deprivationDamage = 0;
	for (const need of ['hunger', 'thirst'] as const) {
		const previous = deprivation[need];
		const deprived = creature[need] >= config.deprivationThreshold;
		deprivation[need] = deprived
			? previous + elapsed
			: Math.max(0, previous - elapsed * config.deprivationRecoveryRate);
		const grace = need === 'hunger' ? config.hungerGraceSeconds : config.thirstGraceSeconds;
		// Only the portion of this step beyond grace causes damage.
		const damagedSeconds = deprived ? Math.min(elapsed, Math.max(0, deprivation[need] - grace)) : 0;
		deprivationDamage +=
			damagedSeconds *
			(need === 'hunger' ? config.hungerDamagePerSecond : config.thirstDamagePerSecond);
	}
	const agedSeconds = Math.min(elapsed, Math.max(0, ageSeconds - config.senescenceAgeSeconds));
	const ageDamage = agedSeconds * config.ageDamagePerSecond;
	let health = Math.max(0, creature.body.health - deprivationDamage - ageDamage);
	let deathCause: DeathCause | null = creature.body.health <= 0 ? 'injury' : null;
	if (!deathCause && ageSeconds >= config.maxAgeSeconds) {
		health = 0;
		deathCause = 'age';
	} else if (!deathCause && health === 0) {
		deathCause = deprivationDamage > 0 ? 'deprivation' : 'age';
	}
	let body = { ...creature.body, health };
	if (!isMature(life, config)) {
		const maturity = Math.min(1, ageSeconds / config.maturitySeconds);
		const scale = config.newbornBodyScale + (1 - config.newbornBodyScale) * maturity;
		body = {
			...body,
			size: life.adultBody.size * scale,
			physicality: life.adultBody.physicality * scale
		};
	}
	return {
		creature: {
			...creature,
			body,
			lifecycle: { ...life, ageSeconds, deprivationSeconds: deprivation }
		},
		deathCause
	};
}
