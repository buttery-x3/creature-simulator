import { describe, expect, it } from 'vitest';
import { defaultSimulationConfig } from '../create-simulation';
import { advanceNeeds, clampNeed, recoveryComplete } from './needs';

const rates = defaultSimulationConfig('needs');

describe('clampNeed', () => {
	it('clamps to [0, 1] and maps non-finite to 0', () => {
		expect(clampNeed(-1)).toBe(0);
		expect(clampNeed(2)).toBe(1);
		expect(clampNeed(0.5)).toBe(0.5);
		expect(clampNeed(Number.NaN)).toBe(0);
		expect(clampNeed(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('advanceNeeds', () => {
	it('raises hunger and thirst and drains energy while wandering', () => {
		const next = advanceNeeds(
			{ hunger: 0.2, thirst: 0.2, energy: 0.85, action: 'explore' },
			1,
			rates
		);
		expect(next.hunger).toBeCloseTo(0.2 + rates.hungerRisePerSecond, 10);
		expect(next.thirst).toBeCloseTo(0.2 + rates.thirstRisePerSecond, 10);
		expect(next.energy).toBeCloseTo(0.85 - rates.energyDrainPerSecond, 10);
	});

	it('reduces hunger by the food grant while eating and stays within bounds', () => {
		const grant = rates.eatRecoveryPerSecond;
		const next = advanceNeeds({ hunger: 0.8, thirst: 0.5, energy: 0.5, action: 'eat' }, 1, rates, {
			food: grant,
			water: 0
		});
		expect(next.hunger).toBeCloseTo(0.8 - grant, 10);
		expect(next.thirst).toBeGreaterThan(0.5);
		expect(next.hunger).toBeGreaterThanOrEqual(0);
		expect(next.hunger).toBeLessThanOrEqual(1);
	});

	it('applies only the partial food grant when the source is nearly empty', () => {
		const next = advanceNeeds({ hunger: 0.8, thirst: 0.5, energy: 0.5, action: 'eat' }, 1, rates, {
			food: 0.05,
			water: 0
		});
		expect(next.hunger).toBeCloseTo(0.75, 10);
	});

	it('does not recover hunger while eating without a grant', () => {
		const next = advanceNeeds({ hunger: 0.8, thirst: 0.5, energy: 0.5, action: 'eat' }, 1, rates);
		expect(next.hunger).toBeCloseTo(0.8, 10);
	});

	it('reduces thirst by the water grant while drinking', () => {
		const grant = rates.drinkRecoveryPerSecond;
		const next = advanceNeeds(
			{ hunger: 0.5, thirst: 0.9, energy: 0.5, action: 'drink' },
			1,
			rates,
			{ food: 0, water: grant }
		);
		expect(next.thirst).toBeCloseTo(0.9 - grant, 10);
	});

	it('restores energy while sleeping and does not raise hunger recovery', () => {
		const next = advanceNeeds({ hunger: 0.4, thirst: 0.4, energy: 0.2, action: 'sleep' }, 1, rates);
		expect(next.energy).toBeCloseTo(0.2 + rates.sleepRecoveryPerSecond, 10);
		expect(next.hunger).toBeGreaterThan(0.4);
	});

	it('is deterministic for identical inputs', () => {
		const a = advanceNeeds(
			{ hunger: 0.3, thirst: 0.4, energy: 0.5, action: 'move' },
			1 / 30,
			rates
		);
		const b = advanceNeeds(
			{ hunger: 0.3, thirst: 0.4, energy: 0.5, action: 'move' },
			1 / 30,
			rates
		);
		expect(a).toEqual(b);
	});
});

describe('recoveryComplete', () => {
	it('detects eat/drink/sleep recovery targets', () => {
		expect(recoveryComplete({ hunger: 0.1, thirst: 0.5, energy: 0.5, action: 'eat' }, rates)).toBe(
			true
		);
		expect(
			recoveryComplete({ hunger: 0.5, thirst: 0.1, energy: 0.5, action: 'drink' }, rates)
		).toBe(true);
		expect(
			recoveryComplete({ hunger: 0.5, thirst: 0.5, energy: 0.95, action: 'sleep' }, rates)
		).toBe(true);
		expect(
			recoveryComplete({ hunger: 0.5, thirst: 0.5, energy: 0.5, action: 'explore' }, rates)
		).toBe(false);
	});
});
