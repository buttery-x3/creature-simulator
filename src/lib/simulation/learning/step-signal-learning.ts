/**
 * Fixed-step learning advance hooks: mid-behaviour evidence and post-reception pending insert.
 *
 * Ordering (see step-simulation):
 * - Mid-step (during behaviour, after perception): expire pending, process active investigation evidence,
 *   complete expired investigations.
 * - Post-reception: convert newly heard signals (heardAt === timeSeconds) into pending candidates.
 */

import type { Creature, SimulationConfig } from '../types';
import {
	applyNoEvidenceReduction,
	findAssociation,
	reinforceAssociation
} from './signal-associations';
import {
	appendLearningHistory,
	expirePendingSignals,
	insertPendingFromHeard,
	isNearOrigin,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin
} from './signal-investigation';
import type { LearningHistoryEntry, LearningOutcome } from './types';

export type LearningStepConfig = Pick<
	SimulationConfig,
	| 'pendingSignalLifetimeSeconds'
	| 'maxPendingSignalsPerCreature'
	| 'investigationDurationSeconds'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'arrivalDistance'
>;

function snapshotStrengths(
	creature: Creature,
	symbolId: Creature['symbolAssociations'][number]['symbolId']
): { food: number; water: number } {
	const assoc = findAssociation(creature.symbolAssociations, symbolId);
	return {
		food: assoc?.foodStrength ?? 0,
		water: assoc?.waterStrength ?? 0
	};
}

function completeInvestigation(
	creature: Creature,
	timeSeconds: number,
	outcome: LearningOutcome,
	reason: string,
	config: LearningStepConfig,
	options?: { applyNoEvidenceReduction?: boolean }
): Creature {
	const active = creature.activeInvestigation;
	if (!active) {
		return creature;
	}

	const before = snapshotStrengths(creature, active.symbolId);
	let associations = creature.symbolAssociations;
	let foodAfter = before.food;
	let waterAfter = before.water;

	if (options?.applyNoEvidenceReduction && config.noEvidenceConfidenceReduction > 0) {
		const reduced = applyNoEvidenceReduction(
			associations,
			active.symbolId,
			config.noEvidenceConfidenceReduction,
			config
		);
		associations = reduced.associations;
		foodAfter = reduced.foodStrengthAfter;
		waterAfter = reduced.waterStrengthAfter;
	}

	const entry: LearningHistoryEntry = {
		timeSeconds,
		outcome,
		symbolId: active.symbolId,
		emissionId: active.emissionId,
		reason,
		foodStrengthBefore: before.food,
		foodStrengthAfter: foodAfter,
		waterStrengthBefore: before.water,
		waterStrengthAfter: waterAfter
	};

	return {
		...creature,
		symbolAssociations: associations,
		activeInvestigation: null,
		recentLearning: appendLearningHistory(
			creature.recentLearning,
			entry,
			config.learningHistoryLimit
		)
	};
}

/**
 * After perception: expire pending, apply investigation evidence, complete expired investigations.
 * Does not change goal/action — caller handles interrupts when goal switches.
 */
export function advanceActiveLearning(
	creature: Creature,
	timeSeconds: number,
	config: LearningStepConfig
): Creature {
	let next: Creature = {
		...creature,
		pendingSignals: expirePendingSignals(creature.pendingSignals, timeSeconds)
	};

	const active = next.activeInvestigation;
	if (!active) {
		return next;
	}

	// Mark arrival for diagnostics / optional evidence window.
	if (!active.arrived && isNearOrigin(next.position, active.origin, config.arrivalDistance)) {
		next = {
			...next,
			activeInvestigation: { ...active, arrived: true }
		};
	}

	const current = next.activeInvestigation!;
	const evidence = qualifyEvidenceNearOrigin(next.perception, current.origin, config);

	const applyFood = evidence.food && !current.foodEvidenceApplied;
	const applyWater = evidence.water && !current.waterEvidenceApplied;

	if (applyFood || applyWater) {
		const reinforced = reinforceAssociation(
			next.symbolAssociations,
			current.symbolId,
			{
				reinforceFood: applyFood,
				reinforceWater: applyWater,
				amount: config.associationReinforcement
			},
			config
		);

		const outcome = outcomeFromEvidenceFlags(
			current.foodEvidenceApplied || applyFood,
			current.waterEvidenceApplied || applyWater
		);

		const evidenceBits: string[] = [];
		if (applyFood) {
			evidenceBits.push(`food[${evidence.foodFeatureIds.join(',')}]`);
		}
		if (applyWater) {
			evidenceBits.push(`water[${evidence.waterFeatureIds.join(',')}]`);
		}

		const entry: LearningHistoryEntry = {
			timeSeconds,
			outcome,
			symbolId: current.symbolId,
			emissionId: current.emissionId,
			reason: `perceived ${evidenceBits.join(' + ')} within evidence radius of origin`,
			foodStrengthBefore: reinforced.foodStrengthBefore,
			foodStrengthAfter: reinforced.foodStrengthAfter,
			waterStrengthBefore: reinforced.waterStrengthBefore,
			waterStrengthAfter: reinforced.waterStrengthAfter
		};

		next = {
			...next,
			symbolAssociations: reinforced.associations,
			activeInvestigation: {
				...current,
				foodEvidenceApplied: current.foodEvidenceApplied || applyFood,
				waterEvidenceApplied: current.waterEvidenceApplied || applyWater
			},
			recentLearning: appendLearningHistory(next.recentLearning, entry, config.learningHistoryLimit)
		};
	}

	// Temporal window ended: close investigation with conservative outcome.
	const still = next.activeInvestigation;
	if (still && timeSeconds >= still.expiresAt) {
		const hadEvidence = still.foodEvidenceApplied || still.waterEvidenceApplied;
		if (hadEvidence) {
			const outcome = outcomeFromEvidenceFlags(
				still.foodEvidenceApplied,
				still.waterEvidenceApplied
			);
			next = completeInvestigation(
				next,
				timeSeconds,
				outcome,
				`investigation window ended with ${outcome}`,
				config
			);
		} else {
			next = completeInvestigation(
				next,
				timeSeconds,
				'no_evidence',
				'investigation window ended with no qualifying resource evidence (associations unchanged unless reduction configured)',
				config,
				{ applyNoEvidenceReduction: true }
			);
		}
	}

	return next;
}

/**
 * When leaving investigate_signal (or clearing investigation), record interruption if needed.
 */
export function interruptInvestigation(
	creature: Creature,
	timeSeconds: number,
	reason: string,
	config: Pick<
		LearningStepConfig,
		| 'learningHistoryLimit'
		| 'noEvidenceConfidenceReduction'
		| 'associationStrengthMin'
		| 'associationStrengthMax'
	>
): Creature {
	if (!creature.activeInvestigation) {
		return creature;
	}
	return completeInvestigation(creature, timeSeconds, 'interrupted', reason, {
		...config,
		pendingSignalLifetimeSeconds: 0,
		maxPendingSignalsPerCreature: 0,
		investigationDurationSeconds: 0,
		learningEvidenceRadius: 0,
		associationReinforcement: 0,
		arrivalDistance: 0
	} as LearningStepConfig);
}

/**
 * Convert signals heard this step into pending investigation candidates.
 * Uses heardAt === timeSeconds so eligibility is fixed-step deterministic (usable from next step).
 */
export function ingestHeardIntoPending(
	creature: Creature,
	timeSeconds: number,
	config: Pick<LearningStepConfig, 'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'>
): Creature {
	const newlyHeard = creature.recentHeard.filter((h) => h.heardAt === timeSeconds);
	if (newlyHeard.length === 0) {
		return creature;
	}
	return {
		...creature,
		pendingSignals: insertPendingFromHeard(creature.pendingSignals, newlyHeard, config)
	};
}

/**
 * After communication reception: ingest pending for every creature in array order.
 */
export function stepPostReceptionLearning(
	creatures: readonly Creature[],
	timeSeconds: number,
	config: Pick<LearningStepConfig, 'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'>
): Creature[] {
	return creatures.map((creature) => ingestHeardIntoPending(creature, timeSeconds, config));
}
