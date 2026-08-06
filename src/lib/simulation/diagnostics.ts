/**
 * Lightweight simulation diagnostics for the workbench.
 * Decision reasons come from structured simulation records only.
 */

import type { Creature, CreatureTarget, SimulationState } from './types';

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

/**
 * Pure inspection view for the workbench. Does not mutate the creature.
 * Selection of a creature is presentation state and never calls this for side effects.
 */
export function formatCreatureInspection(creature: Creature, timeSeconds: number): string {
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
		'',
		'last decision:'
	];

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
