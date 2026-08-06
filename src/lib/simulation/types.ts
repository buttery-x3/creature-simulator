/**
 * Authoritative simulation state: habitat plus creatures.
 *
 * Creatures are never stored on {@link Habitat}. Facing is radians on the
 * ground plane (0 faces +x, positive turns toward +y / counter-clockwise).
 */

import type { Habitat, HabitatGenerationConfig, Vec2 } from '$lib/habitat';

export type Creature = {
	id: string;
	position: Vec2;
	/** Radians on the ground plane; 0 faces +x. */
	facing: number;
	/** Simulation units per simulated second. */
	movementSpeed: number;
	wanderTarget: Vec2;
	/** Increments each time a new wander target is chosen. */
	wanderDecisionIndex: number;
};

export type SimulationState = {
	seed: string;
	/** Simulated seconds advanced by fixed steps. */
	timeSeconds: number;
	habitat: Habitat;
	creatures: Creature[];
};

/** Inclusive movement-speed range sampled at creature creation. */
export type SpeedRange = {
	min: number;
	max: number;
};

/**
 * Configuration for creating and stepping a simulation.
 * Plain serialisable values only — no RNG closures.
 */
export type SimulationConfig = {
	seed: string;
	/** Habitat generation settings excluding seed (seed comes from this config). */
	habitat: Omit<HabitatGenerationConfig, 'seed'>;
	creatureCount: number;
	movementSpeed: SpeedRange;
	/** Maximum absolute turn rate in radians per simulated second. */
	maxTurnRate: number;
	/** Half-extent margin so creature footprint stays inside bounds and home. */
	creatureRadius: number;
	/** Fixed simulation step duration in seconds. */
	fixedDt: number;
	/** Cap on fixed steps processed per wall-clock catch-up. */
	maxCatchUpSteps: number;
	/** Distance at which a wander target is considered reached. */
	arrivalDistance: number;
};
