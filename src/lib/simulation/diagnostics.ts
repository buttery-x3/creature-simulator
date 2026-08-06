/**
 * Lightweight simulation diagnostics for the workbench.
 * Decision and perception reasons come from structured simulation records only.
 */

import type { Creature, CreatureTarget, SimulationConfig, SimulationState } from './types';

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

/**
 * Human-readable simulation summary plus per-creature lines.
 */
export function formatSimulationDiagnostics(
	state: SimulationState,
	options?: { paused?: boolean }
): string {
	const paused = options?.paused ?? false;
	const lines: string[] = [
		`seed: ${state.seed}`,
		`status: ${paused ? 'paused' : 'running'}`,
		`time: ${state.timeSeconds.toFixed(3)} s`,
		`creatures: ${state.creatures.length}`,
		'',
		'creatures:'
	];

	for (const creature of state.creatures) {
		lines.push(`  ${formatCreature(creature)}`);
	}

	return lines.join('\n');
}

export type InspectionConfig = Pick<
	SimulationConfig,
	'sensingRadius' | 'trackedObservationDurationSeconds'
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

	return lines.join('\n');
}
