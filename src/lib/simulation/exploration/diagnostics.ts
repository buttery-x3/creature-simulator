/**
 * Observational exploration diagnostics for selected-creature inspection.
 * Not decision authority — recomputes score factors from current state only.
 */

import type { Vec2, WorldBounds } from '$lib/habitat';
import { cellCentre, countExploredCells, explorationCellCount } from './create-exploration';
import { scoreExplorationCell } from './select-exploration-target';
import type { ExplorationScoreConfig, ExplorationState } from './types';

export type ExplorationDiagnosticsView = {
	exploredCount: number;
	totalCells: number;
	/** Active cell index, or null when not exploring a cell. */
	activeCellIndex: number | null;
	targetCentre: Vec2 | null;
	distanceFactor: number | null;
	stalenessFactor: number | null;
	distanceContribution: number | null;
	stalenessContribution: number | null;
	finalScore: number | null;
};

/**
 * Build selected-creature exploration diagnostics.
 * When there is no active exploration target, target-specific fields are null
 * (UI maps to N/A / (none)).
 */
export function buildExplorationDiagnostics(
	exploration: ExplorationState,
	bounds: WorldBounds,
	creaturePosition: Vec2,
	currentTime: number,
	config: ExplorationScoreConfig
): ExplorationDiagnosticsView {
	const totalCells = explorationCellCount(exploration.map);
	const exploredCount = countExploredCells(exploration.map);
	const active = exploration.activeCellIndex;

	if (active === null || active < 0 || active >= totalCells) {
		return {
			exploredCount,
			totalCells,
			activeCellIndex: null,
			targetCentre: null,
			distanceFactor: null,
			stalenessFactor: null,
			distanceContribution: null,
			stalenessContribution: null,
			finalScore: null
		};
	}

	const breakdown = scoreExplorationCell(
		exploration.map,
		bounds,
		active,
		creaturePosition,
		currentTime,
		config
	);
	return {
		exploredCount,
		totalCells,
		activeCellIndex: active,
		targetCentre: cellCentre(bounds, exploration.map, active),
		distanceFactor: breakdown.distanceFactor,
		stalenessFactor: breakdown.stalenessFactor,
		distanceContribution: breakdown.distanceContribution,
		stalenessContribution: breakdown.stalenessContribution,
		finalScore: breakdown.score
	};
}

export function formatExplorationDiagnostics(view: ExplorationDiagnosticsView): string[] {
	const lines = [
		`explored cells: ${view.exploredCount} / ${view.totalCells}`,
		`exploration target: ${view.activeCellIndex !== null ? String(view.activeCellIndex) : '(none)'}`
	];
	if (view.targetCentre) {
		lines.push(
			`target centre: (${view.targetCentre.x.toFixed(3)}, ${view.targetCentre.y.toFixed(3)})`,
			`distance factor: ${view.distanceFactor!.toFixed(3)}`,
			`staleness factor: ${view.stalenessFactor!.toFixed(3)}`,
			`distance contribution: ${view.distanceContribution!.toFixed(3)}`,
			`staleness contribution: ${view.stalenessContribution!.toFixed(3)}`,
			`final exploration score: ${view.finalScore!.toFixed(3)}`
		);
	} else {
		lines.push(
			'target centre: (none)',
			'distance factor: N/A',
			'staleness factor: N/A',
			'distance contribution: N/A',
			'staleness contribution: N/A',
			'final exploration score: N/A'
		);
	}
	return lines;
}
