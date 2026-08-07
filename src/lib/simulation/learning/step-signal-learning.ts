/**
 * Fixed-step learning advance hooks.
 *
 * - Mid-step: expire pending only (evidence is resolved on arrival, not while travelling).
 * - Arrival resolution: ephemeral local inspection for evidence only (no FLAME-71
 *   perception episodes or resource-announcement opportunities), reinforce once, clear investigation.
 * - Post-reception: convert newly heard signals into pending candidates.
 */

import type { Habitat } from '$lib/habitat';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
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
	outcomeFromEvidenceFlags
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

/**
 * Ephemeral arrival inspection: food/water near the signal origin for learning only.
 * Does not mutate creature perception episodes or create announcement opportunities.
 */
function inspectEvidenceNearOrigin(
	habitat: Habitat,
	origin: { x: number; y: number },
	evidenceRadius: number
): { food: boolean; water: boolean; foodFeatureIds: string[]; waterFeatureIds: string[] } {
	const nearby = queryFeaturesNear(habitat, origin, evidenceRadius, ['food', 'water']);
	const foodFeatureIds: string[] = [];
	const waterFeatureIds: string[] = [];
	const ordered = [...nearby].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (const feature of ordered) {
		if (feature.kind === 'food') {
			foodFeatureIds.push(feature.id);
		} else if (feature.kind === 'water') {
			waterFeatureIds.push(feature.id);
		}
	}
	return {
		food: foodFeatureIds.length > 0,
		water: waterFeatureIds.length > 0,
		foodFeatureIds,
		waterFeatureIds
	};
}

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
 * Resolve investigation at the origin: ephemeral local inspection for learning
 * evidence, reinforce once, clear active. Does not create FLAME-71 perception
 * episodes or resource-announcement opportunities.
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

	// Learning-only inspection — leave ordinary perception episodes unchanged.
	const evidence = inspectEvidenceNearOrigin(habitat, active.origin, config.learningEvidenceRadius);

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
		reason = `arrival inspection: observed ${bits.join(' + ')} within evidence radius of origin`;
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
		// Intentionally leave perception (episodes/observations) unchanged.
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
 * Convert signals heard this step into investigation opportunities with one-shot curiosity decisions.
 */
export function ingestHeardIntoPending(
	creature: Creature,
	timeSeconds: number,
	config: Pick<LearningStepConfig, 'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'>,
	simulationSeed: string
): Creature {
	const newlyHeard = creature.recentHeard.filter((h) => h.heardAt === timeSeconds);
	if (newlyHeard.length === 0) {
		return creature;
	}
	const pendingSignals = insertPendingFromHeard({
		pending: creature.pendingSignals,
		heardSignals: newlyHeard,
		config,
		simulationSeed,
		listenerId: creature.id,
		curiosity: creature.curiosity
	});

	const gainedAccepted = newlyHeard.some((h) =>
		pendingSignals.some((p) => p.emissionId === h.emissionId && p.curiosityDecision === 'accepted')
	);

	// Prompt reconsider while wandering only when curiosity accepted an opportunity.
	const nextReconsiderAt =
		gainedAccepted && creature.goal === 'wander'
			? Math.min(creature.nextReconsiderAt, timeSeconds)
			: creature.nextReconsiderAt;

	return {
		...creature,
		pendingSignals,
		nextReconsiderAt
	};
}

/**
 * After communication reception: ingest opportunities for every creature in array order.
 */
export function stepPostReceptionLearning(
	creatures: readonly Creature[],
	timeSeconds: number,
	config: Pick<LearningStepConfig, 'pendingSignalLifetimeSeconds' | 'maxPendingSignalsPerCreature'>,
	simulationSeed: string
): Creature[] {
	return creatures.map((creature) =>
		ingestHeardIntoPending(creature, timeSeconds, config, simulationSeed)
	);
}
