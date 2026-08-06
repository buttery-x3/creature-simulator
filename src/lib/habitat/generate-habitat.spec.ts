import { describe, expect, it } from 'vitest';
import { featureRect, featuresViolateSpacing, rectInsideBounds } from './geometry';
import {
	DEFAULT_HABITAT_CONFIG,
	HabitatGenerationError,
	defaultHabitatConfig,
	generateHabitat,
	habitatSnapshot
} from './generate-habitat';
import type { Habitat, HabitatFeature, HabitatGenerationConfig } from './types';

function snapshotDefaults() {
	return JSON.parse(JSON.stringify(DEFAULT_HABITAT_CONFIG)) as typeof DEFAULT_HABITAT_CONFIG;
}

function allFeatures(habitat: Habitat): HabitatFeature[] {
	return [habitat.home, ...habitat.water, ...habitat.food];
}

function assertValidLayout(habitat: Habitat, config: HabitatGenerationConfig): void {
	const features = allFeatures(habitat);
	expect(habitat.food).toHaveLength(config.foodCount);
	expect(habitat.water).toHaveLength(config.waterCount);
	expect(habitat.home.kind).toBe('home');
	expect(habitat.home.id).toBe('home');

	for (const feature of features) {
		expect(rectInsideBounds(featureRect(feature), habitat.bounds)).toBe(true);
	}

	for (let i = 0; i < features.length; i += 1) {
		for (let j = i + 1; j < features.length; j += 1) {
			expect(featuresViolateSpacing(features[i]!, features[j]!, config.minSpacing)).toBe(false);
		}
	}

	// Home must not be overlapped by food or water (covered by spacing, restate intent).
	for (const other of [...habitat.food, ...habitat.water]) {
		expect(featuresViolateSpacing(habitat.home, other, config.minSpacing)).toBe(false);
	}
}

describe('generateHabitat', () => {
	it('produces identical habitat data for the same seed and configuration', () => {
		const config = defaultHabitatConfig('repeatable-seed');
		const a = generateHabitat(config);
		const b = generateHabitat(config);
		expect(habitatSnapshot(a)).toBe(habitatSnapshot(b));
	});

	it('normally produces different layouts for different seeds', () => {
		const base = defaultHabitatConfig('seed-a');
		const a = generateHabitat(base);
		const b = generateHabitat({ ...base, seed: 'seed-b' });
		expect(habitatSnapshot(a)).not.toBe(habitatSnapshot(b));
	});

	it('keeps all features inside world bounds and respects spacing', () => {
		const config = defaultHabitatConfig('bounds-check');
		const habitat = generateHabitat(config);
		assertValidLayout(habitat, config);
	});

	it('produces the requested food and water counts', () => {
		const config: HabitatGenerationConfig = {
			...defaultHabitatConfig('counts'),
			foodCount: 4,
			waterCount: 3
		};
		const habitat = generateHabitat(config);
		expect(habitat.food).toHaveLength(4);
		expect(habitat.water).toHaveLength(3);
		expect(habitat.food.map((f) => f.id)).toEqual(['food-0', 'food-1', 'food-2', 'food-3']);
		expect(habitat.water.map((f) => f.id)).toEqual(['water-0', 'water-1', 'water-2']);
	});

	it('regeneration with the same seed restores the same habitat', () => {
		const config = defaultHabitatConfig('regen');
		const first = generateHabitat(config);
		const regenerated = generateHabitat({ ...config, seed: first.seed });
		expect(habitatSnapshot(regenerated)).toBe(habitatSnapshot(first));
	});

	it('fails clearly for impossible configurations after bounded attempts', () => {
		const config: HabitatGenerationConfig = {
			...defaultHabitatConfig('impossible'),
			worldWidth: 4,
			worldHeight: 4,
			foodCount: 20,
			waterCount: 10,
			homeSize: {
				minWidth: 2,
				maxWidth: 2,
				minHeight: 2,
				maxHeight: 2
			},
			foodSize: {
				minWidth: 1.5,
				maxWidth: 1.5,
				minHeight: 1.5,
				maxHeight: 1.5
			},
			waterSize: {
				minWidth: 1.5,
				maxWidth: 1.5,
				minHeight: 1.5,
				maxHeight: 1.5
			},
			minSpacing: 1,
			maxPlacementAttempts: 10
		};

		expect(() => generateHabitat(config)).toThrow(HabitatGenerationError);
		expect(() => generateHabitat(config)).toThrow(
			/Failed to place|cannot fit|Configuration may be impossible/i
		);
	});

	it('rejects invalid configuration values', () => {
		expect(() => generateHabitat(defaultHabitatConfig(''))).toThrow(/seed/i);
		expect(() => generateHabitat({ ...defaultHabitatConfig('x'), worldWidth: 0 })).toThrow(
			/world dimensions/i
		);
		expect(() => generateHabitat({ ...defaultHabitatConfig('x'), foodCount: -1 })).toThrow(
			/foodCount/i
		);
	});

	it('serialises as plain JSON (no Three.js types)', () => {
		const habitat = generateHabitat(defaultHabitatConfig('json'));
		const roundTrip = JSON.parse(JSON.stringify(habitat)) as Habitat;
		expect(roundTrip).toEqual(habitat);
	});
});

describe('createSeededRng via generation', () => {
	it('does not rely on Math.random for generation determinism', () => {
		const original = Math.random;
		let calls = 0;
		Math.random = () => {
			calls += 1;
			return 0.42;
		};
		try {
			const config = defaultHabitatConfig('no-math-random');
			const a = generateHabitat(config);
			const b = generateHabitat(config);
			expect(habitatSnapshot(a)).toBe(habitatSnapshot(b));
			// Generation path must not call Math.random.
			expect(calls).toBe(0);
		} finally {
			Math.random = original;
		}
	});
});

describe('defaultHabitatConfig', () => {
	it('returns independent nested size ranges that do not share mutation', () => {
		const before = snapshotDefaults();
		const a = defaultHabitatConfig('a');
		const b = defaultHabitatConfig('b');

		a.homeSize.minWidth = 99;
		a.foodSize.maxHeight = 99;
		a.waterSize.minHeight = 99;
		a.foodCount = 99;

		expect(b.homeSize.minWidth).toBe(before.homeSize.minWidth);
		expect(b.foodSize.maxHeight).toBe(before.foodSize.maxHeight);
		expect(b.waterSize.minHeight).toBe(before.waterSize.minHeight);
		expect(b.foodCount).toBe(before.foodCount);

		expect(DEFAULT_HABITAT_CONFIG).toEqual(before);
		expect(DEFAULT_HABITAT_CONFIG.homeSize.minWidth).not.toBe(99);
		expect(DEFAULT_HABITAT_CONFIG.foodSize.maxHeight).not.toBe(99);
		expect(DEFAULT_HABITAT_CONFIG.waterSize.minHeight).not.toBe(99);
	});
});
