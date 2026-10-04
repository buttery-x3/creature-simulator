import { validateLifecycleConfig } from '../lifecycle';
import type { SimulationConfig } from '../types';

export class SimulationCreationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SimulationCreationError';
	}
}

export function validateSimulationConfig(config: SimulationConfig): void {
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
		'exploreBaseline',
		'signalBaseline',
		'signalRecencyBoostMax',
		'announceBaseline',
		'continuityBonus',
		'targetQualityVisible',
		'targetQualityRemembered',
		'targetQualitySearch',
		'explorationDistanceWeight',
		'explorationStalenessWeight',
		'explorationStalenessScaleSeconds',
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
	if (!(config.explorationCellSize > 0) || !Number.isFinite(config.explorationCellSize)) {
		throw new SimulationCreationError(
			`explorationCellSize must be > 0, received ${config.explorationCellSize}`
		);
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
	validateLearningAndResources(config);
	validateEcology(config);
	const lifeErrors = validateLifecycleConfig(config.lifecycle);
	if (lifeErrors.length) throw new SimulationCreationError(lifeErrors.join('; '));
	if (config.creatureCount > config.lifecycle.populationCap)
		throw new SimulationCreationError('creatureCount must not exceed lifecycle.populationCap');
}

function validateLearningAndResources(config: SimulationConfig): void {
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

function validateEcology(config: SimulationConfig): void {
	for (const [key, value] of Object.entries(config.ecology)) {
		if (!Number.isFinite(value) || value < 0)
			throw new SimulationCreationError(`ecology.${key} must be finite and non-negative`);
	}
	for (const key of ['wildlifeCount', 'encounterHistoryLimit'] as const) {
		if (!Number.isInteger(config.ecology[key]))
			throw new SimulationCreationError(`ecology.${key} must be an integer`);
	}
	if (config.ecology.dayLengthSeconds <= 0 || config.ecology.attackCooldownSeconds <= 0) {
		throw new SimulationCreationError('ecology day length and attack cooldown must be positive');
	}
	if (config.ecology.encounterHistoryLimit < 1) {
		throw new SimulationCreationError('ecology.encounterHistoryLimit must be a positive integer');
	}
}
