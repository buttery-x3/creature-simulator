import type { Habitat, HabitatFeature } from './types';
import { isResourceFeature } from './types';

function formatFeature(feature: HabitatFeature): string {
	const { id, kind, position, size } = feature;
	const base =
		`${id} (${kind}): centre=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`size=${size.width.toFixed(3)}×${size.height.toFixed(3)}`;
	if (isResourceFeature(feature)) {
		return `${base} amount=${feature.amount.toFixed(3)}/${feature.capacity.toFixed(3)}`;
	}
	return base;
}

/**
 * Lightweight structured diagnostic text for comparing authoritative habitat
 * data with the rendered scene.
 */
export function formatHabitatDiagnostics(habitat: Habitat): string {
	const lines: string[] = [
		`seed: ${habitat.seed}`,
		`world bounds: ${habitat.bounds.width} × ${habitat.bounds.height} (centred on origin)`,
		`home: 1`,
		`water: ${habitat.water.length}`,
		`food: ${habitat.food.length}`,
		'',
		'features:',
		`  ${formatFeature(habitat.home)}`
	];

	for (const feature of habitat.water) {
		lines.push(`  ${formatFeature(feature)}`);
	}
	for (const feature of habitat.food) {
		lines.push(`  ${formatFeature(feature)}`);
	}

	return lines.join('\n');
}

/** Machine-readable diagnostic object for logging or UI panels. */
export function habitatDiagnosticRecord(habitat: Habitat) {
	const features = [habitat.home, ...habitat.water, ...habitat.food].map((feature) => {
		const base = {
			id: feature.id,
			kind: feature.kind,
			position: { ...feature.position },
			size: { ...feature.size }
		};
		if (isResourceFeature(feature)) {
			return {
				...base,
				amount: feature.amount,
				capacity: feature.capacity,
				available: feature.amount > 0
			};
		}
		return base;
	});

	return {
		seed: habitat.seed,
		bounds: { ...habitat.bounds },
		counts: {
			home: 1,
			water: habitat.water.length,
			food: habitat.food.length,
			availableFood: habitat.food.filter((f) => f.amount > 0).length,
			availableWater: habitat.water.filter((f) => f.amount > 0).length
		},
		features
	};
}
