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
import { replanFromArbitration } from './behaviour/apply-arbitration';
import { emptyPerception } from './behaviour/perception';
import { pointTarget } from './behaviour/resource-awareness';
import { DEFAULT_COGNITION_CONFIG } from './cognition/score-constants';
import { selectPreferredSymbol } from './communication/emission';
import { DEFAULT_SYMBOL_INVENTORY } from './communication/types';
import { sampleSearchTarget, sampleWanderTarget } from './creature-movement';
import { emptyLexicon } from './learning/lexicon-resolution';
import { createEmptyAssociations } from './learning/signal-associations';
import { createEmptyMemory, sampleMemoryCapacity } from './memory/create-memory';
import { createInitialEnvironment } from './resources';
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
		maxPlacementAttempts: DEFAULT_HABITAT_CONFIG.maxPlacementAttempts,
		foodCapacity: DEFAULT_HABITAT_CONFIG.foodCapacity,
		waterCapacity: DEFAULT_HABITAT_CONFIG.waterCapacity
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

	seekFoodThreshold: DEFAULT_COGNITION_CONFIG.seekFoodThreshold,
	seekWaterThreshold: DEFAULT_COGNITION_CONFIG.seekWaterThreshold,
	restThreshold: DEFAULT_COGNITION_CONFIG.restThreshold,

	wanderBaseline: DEFAULT_COGNITION_CONFIG.wanderBaseline,
	signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
	signalRecencyBoostMax: DEFAULT_COGNITION_CONFIG.signalRecencyBoostMax,
	announceBaseline: DEFAULT_COGNITION_CONFIG.announceBaseline,
	continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus,
	targetQualityVisible: DEFAULT_COGNITION_CONFIG.targetQualityVisible,
	targetQualityRemembered: DEFAULT_COGNITION_CONFIG.targetQualityRemembered,
	targetQualitySearch: DEFAULT_COGNITION_CONFIG.targetQualitySearch,

	reconsiderIntervalSeconds: 1.5,

	eatUntilHunger: 0.12,
	drinkUntilThirst: 0.12,
	sleepUntilEnergy: 0.9,

	decisionHistoryLimit: 10,

	// Local sensing: small enough that creatures must search on a 20×20 world.
	sensingRadius: 3,
	perceptionIntervalSeconds: 0.25,

	// Resource announcement: kind-level clarity + speaking position (executor).
	resourceAnnouncementClarityMargin: 0.75,
	speakingPositionSearchRadius: 2.5,
	speakingPositionSearchResolution: 3,
	recentAnnouncementOutcomeHistoryLimit: 8,

	// Communication: arbitrary symbols, short-lived local emissions.
	// hearingRadius 12 is a practical finite default for the 20×20 habitat so
	// announcements reach a meaningful share of the population without being global.
	symbolInventory: DEFAULT_SYMBOL_INVENTORY,
	hearingRadius: 12,
	signalLifetimeSeconds: 1.5,
	emissionCooldownSeconds: 4,
	recentEmittedHistoryLimit: 8,
	recentHeardHistoryLimit: 8,
	recentSimulationEmissionHistoryLimit: 24,
	// Population diagnostics only — does not affect selection behaviour.
	recentEmissionDiagnosticsWindowSeconds: 30,

	// Learning: personal evidence + exclusive lexicon + signal investigation.
	// Memory: large enough for the small habitat not to churn every announcement,
	// while still proving bounded capacity (not intelligence-derived).
	memoryCapacityRange: { min: 8, max: 16 },
	// Presentation-only signal-ring falloff scale (not decision motivation).
	investigationDistanceScale: 8,
	learningEvidenceRadius: 3,
	associationReinforcement: 0.25,
	noEvidenceConfidenceReduction: 0,
	learningHistoryLimit: 8,
	associationStrengthMin: 0,
	associationStrengthMax: 1,
	// Exclusive lexicon: one investigation at default reinforcement (0.25) clears the strength gate.
	lexiconAssignmentMinStrength: 0.15,
	lexiconAssignmentMinEvidenceCount: 1,
	lexiconHistoryLimit: 12,

	initialHunger: 0.2,
	initialThirst: 0.2,
	initialEnergy: 0.85,

	// Finite renewable resources + rain (FLAME-77).
	// Food is scarcer/more volatile; water is more abundant but can dry between rains.
	maxActiveFoodSources: 5,
	// Spawn cadence visible over a practical run without flooding the map.
	foodSpawnIntervalSeconds: 18,
	// Rain every ~45–75s of sim time; brief visible rain window.
	rainIntervalMinSeconds: 45,
	rainIntervalMaxSeconds: 75,
	rainDurationSeconds: 4
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
		movementSpeed: { ...DEFAULT_SIMULATION_CONFIG.movementSpeed },
		memoryCapacityRange: { ...DEFAULT_SIMULATION_CONFIG.memoryCapacityRange }
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
		'wanderBaseline',
		'signalBaseline',
		'signalRecencyBoostMax',
		'announceBaseline',
		'continuityBonus',
		'targetQualityVisible',
		'targetQualityRemembered',
		'targetQualitySearch',
		'reconsiderIntervalSeconds',
		'eatUntilHunger',
		'drinkUntilThirst',
		'sleepUntilEnergy',
		'sensingRadius',
		'perceptionIntervalSeconds',
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
		'recentSimulationEmissionHistoryLimit',
		'learningHistoryLimit',
		'lexiconHistoryLimit',
		'lexiconAssignmentMinEvidenceCount',
		'recentAnnouncementOutcomeHistoryLimit',
		'speakingPositionSearchResolution'
	] as const) {
		const value = config[key];
		if (!Number.isInteger(value) || value < 1) {
			throw new SimulationCreationError(`${key} must be a positive integer, received ${value}`);
		}
	}
	for (const key of [
		'learningEvidenceRadius',
		'investigationDistanceScale',
		'associationReinforcement',
		'noEvidenceConfidenceReduction',
		'recentEmissionDiagnosticsWindowSeconds',
		'lexiconAssignmentMinStrength',
		'resourceAnnouncementClarityMargin',
		'speakingPositionSearchRadius'
	] as const) {
		const value = config[key];
		if (typeof value !== 'number' || !(value >= 0) || !Number.isFinite(value)) {
			throw new SimulationCreationError(`${key} must be a finite number >= 0, received ${value}`);
		}
	}
	if (!(config.recentEmissionDiagnosticsWindowSeconds > 0)) {
		throw new SimulationCreationError(
			`recentEmissionDiagnosticsWindowSeconds must be > 0, received ${config.recentEmissionDiagnosticsWindowSeconds}`
		);
	}
	if (!(config.speakingPositionSearchRadius > 0)) {
		throw new SimulationCreationError(
			`speakingPositionSearchRadius must be > 0, received ${config.speakingPositionSearchRadius}`
		);
	}
	if (!(config.investigationDistanceScale > 0)) {
		throw new SimulationCreationError(
			`investigationDistanceScale must be > 0, received ${config.investigationDistanceScale}`
		);
	}
	if (
		!config.memoryCapacityRange ||
		!Number.isInteger(config.memoryCapacityRange.min) ||
		!Number.isInteger(config.memoryCapacityRange.max) ||
		config.memoryCapacityRange.min < 1 ||
		config.memoryCapacityRange.max < config.memoryCapacityRange.min
	) {
		throw new SimulationCreationError(
			'memoryCapacityRange.min/max must be integers with 1 <= min <= max'
		);
	}
	if (
		!(config.associationStrengthMin < config.associationStrengthMax) ||
		!Number.isFinite(config.associationStrengthMin) ||
		!Number.isFinite(config.associationStrengthMax)
	) {
		throw new SimulationCreationError(
			'associationStrengthMin must be < associationStrengthMax and both finite'
		);
	}
	for (const key of ['initialHunger', 'initialThirst', 'initialEnergy'] as const) {
		const value = config[key];
		if (!(value >= 0 && value <= 1) || !Number.isFinite(value)) {
			throw new SimulationCreationError(`${key} must be in [0, 1], received ${value}`);
		}
	}

	if (!Number.isInteger(config.maxActiveFoodSources) || config.maxActiveFoodSources < 0) {
		throw new SimulationCreationError(
			`maxActiveFoodSources must be a non-negative integer, received ${config.maxActiveFoodSources}`
		);
	}
	for (const key of [
		'foodSpawnIntervalSeconds',
		'rainIntervalMinSeconds',
		'rainIntervalMaxSeconds',
		'rainDurationSeconds'
	] as const) {
		const value = config[key];
		if (typeof value !== 'number' || !(value > 0) || !Number.isFinite(value)) {
			throw new SimulationCreationError(`${key} must be a finite number > 0, received ${value}`);
		}
	}
	if (config.rainIntervalMaxSeconds < config.rainIntervalMinSeconds) {
		throw new SimulationCreationError(
			`rainIntervalMaxSeconds must be >= rainIntervalMinSeconds, received [${config.rainIntervalMinSeconds}, ${config.rainIntervalMaxSeconds}]`
		);
	}
	if (!(config.habitat.foodCapacity > 0) || !Number.isFinite(config.habitat.foodCapacity)) {
		throw new SimulationCreationError(
			`habitat.foodCapacity must be a finite number > 0, received ${config.habitat.foodCapacity}`
		);
	}
	if (!(config.habitat.waterCapacity > 0) || !Number.isFinite(config.habitat.waterCapacity)) {
		throw new SimulationCreationError(
			`habitat.waterCapacity must be a finite number > 0, received ${config.habitat.waterCapacity}`
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

/** Seed channel for independent per-creature speech-preference sampling. */
export const VERBOSITY_CHANNEL = 'verbosity';

/**
 * Sample lifetime-stable verbosity in [0, 1) from an independent seeded stream.
 * Identical (seed, creatureId) always yields the same value; does not share the
 * creatures placement/speed stream.
 */
export function sampleVerbosity(simulationSeed: string, creatureId: string): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, VERBOSITY_CHANNEL, creatureId));
	return rng.next();
}

/** Seed channel for independent per-creature novelty / optional-information sampling. */
export const CURIOSITY_CHANNEL = 'curiosity';

/**
 * Sample lifetime-stable curiosity in [0, 1) from an independent seeded stream.
 * Identical (seed, creatureId) always yields the same value; independent of
 * verbosity and the creatures placement/speed stream.
 */
export function sampleCuriosity(simulationSeed: string, creatureId: string): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, CURIOSITY_CHANNEL, creatureId));
	return rng.next();
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
		const memoryCapacity = sampleMemoryCapacity(config.seed, id, config.memoryCapacityRange);
		const verbosity = sampleVerbosity(config.seed, id);
		const curiosity = sampleCuriosity(config.seed, id);

		const draft: Creature = {
			id,
			position,
			facing,
			movementSpeed,
			verbosity,
			curiosity,
			wanderTarget,
			wanderDecisionIndex,
			searchTarget,
			searchDecisionIndex,
			perception: emptyPerception(),
			hunger: config.initialHunger,
			thirst: config.initialThirst,
			energy: config.initialEnergy,
			// Independent memory object per creature — never share references.
			memory: createEmptyMemory(memoryCapacity),
			intention: 'wander',
			action: 'wander',
			target: pointTarget(wanderTarget),
			intentionStartedAt: 0,
			actionStartedAt: 0,
			nextReconsiderAt: 0,
			pendingArbitrationTrigger: null,
			lastArbitration: null,
			recentTransitions: [],
			preferredSymbolId,
			emissionCount: 0,
			lastEmissionAt: -1,
			recentEmitted: [],
			recentHeard: [],
			// Independent evidence array and lexicon per creature — never share references.
			symbolAssociations: createEmptyAssociations(config.symbolInventory),
			lexicon: emptyLexicon(),
			recentLexiconChanges: [],
			activeInvestigation: null,
			recentLearning: [],
			activeAnnouncementExecution: null,
			announcementExecutionCounter: 0,
			recentAnnouncementOutcomes: []
		};

		const initial = replanFromArbitration(draft, habitat, 0, 'initial', config, config.seed);

		creatures.push({
			...initial,
			target:
				initial.intention === 'wander'
					? pointTarget(wanderTarget)
					: (initial.target ?? pointTarget(wanderTarget)),
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
	const environment = createInitialEnvironment(config.seed, {
		rainIntervalMinSeconds: config.rainIntervalMinSeconds,
		rainIntervalMaxSeconds: config.rainIntervalMaxSeconds,
		rainDurationSeconds: config.rainDurationSeconds,
		foodSpawnIntervalSeconds: config.foodSpawnIntervalSeconds
	});

	return {
		seed: config.seed,
		timeSeconds: 0,
		habitat,
		environment,
		creatures,
		activeEmissions: [],
		recentEmissions: []
	};
}

/** Stable snapshot for equality checks. */
export function simulationSnapshot(state: SimulationState): string {
	return JSON.stringify(state);
}
