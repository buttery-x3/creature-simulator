/**
 * Fixed-step learning advance hooks.
 *
 * - Mid-step: expire pending only (evidence is resolved on arrival, not while travelling).
 * - Arrival resolution: force perception, classify evidence, reinforce once, clear investigation.
 * - Post-reception: convert newly heard signals into pending candidates.
 */

import type { Habitat } from '$lib/habitat';
import { senseAt } from '../behaviour/perception';
import type { Creature, SimulationConfig } from '../types';
import { applyLexiconResolution } from './lexicon-resolution';
import {
	applyNoEvidenceReduction,
	findAssociation,
	reinforceAssociation
} from './signal-associations';
import {
	appendLearningHistory,
	insertPendingFromHeard,
	expirePendingSignals,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin
} from './signal-investigation';
import type { LearningHistoryEntry, LearningOutcome } from './types';

export type LearningStepConfig = Pick<
	SimulationConfig,
	| 'pendingSignalLifetimeSeconds'
	| 'maxPendingSignalsPerCreature'
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'arrivalDistance'
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'trackedObservationDurationSeconds'
	| 'symbolInventory'
	| 'lexiconAssignmentMinStrength'
	| 'lexiconAssignmentMinEvidenceCount'
	| 'lexiconHistoryLimit'
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

/**
 * After perception tick: expire pending only.
 * Does not apply investigation evidence mid-travel.
 */
export function advanceActiveLearning(
	creature: Creature,
	timeSeconds: number,
	_config?: LearningStepConfig
): Creature {
	void _config;
	return {
		...creature,
		pendingSignals: expirePendingSignals(creature.pendingSignals, timeSeconds)
	};
}

/**
 * Resolve investigation at the origin: force local perception, reinforce once, clear active.
 * Call only when action is `investigate` (creature has stopped at the site).
 */
export function resolveInvestigationAtSite(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	config: LearningStepConfig
): Creature {
	const active = creature.activeInvestigation;
	if (!active) {
		return creature;
	}

	// Authoritative sensing at arrival — do not depend on a stale perception interval.
	const sensed = senseAt(
		creature.position,
		habitat,
		timeSeconds,
		config,
		creature.perception,
		creature.id
	);
	const perception = sensed.perception;
	const evidence = qualifyEvidenceNearOrigin(perception, active.origin, config);

	const before = snapshotStrengths(creature, active.symbolId);
	let associations = creature.symbolAssociations;
	let foodAfter = before.food;
	let waterAfter = before.water;
	let reason: string;

	if (evidence.food || evidence.water) {
		const reinforced = reinforceAssociation(
			associations,
			active.symbolId,
			{
				reinforceFood: evidence.food,
				reinforceWater: evidence.water,
				amount: config.associationReinforcement
			},
			config
		);
		associations = reinforced.associations;
		foodAfter = reinforced.foodStrengthAfter;
		waterAfter = reinforced.waterStrengthAfter;
		const bits: string[] = [];
		if (evidence.food) {
			bits.push(`food[${evidence.foodFeatureIds.join(',')}]`);
		}
		if (evidence.water) {
			bits.push(`water[${evidence.waterFeatureIds.join(',')}]`);
		}
		reason = `arrival inspection: perceived ${bits.join(' + ')} within evidence radius of origin`;
	} else {
		if (config.noEvidenceConfidenceReduction > 0) {
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
		reason =
			'arrival inspection: no qualifying resource within evidence radius (associations unchanged unless reduction configured)';
	}

	const outcome: LearningOutcome = outcomeFromEvidenceFlags(evidence.food, evidence.water);
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

	// Recompute exclusive lexicon from updated evidence only (no population input).
	const lexiconApplied = applyLexiconResolution(
		creature.lexicon,
		creature.recentLexiconChanges,
		associations,
		config.symbolInventory,
		timeSeconds,
		config,
		`after investigation ${active.emissionId} symbol=${active.symbolId} outcome=${outcome}`
	);

	return {
		...creature,
		perception,
		symbolAssociations: associations,
		lexicon: lexiconApplied.lexicon,
		recentLexiconChanges: lexiconApplied.recentLexiconChanges,
		activeInvestigation: null,
		recentLearning: appendLearningHistory(
			creature.recentLearning,
			entry,
			config.learningHistoryLimit
		)
	};
}

/**
 * When abandoning an investigation mid-trip (should be rare under travel lock).
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
	const active = creature.activeInvestigation;
	if (!active) {
		return creature;
	}

	const before = snapshotStrengths(creature, active.symbolId);
	const entry: LearningHistoryEntry = {
		timeSeconds,
		outcome: 'interrupted',
		symbolId: active.symbolId,
		emissionId: active.emissionId,
		reason,
		foodStrengthBefore: before.food,
		foodStrengthAfter: before.food,
		waterStrengthBefore: before.water,
		waterStrengthAfter: before.water
	};

	return {
		...creature,
		activeInvestigation: null,
		recentLearning: appendLearningHistory(
			creature.recentLearning,
			entry,
			config.learningHistoryLimit
		)
	};
}

/**
 * Convert signals heard this step into pending investigation candidates.
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
	const pendingBefore = creature.pendingSignals.length;
	const pendingSignals = insertPendingFromHeard(creature.pendingSignals, newlyHeard, config);
	const gained =
		pendingSignals.length > pendingBefore ||
		newlyHeard.some((h) => pendingSignals.some((p) => p.emissionId === h.emissionId));

	// Prompt prompt reconsider on next behaviour step while wandering so explore is not delayed.
	const nextReconsiderAt =
		gained && creature.goal === 'wander'
			? Math.min(creature.nextReconsiderAt, timeSeconds)
			: creature.nextReconsiderAt;

	return {
		...creature,
		pendingSignals,
		nextReconsiderAt
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
