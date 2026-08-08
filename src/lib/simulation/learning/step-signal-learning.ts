/**
 * Fixed-step learning advance hooks.
 *
 * - Arrival resolution: ephemeral local inspection for evidence only, reinforce once,
 *   recompute lexicon, consume the investigated heard_signal memory, clear execution context.
 * - Interruption: clear context when arbitration selects a different intention;
 *   heard_signal memory is retained (still unresolved).
 *
 * Investigation selection is cognition from remaining heard_signal memories.
 */

import type { Habitat } from '$lib/habitat';
import { queryFeaturesNear } from '../behaviour/habitat-feature-query';
import { forgetHeardSignal } from '../memory/mutate';
import type { Creature, SimulationConfig } from '../types';
import { applyLexiconResolution } from './lexicon-resolution';
import {
	applyNoEvidenceReduction,
	findAssociation,
	reinforceAssociation
} from './signal-associations';
import { appendLearningHistory, outcomeFromEvidenceFlags } from './signal-investigation';
import type { LearningHistoryEntry, LearningOutcome } from './types';

export type LearningStepConfig = Pick<
	SimulationConfig,
	| 'learningEvidenceRadius'
	| 'associationReinforcement'
	| 'noEvidenceConfidenceReduction'
	| 'learningHistoryLimit'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'arrivalDistance'
	| 'sensingRadius'
	| 'perceptionIntervalSeconds'
	| 'symbolInventory'
	| 'lexiconAssignmentMinStrength'
	| 'lexiconAssignmentMinEvidenceCount'
	| 'lexiconHistoryLimit'
>;

/**
 * Ephemeral arrival inspection: food/water near the signal origin for learning only.
 * Does not mutate creature perception or create announcement opportunities.
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
 * Resolve investigation at the origin: ephemeral local inspection for learning
 * evidence, reinforce once, consume the heard_signal for this emission, clear active.
 * Call only when action is `investigate` after successful arrival.
 *
 * Memory consumption happens here so subsequent action_complete arbitration no
 * longer sees this emission as an investigate_signal candidate.
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

	const lexiconApplied = applyLexiconResolution(
		creature.lexicon,
		creature.recentLexiconChanges,
		associations,
		config.symbolInventory,
		timeSeconds,
		config,
		`after investigation ${active.emissionId} symbol=${active.symbolId} outcome=${outcome}`
	);

	// Successful inspection resolves the actionable chirp — even on no_evidence.
	const memory = forgetHeardSignal(creature.memory, active.emissionId);

	return {
		...creature,
		memory,
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
 * When arbitration selects a different intention mid-investigation.
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
