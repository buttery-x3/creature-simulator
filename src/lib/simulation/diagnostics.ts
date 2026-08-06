/**
 * Lightweight simulation diagnostics for the workbench.
 */

import type { Creature, SimulationState } from './types';

function formatCreature(creature: Creature): string {
	const { id, position, facing, movementSpeed, wanderTarget, wanderDecisionIndex } = creature;
	return (
		`${id}: pos=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`facing=${facing.toFixed(3)} speed=${movementSpeed.toFixed(3)} ` +
		`target=(${wanderTarget.x.toFixed(3)}, ${wanderTarget.y.toFixed(3)}) ` +
		`decision=${wanderDecisionIndex}`
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
