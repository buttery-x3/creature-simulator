/**
 * Apply unified cognition arbitration onto creature execution state.
 */

import type { Habitat } from '$lib/habitat';
import { arbitrate } from '../cognition/arbitrate';
import type { ArbitrationTrigger } from '../cognition/types';
import type { SymbolId } from '../communication/types';
import { cellCentre, selectExplorationTarget, type ExplorationScoreConfig } from '../exploration';
import { beginInvestigation } from '../learning/signal-investigation';
import { interruptInvestigation } from '../learning/step-signal-learning';
import type { Creature, SimulationConfig } from '../types';
import { applyArbitration } from './actions';
import { type ArbitrationConfig, buildArbitrationInput } from './build-arbitration-input';
import { ensureSearchTarget, isAtTarget, pointTarget } from './resource-awareness';

export type ReplanConfig = ArbitrationConfig &
	Pick<
		SimulationConfig,
		| 'reconsiderIntervalSeconds'
		| 'decisionHistoryLimit'
		| 'arrivalDistance'
		| 'creatureRadius'
		| 'explorationDistanceWeight'
		| 'explorationStalenessWeight'
		| 'explorationStalenessScaleSeconds'
	> &
	Pick<
		SimulationConfig,
		| 'learningHistoryLimit'
		| 'noEvidenceConfidenceReduction'
		| 'associationStrengthMin'
		| 'associationStrengthMax'
	>;

function explorationScoreConfig(config: ReplanConfig): ExplorationScoreConfig {
	return {
		explorationDistanceWeight: config.explorationDistanceWeight,
		explorationStalenessWeight: config.explorationStalenessWeight,
		explorationStalenessScaleSeconds: config.explorationStalenessScaleSeconds
	};
}

/**
 * Run authoritative arbitration and map the result onto execution fields.
 */
export function replanFromArbitration(
	creature: Creature,
	habitat: Habitat,
	timeSeconds: number,
	trigger: ArbitrationTrigger,
	config: ReplanConfig,
	simulationSeed: string
): Creature {
	const input = buildArbitrationInput(creature, habitat, timeSeconds, trigger, config);
	const record = arbitrate(input);
	const arrived = isAtTarget(
		creature.position,
		habitat,
		record.selectedTarget,
		config.arrivalDistance
	);
	const applied = applyArbitration(creature, record, arrived, config);

	let exploration = creature.exploration;
	let target = applied.target;
	let searchTarget = creature.searchTarget;
	let searchDecisionIndex = creature.searchDecisionIndex;
	let activeInvestigation = creature.activeInvestigation;
	let symbolAssociations = creature.symbolAssociations;
	let recentLearning = creature.recentLearning;
	let activeAnnouncementExecution = creature.activeAnnouncementExecution;

	// Leaving investigate → interrupt learning context (not a lock).
	if (activeInvestigation && applied.intention !== 'investigate_signal') {
		const interrupted = interruptInvestigation(
			{
				...creature,
				symbolAssociations,
				activeInvestigation,
				recentLearning
			},
			timeSeconds,
			`interrupted: switched to ${applied.intention}`,
			config
		);
		activeInvestigation = interrupted.activeInvestigation;
		symbolAssociations = interrupted.symbolAssociations;
		recentLearning = interrupted.recentLearning;
	}

	// Synchronize announcement execution with the latest cognition selection.
	// Execution may survive reconsideration only while it still matches the
	// announce_resource feature selected by this arbitration — never a lock.
	if (applied.intention !== 'announce_resource') {
		activeAnnouncementExecution = null;
	} else {
		const selectedFeatureId =
			record.selectedTarget?.kind === 'feature' ? record.selectedTarget.featureId : null;
		const continuing = activeAnnouncementExecution;
		const sameFeature =
			continuing !== null &&
			selectedFeatureId !== null &&
			continuing.triggerFeatureId === selectedFeatureId;

		if (!sameFeature || continuing === null) {
			// Different feature (or no feature): drop old prep; keep cognition's feature target
			// so the executor starts fresh for the newly selected resource.
			activeAnnouncementExecution = null;
		} else if (continuing.state === 'repositioning' && continuing.speakingTarget) {
			// Same feature mid-reposition: restore speaking point as physical destination
			// rather than resetting movement to the feature centre.
			target = pointTarget(continuing.speakingTarget);
		}
	}

	// Explore lifecycle: enter selects a cell; continue preserves; leave clears.
	if (applied.intention === 'explore') {
		const continuing = creature.intention === 'explore' && exploration.activeCellIndex !== null;
		if (continuing && exploration.activeCellIndex !== null) {
			// Preserve active cell; restore point target from that cell centre.
			target = pointTarget(
				cellCentre(habitat.bounds, exploration.map, exploration.activeCellIndex)
			);
		} else {
			const selection = selectExplorationTarget(
				exploration.map,
				habitat.bounds,
				creature.position,
				timeSeconds,
				explorationScoreConfig(config)
			);
			exploration = {
				map: exploration.map,
				activeCellIndex: selection.cellIndex
			};
			target = pointTarget(selection.centre);
		}
	} else if (exploration.activeCellIndex !== null) {
		// Leaving explore: clear active cell commitment.
		exploration = { map: exploration.map, activeCellIndex: null };
	}

	if (applied.intention === 'investigate_signal') {
		const selected = record.candidates.find((c) => c.intention === 'investigate_signal' && c.valid);
		const ref = selected?.reference;
		const continuing = activeInvestigation !== null && creature.intention === 'investigate_signal';

		if (continuing && activeInvestigation) {
			// Same intention: keep current investigation context; refresh target from origin.
			const sameEmission =
				ref?.kind === 'heard_signal' && ref.emissionId === activeInvestigation.emissionId;
			if (sameEmission || !ref || ref.kind !== 'heard_signal') {
				target = pointTarget(activeInvestigation.origin);
			} else {
				activeInvestigation = beginInvestigation(
					{
						emissionId: ref.emissionId,
						symbolId: ref.symbolId as SymbolId,
						origin: target?.kind === 'point' ? target.position : activeInvestigation.origin
					},
					timeSeconds
				);
				target = pointTarget(activeInvestigation.origin);
			}
		} else if (ref?.kind === 'heard_signal') {
			const origin =
				record.selectedTarget?.kind === 'point' ? record.selectedTarget.position : { x: 0, y: 0 };
			activeInvestigation = beginInvestigation(
				{
					emissionId: ref.emissionId,
					symbolId: ref.symbolId as SymbolId,
					origin
				},
				timeSeconds
			);
			target = pointTarget(activeInvestigation.origin);
		} else if (record.selectedTarget?.kind === 'point') {
			// Fallback: point target without reference (should be rare).
			target = record.selectedTarget;
		}
	} else if (applied.action === 'search') {
		const search = ensureSearchTarget(
			{
				...creature,
				...applied,
				target,
				searchTarget,
				searchDecisionIndex
			},
			simulationSeed,
			habitat,
			config
		);
		searchTarget = search.searchTarget;
		searchDecisionIndex = search.searchDecisionIndex;
		target = search.target;
	}

	return {
		...creature,
		...applied,
		target,
		exploration,
		searchTarget,
		searchDecisionIndex,
		activeInvestigation,
		symbolAssociations,
		recentLearning,
		activeAnnouncementExecution
	};
}
