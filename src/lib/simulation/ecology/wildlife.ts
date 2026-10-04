import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Habitat, Vec2 } from '$lib/habitat';
import type { Creature } from '../types';
import { bodyAbility } from './body';
import type { EcologyConfig, Wildlife } from './types';

export function createWildlife(seed: string, habitat: Habitat, config: EcologyConfig): Wildlife[] {
	const rng = createSeededRng(deriveSeed(seed, 'wildlife'));
	return Array.from({ length: config.wildlifeCount }, (_, index) => ({
		id: `wildlife-${index}`,
		position: {
			x: rng.nextRange(-habitat.bounds.width / 2 + 0.5, habitat.bounds.width / 2 - 0.5),
			y: rng.nextRange(-habitat.bounds.height / 2 + 0.5, habitat.bounds.height / 2 - 0.5)
		},
		facing: rng.nextRange(-Math.PI, Math.PI),
		size: rng.nextRange(0.45, 1.65),
		physicality: rng.nextRange(0.55, 1.4),
		health: 1,
		energy: rng.nextRange(0.5, 0.95),
		foodAmount: 0,
		nextAttackAt: 0,
		patrolPhase: rng.nextRange(0, Math.PI * 2),
		mode: 'roam' as const
	}));
}

function nearestCreature(animal: Wildlife, creatures: readonly Creature[], radius: number) {
	let nearest: Creature | undefined;
	let nearestDistance = radius;
	for (const creature of creatures) {
		const distance = Math.hypot(
			creature.position.x - animal.position.x,
			creature.position.y - animal.position.y
		);
		if (
			distance < nearestDistance ||
			(distance === nearestDistance && creature.id < (nearest?.id ?? '\uffff'))
		) {
			nearest = creature;
			nearestDistance = distance;
		}
	}
	return nearest;
}

function boundedMove(position: Vec2, facing: number, distance: number, habitat: Habitat): Vec2 {
	const halfWidth = Math.max(0, habitat.bounds.width / 2 - 0.25);
	const halfHeight = Math.max(0, habitat.bounds.height / 2 - 0.25);
	return {
		x: Math.max(-halfWidth, Math.min(halfWidth, position.x + Math.cos(facing) * distance)),
		y: Math.max(-halfHeight, Math.min(halfHeight, position.y + Math.sin(facing) * distance))
	};
}

function stepAnimal(
	animal: Wildlife,
	creatures: readonly Creature[],
	habitat: Habitat,
	time: number,
	dt: number,
	config: EcologyConfig
): Wildlife {
	if (animal.health <= 0) {
		return {
			...animal,
			mode: 'carcass',
			foodAmount: Math.max(0, animal.foodAmount - config.carcassDecayPerSecond * dt)
		};
	}
	const neighbour = nearestCreature(animal, creatures, config.wildlifeSensingRadius);
	const ability = bodyAbility(animal, animal.energy);
	const otherAbility = neighbour ? bodyAbility(neighbour.body, neighbour.energy) : 0;
	const threatened = neighbour && (ability < otherAbility * 1.1 || animal.health < 0.4);
	const approaching = neighbour && !threatened && animal.energy < 0.6;
	const mode = threatened ? 'avoid' : approaching ? 'approach' : 'roam';
	// Patrol bends over time, with a centreward tendency near the finite world edge.
	const nearEdge =
		Math.abs(animal.position.x) > habitat.bounds.width / 2 - 1 ||
		Math.abs(animal.position.y) > habitat.bounds.height / 2 - 1;
	let facing = nearEdge
		? Math.atan2(-animal.position.y, -animal.position.x)
		: animal.facing + Math.sin(time * 0.23 + animal.patrolPhase) * dt * 0.7;
	if (neighbour && mode !== 'roam') {
		facing =
			Math.atan2(
				neighbour.position.y - animal.position.y,
				neighbour.position.x - animal.position.x
			) + (mode === 'avoid' ? Math.PI : 0);
	}
	const resting = mode === 'roam' && animal.energy < 0.3;
	const speed = config.wildlifeSpeed * (0.4 + 0.6 * animal.health) * (mode === 'avoid' ? 1.3 : 1);
	const position = boundedMove(animal.position, facing, resting ? 0 : speed * dt, habitat);
	const distance = Math.hypot(position.x - animal.position.x, position.y - animal.position.y);
	const energyChange = resting
		? config.wildlifeRestRecoveryPerSecond
		: -config.wildlifeEnergyDrainPerSecond;
	return {
		...animal,
		position,
		facing,
		mode,
		energy: Math.max(
			0,
			Math.min(1, animal.energy + energyChange * dt - distance * config.movementEnergyCostPerUnit)
		)
	};
}

export function stepWildlife(
	wildlife: readonly Wildlife[],
	creatures: readonly Creature[],
	habitat: Habitat,
	time: number,
	dt: number,
	config: EcologyConfig
): Wildlife[] {
	return wildlife
		.map((animal) => stepAnimal(animal, creatures, habitat, time, dt, config))
		.filter((animal) => animal.health > 0 || animal.foodAmount > 0);
}
