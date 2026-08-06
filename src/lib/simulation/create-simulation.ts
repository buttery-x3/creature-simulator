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
import { applyDecision } from './behaviour/actions';
import { commitDecision } from './behaviour/decisions';
import { emptyPerception } from './behaviour/perception';
import { pointTarget } from './behaviour/resource-awareness';
import { selectPreferredSymbol } from './communication/emission';
import { DEFAULT_SYMBOL_INVENTORY } from './communication/types';
import { sampleSearchTarget, sampleWanderTarget } from './creature-movement';
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
	arrivalDistance: 0.35,

	// Needs: observable over a practical run without constant eating/sleeping.
	hungerRisePerSecond: 0.012,
	thirstRisePerSecond: 0.014,
	energyDrainPerSecond: 0.008,
	eatRecoveryPerSecond: 0.25,
	drinkRecoveryPerSecond: 0.28,
	sleepRecoveryPerSecond: 0.2,

	seekFoodThreshold: 0.45,
	seekWaterThreshold: 0.45,
	restThreshold: 0.4,

	goalSwitchMargin: 0.12,
	minGoalCommitmentSeconds: 2.5,
	reconsiderIntervalSeconds: 1.5,

	eatUntilHunger: 0.12,
	drinkUntilThirst: 0.12,
	sleepUntilEnergy: 0.9,

	decisionHistoryLimit: 10,

	// Local sensing: small enough that creatures must search on a 20×20 world.
	sensingRadius: 3,
	perceptionIntervalSeconds: 0.25,
	trackedObservationDurationSeconds: 4,

	// Communication: arbitrary symbols, short-lived local emissions.
	symbolInventory: DEFAULT_SYMBOL_INVENTORY,
	hearingRadius: 4,
	signalLifetimeSeconds: 1.5,
	emissionCooldownSeconds: 4,
	recentEmittedHistoryLimit: 8,
	recentHeardHistoryLimit: 8,
	recentSimulationEmissionHistoryLimit: 16,

	initialHunger: 0.2,
	initialThirst: 0.2,
	initialEnergy: 0.85
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

	const rateFields: (keyof SimulationConfig)[] = [
		'hungerRisePerSecond',
		'thirstRisePerSecond',
		'energyDrainPerSecond',
		'eatRecoveryPerSecond',
		'drinkRecoveryPerSecond',
		'sleepRecoveryPerSecond',
		'seekFoodThreshold',
		'seekWaterThreshold',
		'restThreshold',
		'goalSwitchMargin',
		'minGoalCommitmentSeconds',
		'reconsiderIntervalSeconds',
		'eatUntilHunger',
		'drinkUntilThirst',
		'sleepUntilEnergy',
		'sensingRadius',
		'perceptionIntervalSeconds',
		'trackedObservationDurationSeconds',
		'hearingRadius',
		'signalLifetimeSeconds',
		'emissionCooldownSeconds'
	];
	for (const key of rateFields) {
		const value = config[key];
		if (typeof value !== 'number' || !(value >= 0) || !Number.isFinite(value)) {
			throw new SimulationCreationError(`${key} must be a finite number >= 0, received ${value}`);
		}
	}
	if (!(config.sensingRadius > 0)) {
		throw new SimulationCreationError(
			`sensingRadius must be > 0, received ${config.sensingRadius}`
		);
	}
	if (!(config.perceptionIntervalSeconds > 0)) {
		throw new SimulationCreationError(
			`perceptionIntervalSeconds must be > 0, received ${config.perceptionIntervalSeconds}`
		);
	}
	if (!(config.hearingRadius > 0)) {
		throw new SimulationCreationError(
			`hearingRadius must be > 0, received ${config.hearingRadius}`
		);
	}
	if (!(config.signalLifetimeSeconds > 0)) {
		throw new SimulationCreationError(
			`signalLifetimeSeconds must be > 0, received ${config.signalLifetimeSeconds}`
		);
	}
	if (!Number.isInteger(config.decisionHistoryLimit) || config.decisionHistoryLimit < 1) {
		throw new SimulationCreationError(
			`decisionHistoryLimit must be a positive integer, received ${config.decisionHistoryLimit}`
		);
	}
	if (!config.symbolInventory || config.symbolInventory.length === 0) {
		throw new SimulationCreationError('symbolInventory must be a non-empty array');
	}
	for (const key of [
		'recentEmittedHistoryLimit',
		'recentHeardHistoryLimit',
		'recentSimulationEmissionHistoryLimit'
	] as const) {
		const value = config[key];
		if (!Number.isInteger(value) || value < 1) {
			throw new SimulationCreationError(`${key} must be a positive integer, received ${value}`);
		}
	}
	for (const key of ['initialHunger', 'initialThirst', 'initialEnergy'] as const) {
		const value = config[key];
		if (!(value >= 0 && value <= 1) || !Number.isFinite(value)) {
			throw new SimulationCreationError(`${key} must be in [0, 1], received ${value}`);
		}
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
		const searchDecisionIndex = 0;
		const searchTarget = sampleSearchTarget(
			config.seed,
			id,
			searchDecisionIndex,
			habitat.bounds,
			config.creatureRadius
		);

		const preferredSymbolId = selectPreferredSymbol(config.seed, id, config.symbolInventory);

		const draft: Creature = {
			id,
			position,
			facing,
			movementSpeed,
			wanderTarget,
			wanderDecisionIndex,
			searchTarget,
			searchDecisionIndex,
			perception: emptyPerception(),
			hunger: config.initialHunger,
			thirst: config.initialThirst,
			energy: config.initialEnergy,
			goal: 'wander',
			action: 'wander',
			target: pointTarget(wanderTarget),
			goalStartedAt: 0,
			actionStartedAt: 0,
			nextReconsiderAt: 0,
			lastDecision: null,
			lastCandidates: [],
			recentTransitions: [],
			preferredSymbolId,
			emissionCount: 0,
			lastEmissionAt: -1,
			recentEmitted: [],
			recentHeard: []
		};

		const decision = commitDecision({
			creature: draft,
			habitat,
			timeSeconds: 0,
			trigger: 'initial',
			config
		});
		const applied = applyDecision(draft, decision, false, config);

		creatures.push({
			...draft,
			...applied,
			target:
				applied.goal === 'wander'
					? pointTarget(wanderTarget)
					: (applied.target ?? pointTarget(wanderTarget)),
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
		creatures,
		activeEmissions: [],
		recentEmissions: []
	};
}

/** Stable snapshot for equality checks. */
export function simulationSnapshot(state: SimulationState): string {
	return JSON.stringify(state);
}
