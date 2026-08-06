/**
 * Lightweight simulation diagnostics for the workbench.
 * Decision, perception and communication reasons come from structured simulation records only.
 * Symbols are arbitrary at emission — listener associations are personal learned evidence only.
 * Population convergence metrics are pure derived observations (never feed back into behaviour).
 */

import type { Creature, CreatureTarget, SimulationConfig, SimulationState } from './types';
import type { HeardSignal, SignalEmission } from './communication/types';
import { buildEmissionWeights } from './communication/symbol-selection';
import {
	buildPopulationSymbolDiagnostics,
	formatPopulationSymbolDiagnostics
} from './population-symbol-diagnostics';

function formatTarget(target: CreatureTarget | null): string {
	if (!target) {
		return 'none';
	}
	if (target.kind === 'point') {
		return `point=(${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)})`;
	}
	return `${target.featureKind}:${target.featureId}`;
}

function formatCreature(creature: Creature): string {
	const {
		id,
		position,
		facing,
		movementSpeed,
		hunger,
		thirst,
		energy,
		goal,
		action,
		target,
		nextReconsiderAt
	} = creature;
	return (
		`${id}: pos=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`facing=${facing.toFixed(3)} speed=${movementSpeed.toFixed(3)} ` +
		`needs=[h=${hunger.toFixed(2)} t=${thirst.toFixed(2)} e=${energy.toFixed(2)}] ` +
		`goal=${goal} action=${action} target=${formatTarget(target)} ` +
		`reconsider@${nextReconsiderAt.toFixed(2)}`
	);
}

function formatEmissionLine(emission: SignalEmission): string {
	const evidence = emission.selectionEvidence;
	const weightSummary = evidence.candidates
		.map((c) => `${c.symbolId}:w=${c.effectiveWeight.toFixed(3)}`)
		.join(' ');
	return (
		`${emission.id} symbol=${emission.symbolId} sender=${emission.senderId} ` +
		`origin=(${emission.origin.x.toFixed(3)}, ${emission.origin.y.toFixed(3)}) ` +
		`emitted@${emission.emittedAt.toFixed(3)} expires@${emission.expiresAt.toFixed(3)} ` +
		`context=${emission.context}/${emission.contextDetail} ` +
		`symbolReason=${emission.symbolSelectionReason} ` +
		`fallback=${evidence.usedFallback} weights=[${weightSummary}]`
	);
}

function formatHeardLine(heard: HeardSignal): string {
	return (
		`emission=${heard.emissionId} symbol=${heard.symbolId} sender=${heard.senderId} ` +
		`origin=(${heard.origin.x.toFixed(3)}, ${heard.origin.y.toFixed(3)}) ` +
		`emitted@${heard.emittedAt.toFixed(3)} heard@${heard.heardAt.toFixed(3)}`
	);
}

/**
 * Human-readable simulation summary plus per-creature lines.
 * Optional config enables population symbol diagnostics (pure, observational).
 */
export function formatSimulationDiagnostics(
	state: SimulationState,
	options?: {
		paused?: boolean;
		config?: Pick<SimulationConfig, 'symbolInventory' | 'recentEmissionDiagnosticsWindowSeconds'>;
	}
): string {
	const paused = options?.paused ?? false;
	const lines: string[] = [
		`seed: ${state.seed}`,
		`status: ${paused ? 'paused' : 'running'}`,
		`time: ${state.timeSeconds.toFixed(3)} s`,
		`creatures: ${state.creatures.length}`,
		`active emissions: ${state.activeEmissions.length}`,
		'',
		'creatures:'
	];

	for (const creature of state.creatures) {
		lines.push(`  ${formatCreature(creature)}`);
	}

	if (state.activeEmissions.length > 0) {
		lines.push('', 'active emissions:');
		for (const emission of state.activeEmissions) {
			lines.push(`  ${formatEmissionLine(emission)}`);
		}
	}

	if (options?.config) {
		const population = buildPopulationSymbolDiagnostics(state, options.config);
		lines.push('', formatPopulationSymbolDiagnostics(population));
	}

	return lines.join('\n');
}

export type InspectionConfig = Pick<
	SimulationConfig,
	| 'sensingRadius'
	| 'trackedObservationDurationSeconds'
	| 'hearingRadius'
	| 'emissionExplorationFloor'
	| 'emissionAssociationWeightMultiplier'
	| 'symbolInventory'
>;

/**
 * Pure inspection view for the workbench. Does not mutate the creature.
 * Selection of a creature is presentation state and never calls this for side effects.
 * Distances to perceived resources are derived from authoritative perception + position.
 */
export function formatCreatureInspection(
	creature: Creature,
	timeSeconds: number,
	config?: InspectionConfig
): string {
	const sensingRadius = config?.sensingRadius;
	const trackDuration = config?.trackedObservationDurationSeconds ?? 0;
	const p = creature.perception;

	const lines: string[] = [
		`id: ${creature.id}`,
		`position: (${creature.position.x.toFixed(3)}, ${creature.position.y.toFixed(3)})`,
		`facing: ${creature.facing.toFixed(3)}`,
		`hunger: ${creature.hunger.toFixed(3)} (pressure; 0=sated 1=max)`,
		`thirst: ${creature.thirst.toFixed(3)} (pressure; 0=quenched 1=max)`,
		`energy: ${creature.energy.toFixed(3)} (satisfaction; 0=exhausted 1=full)`,
		`curiosity: ${creature.curiosity.toFixed(3)} (individual trait; drives unknown-signal interest)`,
		`goal: ${creature.goal}`,
		`action: ${creature.action}`,
		`target: ${formatTarget(creature.target)}`,
		`goal started: ${creature.goalStartedAt.toFixed(3)} s`,
		`action started: ${creature.actionStartedAt.toFixed(3)} s`,
		`next reconsider: ${creature.nextReconsiderAt.toFixed(3)} s (in ${Math.max(0, creature.nextReconsiderAt - timeSeconds).toFixed(3)} s)`,
		''
	];

	if (creature.action === 'search') {
		lines.push(
			`search destination: (${creature.searchTarget.x.toFixed(3)}, ${creature.searchTarget.y.toFixed(3)})`,
			''
		);
	}

	lines.push('perception:');
	if (sensingRadius !== undefined) {
		lines.push(`  sensing radius: ${sensingRadius.toFixed(3)}`);
	}
	lines.push(
		`  last update: ${p.lastUpdatedAt >= 0 ? `${p.lastUpdatedAt.toFixed(3)} s` : 'never'}`,
		`  perceived food: ${p.perceivedFoodIds.length > 0 ? p.perceivedFoodIds.join(', ') : '(none)'}`,
		`  perceived water: ${p.perceivedWaterIds.length > 0 ? p.perceivedWaterIds.join(', ') : '(none)'}`
	);
	if (p.observations.length === 0) {
		lines.push('  observations: (none)');
	} else {
		for (const obs of p.observations) {
			const dx = obs.position.x - creature.position.x;
			const dy = obs.position.y - creature.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			lines.push(
				`  obs ${obs.featureKind}:${obs.featureId} pos=(${obs.position.x.toFixed(3)}, ${obs.position.y.toFixed(3)}) dist=${dist.toFixed(3)} at ${obs.observedAt.toFixed(3)} s`
			);
		}
	}
	if (p.tracked) {
		const age = timeSeconds - p.tracked.observedAt;
		const expiresAt = p.tracked.observedAt + trackDuration;
		lines.push(
			`  tracked: ${p.tracked.featureKind}:${p.tracked.featureId} ` +
				`pos=(${p.tracked.position.x.toFixed(3)}, ${p.tracked.position.y.toFixed(3)}) ` +
				`age=${age.toFixed(3)} s expires@${expiresAt.toFixed(3)} s`
		);
	} else {
		lines.push('  tracked: (none)');
	}

	lines.push('', 'last decision:');

	if (creature.lastDecision) {
		const d = creature.lastDecision;
		lines.push(
			`  time: ${d.timeSeconds.toFixed(3)} s`,
			`  trigger: ${d.trigger}`,
			`  previous goal: ${d.previousGoal ?? 'none'}`,
			`  selected: ${d.selectedGoal} → ${formatTarget(d.selectedTarget)}`,
			`  reason: ${d.selectionReason}`
		);
	} else {
		lines.push('  (none)');
	}

	lines.push('', 'candidates:');
	const candidates =
		creature.lastCandidates.length > 0
			? creature.lastCandidates
			: (creature.lastDecision?.candidates ?? []);
	if (candidates.length === 0) {
		lines.push('  (none)');
	} else {
		for (const c of candidates) {
			const flag = c.valid ? 'valid' : 'invalid';
			const reject = c.rejectionReason ? ` | reject: ${c.rejectionReason}` : '';
			lines.push(
				`  ${c.goal}: score=${c.score.toFixed(3)} ${flag} — ${c.reason}${reject}` +
					` target=${formatTarget(c.target)}`
			);
		}
	}

	lines.push('', 'recent transitions:');
	if (creature.recentTransitions.length === 0) {
		lines.push('  (none)');
	} else {
		for (const t of creature.recentTransitions) {
			lines.push(
				`  t=${t.timeSeconds.toFixed(3)}: ${t.fromGoal}/${t.fromAction} → ${t.toGoal}/${t.toAction} (${t.reason})`
			);
		}
	}

	const hearingRadius = config?.hearingRadius;
	lines.push('', 'communication:');
	lines.push(
		`  preferred symbol: ${creature.preferredSymbolId} (cold-start fallback / initial arbitrary preference)`
	);
	if (hearingRadius !== undefined) {
		lines.push(`  hearing radius: ${hearingRadius.toFixed(3)}`);
	}
	lines.push(
		`  emission count: ${creature.emissionCount}`,
		`  last emission: ${creature.lastEmissionAt >= 0 ? `${creature.lastEmissionAt.toFixed(3)} s` : 'never'}`
	);

	// Derived output weights (not stored; reuse personal associations directly).
	if (
		config?.symbolInventory &&
		typeof config.emissionExplorationFloor === 'number' &&
		typeof config.emissionAssociationWeightMultiplier === 'number'
	) {
		const weightConfig = {
			emissionExplorationFloor: config.emissionExplorationFloor,
			emissionAssociationWeightMultiplier: config.emissionAssociationWeightMultiplier
		};
		const foodWeights = buildEmissionWeights(
			config.symbolInventory,
			creature.symbolAssociations,
			'food',
			weightConfig
		);
		const waterWeights = buildEmissionWeights(
			config.symbolInventory,
			creature.symbolAssociations,
			'water',
			weightConfig
		);
		lines.push('  effective emission weights (derived; not a production table):');
		for (let i = 0; i < config.symbolInventory.length; i += 1) {
			const food = foodWeights[i]!;
			const water = waterWeights[i]!;
			lines.push(
				`    ${food.symbolId}: foodWeight=${food.effectiveWeight.toFixed(3)} (str=${food.learnedStrength.toFixed(3)})` +
					` waterWeight=${water.effectiveWeight.toFixed(3)} (str=${water.learnedStrength.toFixed(3)})`
			);
		}
	}

	if (creature.recentEmitted.length === 0) {
		lines.push('  recent emitted: (none)');
	} else {
		lines.push('  recent emitted:');
		for (const emission of creature.recentEmitted) {
			lines.push(`    ${formatEmissionLine(emission)}`);
		}
		const last = creature.recentEmitted[creature.recentEmitted.length - 1]!;
		lines.push(
			`  last selection: context=${last.selectionEvidence.emissionContext}` +
				` symbol=${last.selectionEvidence.selectedSymbolId}` +
				` reason=${last.selectionEvidence.reason}` +
				` fallback=${last.selectionEvidence.usedFallback}`
		);
	}
	if (creature.recentHeard.length === 0) {
		lines.push('  recent heard: (none)');
	} else {
		lines.push('  recent heard:');
		for (const heard of creature.recentHeard) {
			lines.push(`    ${formatHeardLine(heard)}`);
		}
	}

	lines.push('', 'learning (personal associations; no global symbol meaning):');
	if (creature.symbolAssociations.length === 0) {
		lines.push('  associations: (none)');
	} else {
		for (const assoc of creature.symbolAssociations) {
			lines.push(
				`  ${assoc.symbolId}: food=${assoc.foodStrength.toFixed(3)} (n=${assoc.foodEvidenceCount})` +
					` water=${assoc.waterStrength.toFixed(3)} (n=${assoc.waterEvidenceCount})` +
					` bias=${(assoc.foodStrength * creature.hunger + assoc.waterStrength * creature.thirst).toFixed(3)}`
			);
		}
	}

	if (creature.pendingSignals.length === 0) {
		lines.push('  pending signals: (none)');
	} else {
		lines.push('  pending signals:');
		for (const pending of creature.pendingSignals) {
			const age = Math.max(0, timeSeconds - pending.heardAt);
			lines.push(
				`    emission=${pending.emissionId} symbol=${pending.symbolId} from ${pending.senderId}` +
					` origin=(${pending.origin.x.toFixed(3)}, ${pending.origin.y.toFixed(3)})` +
					` age=${age.toFixed(3)}s expires@${pending.expiresAt.toFixed(3)}` +
					` (listener-only; no emitter contextDetail)`
			);
		}
	}

	if (creature.activeInvestigation) {
		const inv = creature.activeInvestigation;
		lines.push(
			`  active investigation: emission=${inv.emissionId} symbol=${inv.symbolId}` +
				` origin=(${inv.origin.x.toFixed(3)}, ${inv.origin.y.toFixed(3)})` +
				` started@${inv.startedAt.toFixed(3)}` +
				` (no travel timeout; completes on arrival inspection)`
		);
	} else {
		lines.push('  active investigation: (none)');
	}

	const investigateCandidate = (
		creature.lastCandidates.length > 0
			? creature.lastCandidates
			: (creature.lastDecision?.candidates ?? [])
	).find((c) => c.goal === 'investigate_signal');
	if (investigateCandidate) {
		lines.push(
			`  investigation score: ${investigateCandidate.score.toFixed(3)} ` +
				`valid=${investigateCandidate.valid} — ${investigateCandidate.reason}` +
				(investigateCandidate.rejectionReason ? ` | ${investigateCandidate.rejectionReason}` : '')
		);
	}

	if (creature.recentLearning.length === 0) {
		lines.push('  recent learning: (none)');
	} else {
		lines.push('  recent learning:');
		for (const entry of creature.recentLearning) {
			lines.push(
				`    t=${entry.timeSeconds.toFixed(3)} ${entry.outcome} symbol=${entry.symbolId}` +
					` emission=${entry.emissionId}` +
					` food ${entry.foodStrengthBefore.toFixed(3)}→${entry.foodStrengthAfter.toFixed(3)}` +
					` water ${entry.waterStrengthBefore.toFixed(3)}→${entry.waterStrengthAfter.toFixed(3)}` +
					` — ${entry.reason}`
			);
		}
	}

	return lines.join('\n');
}
