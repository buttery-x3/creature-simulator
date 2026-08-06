import type { Habitat, HabitatFeature } from './types';

function formatFeature(feature: HabitatFeature): string {
	const { id, kind, position, size } = feature;
	return (
		`${id} (${kind}): centre=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`size=${size.width.toFixed(3)}×${size.height.toFixed(3)}`
	);
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
	const features = [habitat.home, ...habitat.water, ...habitat.food].map((feature) => ({
		id: feature.id,
		kind: feature.kind,
		position: { ...feature.position },
		size: { ...feature.size }
	}));

	return {
		seed: habitat.seed,
		bounds: { ...habitat.bounds },
		counts: {
			home: 1,
			water: habitat.water.length,
			food: habitat.food.length
		},
		features
	};
}
