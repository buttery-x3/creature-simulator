/**
 * Simulation public entry point.
 *
 * Owns authoritative simulation state, deterministic creature creation, fixed-step
 * advancement and bounded wander movement. Presentation and Svelte must not store
 * creature authority inside Three.js objects.
 */

export type { Creature, SimulationConfig, SimulationState, SpeedRange } from './types';

export {
	DEFAULT_SIMULATION_CONFIG,
	SimulationCreationError,
	createSimulation,
	defaultSimulationConfig,
	simulationSnapshot
} from './create-simulation';

export { advanceSimulation, stepSimulation, type CatchUpResult } from './step-simulation';

export {
	clampToInterior,
	distanceSquared,
	interiorPositionBounds,
	normalizeAngle,
	sampleInteriorPoint,
	sampleWanderTarget,
	shortestAngleDelta,
	stepCreature
} from './creature-movement';

export { formatSimulationDiagnostics } from './diagnostics';
