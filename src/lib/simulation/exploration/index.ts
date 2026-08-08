/**
 * Spatial exploration subdomain: per-creature exploration map, sensing updates,
 * and deterministic distance+staleness target selection.
 *
 * Cognition decides whether to explore; this module decides where.
 * Not CreatureMemory — separate plain serialisable state.
 */

export type {
	ExplorationMap,
	ExplorationScoreBreakdown,
	ExplorationScoreConfig,
	ExplorationState,
	ExplorationTargetSelection
} from './types';

export {
	cellCentre,
	cellCoords,
	cellCorners,
	cellRect,
	countExploredCells,
	createExplorationMap,
	createExplorationState,
	DEFAULT_EXPLORATION_CELL_SIZE,
	explorationCellCount,
	explorationGridDimensions,
	worldMax,
	worldMin,
	type CellRect
} from './create-exploration';

export { isCellFullySensed, updateExplorationFromSensing } from './update-exploration';

export {
	distanceFactor,
	scoreExplorationCell,
	selectExplorationTarget,
	stalenessFactor
} from './select-exploration-target';
