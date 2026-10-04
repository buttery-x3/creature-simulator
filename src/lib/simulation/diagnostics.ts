/**
 * Lightweight simulation diagnostics for the workbench.
 * Arbitration, perception and communication reasons come from structured simulation records only.
 * Symbols are arbitrary at emission — listener associations are personal learned evidence only.
 * Population convergence metrics are pure derived observations (never feed back into behaviour).
 */

import type { Creature, SimulationConfig, SimulationState } from './types';
import {
	formatCommunicationInspection,
	formatEmissionLine
} from './diagnostics/communication-inspection';
import { formatArbitrationDiagnostics, formatDiagnosticTarget } from './arbitration-diagnostics';
import {
	buildExplorationDiagnostics,
	formatExplorationDiagnostics
} from './exploration/diagnostics';
import {
	buildPopulationSymbolDiagnostics,
	formatPopulationSymbolDiagnostics
} from './population-symbol-diagnostics';

function formatCreature(creature: Creature): string {
	const {
		id,
		position,
		facing,
		movementSpeed,
		verbosity,
		curiosity,
		hunger,
		thirst,
		energy,
		intention,
		action,
		target,
		nextReconsiderAt
	} = creature;
	return (
		`${id}: pos=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`facing=${facing.toFixed(3)} speed=${movementSpeed.toFixed(3)} ` +
		`verbosity=${verbosity.toFixed(3)} curiosity=${curiosity.toFixed(3)} ` +
		`needs=[h=${hunger.toFixed(2)} t=${thirst.toFixed(2)} e=${energy.toFixed(2)}] ` +
		`intention=${intention} action=${action} target=${formatDiagnosticTarget(target)} ` +
		`reconsider@${nextReconsiderAt.toFixed(2)}`
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
	| 'hearingRadius'
	| 'symbolInventory'
	| 'explorationDistanceWeight'
	| 'explorationStalenessWeight'
	| 'explorationStalenessScaleSeconds'
> & {
	/** Habitat bounds for exploration score recomputation (optional). */
	worldBounds?: { width: number; height: number };
};

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
	const p = creature.perception;

	const lines: string[] = [
		`id: ${creature.id}`,
		`position: (${creature.position.x.toFixed(3)}, ${creature.position.y.toFixed(3)})`,
		`facing: ${creature.facing.toFixed(3)}`,
		`verbosity: ${creature.verbosity.toFixed(3)} (speech preference; 0=quiet 1=talkative)`,
		`curiosity: ${creature.curiosity.toFixed(3)} (optional novelty preference; 0=incurious 1=curious)`,
		`hunger: ${creature.hunger.toFixed(3)} (pressure; 0=sated 1=max)`,
		`thirst: ${creature.thirst.toFixed(3)} (pressure; 0=quenched 1=max)`,
		`energy: ${creature.energy.toFixed(3)} (satisfaction; 0=exhausted 1=full)`,
		`intention: ${creature.intention}`,
		`action: ${creature.action}`,
		`target: ${formatDiagnosticTarget(creature.target)}`,
		`intention started: ${creature.intentionStartedAt.toFixed(3)} s`,
		`action started: ${creature.actionStartedAt.toFixed(3)} s`,
		`next reconsider: ${creature.nextReconsiderAt.toFixed(3)} s (in ${Math.max(0, creature.nextReconsiderAt - timeSeconds).toFixed(3)} s)`,
		`pending trigger: ${creature.pendingArbitrationTrigger ?? 'none'}`,
		''
	];

	if (creature.action === 'search') {
		lines.push(
			`search destination: (${creature.searchTarget.x.toFixed(3)}, ${creature.searchTarget.y.toFixed(3)})`,
			''
		);
	}

	// Exploration map diagnostics (observational only).
	const bounds = config?.worldBounds ?? {
		width: creature.exploration.map.columns * creature.exploration.map.cellSize,
		height: creature.exploration.map.rows * creature.exploration.map.cellSize
	};
	const exploreView = buildExplorationDiagnostics(
		creature.exploration,
		bounds,
		creature.position,
		timeSeconds,
		{
			explorationDistanceWeight: config?.explorationDistanceWeight ?? 1,
			explorationStalenessWeight: config?.explorationStalenessWeight ?? 1,
			explorationStalenessScaleSeconds: config?.explorationStalenessScaleSeconds ?? 30
		}
	);
	lines.push('exploration:', ...formatExplorationDiagnostics(exploreView).map((l) => `  ${l}`), '');

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

	lines.push(...formatArbitrationDiagnostics(creature.lastArbitration));

	lines.push('', 'recent transitions:');
	if (creature.recentTransitions.length === 0) {
		lines.push('  (none)');
	} else {
		for (const t of creature.recentTransitions) {
			lines.push(
				`  t=${t.timeSeconds.toFixed(3)}: ${t.fromIntention}/${t.fromAction} → ${t.toIntention}/${t.toAction} (${t.reason})`
			);
		}
	}

	lines.push(...formatCommunicationInspection(creature, config?.hearingRadius));

	const mem = creature.memory;
	lines.push('', `memory: ${mem.entries.length}/${mem.capacity} (nextSeq=${mem.nextSequence})`);
	if (mem.entries.length === 0) {
		lines.push('  entries: (none)');
	} else {
		for (const entry of mem.entries) {
			if (entry.kind === 'heard_signal') {
				lines.push(
					`  #${entry.sequence} heard_signal ${entry.symbolId} emission=${entry.emissionId}` +
						` origin=(${entry.origin.x.toFixed(2)}, ${entry.origin.y.toFixed(2)}) @${entry.rememberedAt.toFixed(2)}`
				);
			} else if (entry.kind === 'resource_observation') {
				lines.push(
					`  #${entry.sequence} observation ${entry.resourceKind}:${entry.featureId}` +
						` empty=${entry.empty} @${entry.rememberedAt.toFixed(2)}`
				);
			} else if (entry.kind === 'danger_observation') {
				lines.push(
					`  #${entry.sequence} danger observation ${entry.wildlifeId} position=(${entry.position.x.toFixed(2)}, ${entry.position.y.toFixed(2)}) @${entry.rememberedAt.toFixed(2)}`
				);
			} else {
				lines.push(
					`  #${entry.sequence} announced ${entry.resourceKind}:${entry.featureId}` +
						` emission=${entry.emissionId} @${entry.rememberedAt.toFixed(2)}`
				);
			}
		}
	}

	return lines.join('\n');
}
