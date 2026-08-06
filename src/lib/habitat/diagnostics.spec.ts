import { describe, expect, it } from 'vitest';
import { formatHabitatDiagnostics, habitatDiagnosticRecord } from './diagnostics';
import { defaultHabitatConfig, generateHabitat } from './generate-habitat';

describe('habitat diagnostics', () => {
	it('includes seed, bounds, ids, types, positions and sizes', () => {
		const habitat = generateHabitat(defaultHabitatConfig('diag'));
		const text = formatHabitatDiagnostics(habitat);
		expect(text).toContain('seed: diag');
		expect(text).toContain('world bounds:');
		expect(text).toContain('home');
		expect(text).toContain('food-0');
		expect(text).toContain('water-0');
		expect(text).toMatch(/centre=/);
		expect(text).toMatch(/size=/);
	});

	it('exposes a structured diagnostic record', () => {
		const habitat = generateHabitat(defaultHabitatConfig('record'));
		const record = habitatDiagnosticRecord(habitat);
		expect(record.seed).toBe('record');
		expect(record.counts.food).toBe(habitat.food.length);
		expect(record.features.some((f) => f.id === 'home' && f.kind === 'home')).toBe(true);
	});
});
