/**
 * Deterministic simulation creation: habitat + initial creature population.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import {
	DEFAULT_HABITAT_CONFIG,
	featureRect,
	generateHabitat,
	type HabitatGenerationConfig
} from '$lib/habitat';
import { sampleWanderTarget } from './creature-movement';
import type { Creature, SimulationConfig, SimulationState } from './types';

export const DEFAULT_SIMULATION_CONFIG: Omit<SimulationConfig, 'seed'> = {
	habitat: {
		worldWidth: DEFAULT_HABITAT_CONFIG.worldWidth,
		worldHeight: DEFAULT_HABITAT_CONFIG.worldHeight,
		foodCount: DEFAULT_HABITAT_CONFIG.foodCount,
		waterCount: DEFAULT_HABITAT_CONFIG.waterCount,
		homeSize: { ...DEFAULT_HABITAT_CONFIG.homeSize },
		foodSize: { ...DEFAULT_HABITAT_CONFIG.foodSize },
		waterSize: { ...DEFAULT_HABITAT_CONFIG.waterSize },
		minSpacing: DEFAULT_HABITAT_CONFIG.minSpacing,
		maxPlacementAttempts: DEFAULT_HABITAT_CONFIG.maxPlacementAttempts
	},
	creatureCount: 12,
	movementSpeed: { min: 0.85, max: 1.35 },
	maxTurnRate: Math.PI, // 180°/s — visible gradual turns, not snaps
	creatureRadius: 0.25,
	fixedDt: 1 / 30,
	maxCatchUpSteps: 6,
	arrivalDistance: 0.35
};

/**
 * Independent simulation configuration. Nested habitat size ranges are cloned.
 */
export function defaultSimulationConfig(seed = 'demo'): SimulationConfig {
	const habitat = DEFAULT_SIMULATION_CONFIG.habitat;
	return {
		...DEFAULT_SIMULATION_CONFIG,
		seed,
		habitat: {
			...habitat,
			homeSize: { ...habitat.homeSize },
			foodSize: { ...habitat.foodSize },
			waterSize: { ...habitat.waterSize }
		},
		movementSpeed: { ...DEFAULT_SIMULATION_CONFIG.movementSpeed }
	};
}

export class SimulationCreationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SimulationCreationError';
	}
}

function validateSimulationConfig(config: SimulationConfig): void {
	if (config.seed.length === 0) {
		throw new SimulationCreationError('seed must be a non-empty string');
	}
	if (!Number.isInteger(config.creatureCount) || config.creatureCount < 0) {
		throw new SimulationCreationError(
			`creatureCount must be a non-negative integer, received ${config.creatureCount}`
		);
	}
	if (!(config.movementSpeed.max >= config.movementSpeed.min) || config.movementSpeed.min <= 0) {
		throw new SimulationCreationError(
			`movementSpeed range must be positive with max >= min, received [${config.movementSpeed.min}, ${config.movementSpeed.max}]`
		);
	}
	if (!(config.maxTurnRate > 0)) {
		throw new SimulationCreationError(`maxTurnRate must be > 0, received ${config.maxTurnRate}`);
	}
	if (!(config.creatureRadius >= 0)) {
		throw new SimulationCreationError(
			`creatureRadius must be >= 0, received ${config.creatureRadius}`
		);
	}
	if (!(config.fixedDt > 0)) {
		throw new SimulationCreationError(`fixedDt must be > 0, received ${config.fixedDt}`);
	}
	if (!Number.isInteger(config.maxCatchUpSteps) || config.maxCatchUpSteps < 1) {
		throw new SimulationCreationError(
			`maxCatchUpSteps must be a positive integer, received ${config.maxCatchUpSteps}`
		);
	}
	if (!(config.arrivalDistance > 0)) {
		throw new SimulationCreationError(
			`arrivalDistance must be > 0, received ${config.arrivalDistance}`
		);
	}
}

/**
 * Place a spawn centre inside the home footprint, inset by creatureRadius.
 */
function sampleHomeSpawn(
	home: { position: { x: number; y: number }; size: { width: number; height: number } },
	creatureRadius: number,
	nextRange: (min: number, max: number) => number
): { x: number; y: number } {
	const rect = featureRect(home);
	const minX = rect.minX + creatureRadius;
	const maxX = rect.maxX - creatureRadius;
	const minY = rect.minY + creatureRadius;
	const maxY = rect.maxY - creatureRadius;

	if (minX > maxX || minY > maxY) {
		throw new SimulationCreationError(
			`Home region ${home.size.width}×${home.size.height} is too small for creatureRadius ${creatureRadius}`
		);
	}

	return {
		x: nextRange(minX, maxX),
		y: nextRange(minY, maxY)
	};
}

function createCreatures(
	config: SimulationConfig,
	habitat: SimulationState['habitat']
): Creature[] {
	const rng = createSeededRng(deriveSeed(config.seed, 'creatures'));
	const creatures: Creature[] = [];

	for (let i = 0; i < config.creatureCount; i += 1) {
		const id = `creature-${i}`;
		const position = sampleHomeSpawn(habitat.home, config.creatureRadius, (min, max) =>
			rng.nextRange(min, max)
		);
		const facing = rng.nextRange(-Math.PI, Math.PI);
		const movementSpeed = rng.nextRange(config.movementSpeed.min, config.movementSpeed.max);
		const wanderDecisionIndex = 0;
		const wanderTarget = sampleWanderTarget(
			config.seed,
			id,
			wanderDecisionIndex,
			habitat.bounds,
			config.creatureRadius
		);

		creatures.push({
			id,
			position,
			facing,
			movementSpeed,
			wanderTarget,
			wanderDecisionIndex
		});
	}

	return creatures;
}

/**
 * Create a full simulation: deterministic habitat (raw seed) and creatures
 * (derived 'creatures' stream). Same seed and config always match.
 */
export function createSimulation(config: SimulationConfig): SimulationState {
	validateSimulationConfig(config);

	const habitatConfig: HabitatGenerationConfig = {
		...config.habitat,
		seed: config.seed,
		homeSize: { ...config.habitat.homeSize },
		foodSize: { ...config.habitat.foodSize },
		waterSize: { ...config.habitat.waterSize }
	};

	const habitat = generateHabitat(habitatConfig);
	const creatures = createCreatures(config, habitat);

	return {
		seed: config.seed,
		timeSeconds: 0,
		habitat,
		creatures
	};
}

/** Stable snapshot for equality checks. */
export function simulationSnapshot(state: SimulationState): string {
	return JSON.stringify(state);
}
