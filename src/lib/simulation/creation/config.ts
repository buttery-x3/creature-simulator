import { DEFAULT_HABITAT_CONFIG } from '$lib/habitat';
import { DEFAULT_COGNITION_CONFIG } from '../cognition/score-constants';
import { DEFAULT_SYMBOL_INVENTORY } from '../communication/types';
import { DEFAULT_EXPLORATION_CELL_SIZE } from '../exploration';
import { DEFAULT_ECOLOGY_CONFIG } from '../ecology';
import { DEFAULT_LIFECYCLE_CONFIG } from '../lifecycle';
import type { SimulationConfig } from '../types';

export const DEFAULT_SIMULATION_CONFIG: Omit<SimulationConfig, 'seed'> = {
	ecology: { ...DEFAULT_ECOLOGY_CONFIG },
	lifecycle: { ...DEFAULT_LIFECYCLE_CONFIG },
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

	exploreBaseline: DEFAULT_COGNITION_CONFIG.exploreBaseline,
	signalBaseline: DEFAULT_COGNITION_CONFIG.signalBaseline,
	signalRecencyBoostMax: DEFAULT_COGNITION_CONFIG.signalRecencyBoostMax,
	announceBaseline: DEFAULT_COGNITION_CONFIG.announceBaseline,
	continuityBonus: DEFAULT_COGNITION_CONFIG.continuityBonus,
	targetQualityVisible: DEFAULT_COGNITION_CONFIG.targetQualityVisible,
	targetQualityRemembered: DEFAULT_COGNITION_CONFIG.targetQualityRemembered,
	targetQualitySearch: DEFAULT_COGNITION_CONFIG.targetQualitySearch,

	explorationCellSize: DEFAULT_EXPLORATION_CELL_SIZE,
	explorationDistanceWeight: 1,
	explorationStalenessWeight: 1,
	explorationStalenessScaleSeconds: 30,

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
	foodSpawnIntervalSeconds: 14,
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
		ecology: { ...DEFAULT_SIMULATION_CONFIG.ecology },
		lifecycle: { ...DEFAULT_SIMULATION_CONFIG.lifecycle },
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
