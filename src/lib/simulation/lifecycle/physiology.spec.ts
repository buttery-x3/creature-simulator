import { describe, expect, it } from 'vitest';
import { testCreature } from '../test-creature';
import { DEFAULT_LIFECYCLE_CONFIG, validateLifecycleConfig } from './defaults';
import { advanceLife, createLifeState, isMature, reproductionEligible } from './physiology';

const config = DEFAULT_LIFECYCLE_CONFIG;
function creature(age = config.maturitySeconds) {
	const base = testCreature({ hunger: 0.2, thirst: 0.2, energy: 0.9 });
	return { ...base, lifecycle: createLifeState('life-test', base.id, base.body, config, age) };
}

describe('lifecycle physiology', () => {
	it('creates deterministic independent adult age and empty personal lifecycle records', () => {
		const body = { size: 1.2, physicality: 0.8 };
		const first = createLifeState('life', 'a', body, config);
		const again = createLifeState('life', 'a', body, config);
		expect(first).toEqual(again);
		expect(first.ageSeconds).toBeGreaterThanOrEqual(config.initialAdultAgeMinSeconds);
		expect(first.ageSeconds).toBeLessThan(config.initialAdultAgeMaxSeconds);
		expect(first.adultBody).not.toBe(body);
		expect(first.parentIds).not.toBe(again.parentIds);
		expect(first.courtship).toBeNull();
		expect(first.deprivationSeconds).toEqual({ hunger: 0, thirst: 0 });
	});

	it('grows from an immutable baseline without compounding and preserves adult acquired physicality', () => {
		let child = advanceLife(creature(0), 0, 0, config).creature;
		expect(child.body.size).toBe(0.5);
		child = advanceLife(child, 45, 45, config).creature;
		expect(child.body.size).toBe(0.75);
		expect(child.body.physicality).toBe(0.75);
		child = advanceLife(child, 45, 90, config).creature;
		expect(child.body.size).toBe(1);
		expect(isMature(child.lifecycle, config)).toBe(true);
		child.body = { ...child.body, size: 1.3, physicality: 1.7 };
		const adult = advanceLife(child, 1, 91, config).creature;
		expect(adult.body.size).toBe(1.3);
		expect(adult.body.physicality).toBe(1.7);
		expect(adult.lifecycle.adultBody).toEqual({ size: 1, physicality: 1 });
	});

	it('requires sustained deprivation past grace and charges only elapsed exposure beyond it', () => {
		const thirsty = { ...creature(), thirst: 1 };
		const grace = advanceLife(thirsty, config.thirstGraceSeconds, 25, config);
		expect(grace.creature.body.health).toBe(1);
		expect(grace.deathCause).toBeNull();
		const injured = advanceLife(grace.creature, 2, 27, config);
		expect(injured.creature.body.health).toBeCloseTo(1 - 2 * config.thirstDamagePerSecond);
		const single = advanceLife(thirsty, config.thirstGraceSeconds + 2, 27, config);
		expect(single.creature).toEqual(injured.creature);
	});

	it('relief decays accumulated exposure and stops deprivation damage', () => {
		const exposed = advanceLife({ ...creature(), hunger: 1 }, 50, 50, config).creature;
		const relieved = advanceLife({ ...exposed, hunger: 0.5 }, 10, 60, config).creature;
		expect(relieved.lifecycle.deprivationSeconds.hunger).toBe(30);
		expect(relieved.body.health).toBe(exposed.body.health);
		const clear = advanceLife(relieved, 100, 160, config).creature;
		expect(clear.lifecycle.deprivationSeconds.hunger).toBe(0);
	});

	it('reports lethal deprivation and injury without a positive health floor', () => {
		const deprived = creature();
		deprived.body.health = 0.001;
		deprived.thirst = 1;
		deprived.lifecycle.deprivationSeconds.thirst = config.thirstGraceSeconds;
		const dead = advanceLife(deprived, 1, 1, config);
		expect(dead.creature.body.health).toBe(0);
		expect(dead.deathCause).toBe('deprivation');
		const injury = advanceLife(
			{ ...creature(), body: { ...creature().body, health: 0 } },
			0,
			1,
			config
		);
		expect(injury.deathCause).toBe('injury');
	});

	it('adds senescence damage and enforces finite maximum age even on a healthy body', () => {
		const elderly = advanceLife(creature(config.senescenceAgeSeconds - 1), 2, 2, config);
		expect(elderly.creature.body.health).toBeCloseTo(1 - config.ageDamagePerSecond);
		const oldest = advanceLife(creature(config.maxAgeSeconds - 0.5), 0.5, 1, config);
		expect(oldest.creature.body.health).toBe(0);
		expect(oldest.deathCause).toBe('age');
	});

	it('admits only mature healthy and resourced creatures outside their cooldown', () => {
		const eligible = creature();
		expect(reproductionEligible(eligible, 10, config)).toBe(true);
		for (const ineligible of [
			creature(0),
			{ ...eligible, energy: 0.59 },
			{ ...eligible, hunger: 0.51 },
			{ ...eligible, thirst: 0.51 },
			{ ...eligible, body: { ...eligible.body, health: 0.59 } },
			{ ...eligible, lifecycle: { ...eligible.lifecycle, nextReproductionAt: 11 } }
		])
			expect(reproductionEligible(ineligible, 10, config)).toBe(false);
	});

	it('validates finite bounds, ordered ages, meaningful timers and population limits', () => {
		expect(validateLifecycleConfig(config)).toEqual([]);
		for (const patch of [
			{ maxAgeSeconds: Infinity },
			{ maturitySeconds: 0 },
			{ newbornBodyScale: 2 },
			{ initialAdultAgeMinSeconds: 1 },
			{ initialAdultAgeMaxSeconds: 901 },
			{ maxAgeSeconds: 500 },
			{ courtshipTimeoutSeconds: 2 },
			{ populationCap: 1.5 },
			{ reproductionEnergyCost: 0.9 },
			{ eventHistoryLimit: 0 },
			{ hungerGraceSeconds: -1 }
		])
			expect(validateLifecycleConfig({ ...config, ...patch }).length).toBeGreaterThan(0);
	});
});
