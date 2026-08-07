/**
 * Deterministic creature facing, translation, bounds clamping and retargeting.
 */

import { createSeededRng, deriveSeed } from '$lib/determinism';
import type { Vec2, WorldBounds } from '$lib/habitat';
import type { Creature, SimulationConfig } from './types';

const TWO_PI = Math.PI * 2;

/** Shortest signed angular delta from `from` to `to`, in (-π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
	let delta = (((to - from) % TWO_PI) + TWO_PI) % TWO_PI;
	if (delta > Math.PI) {
		delta -= TWO_PI;
	}
	return delta;
}

export function normalizeAngle(angle: number): number {
	const wrapped = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
	return wrapped > Math.PI ? wrapped - TWO_PI : wrapped;
}

export function distanceSquared(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

/**
 * Inclusive centre bounds for a point footprint of radius `margin` inside world.
 */
export function interiorPositionBounds(
	bounds: WorldBounds,
	margin: number
): { minX: number; maxX: number; minY: number; maxY: number } {
	const halfW = bounds.width / 2;
	const halfH = bounds.height / 2;
	return {
		minX: -halfW + margin,
		maxX: halfW - margin,
		minY: -halfH + margin,
		maxY: halfH - margin
	};
}

export function clampToInterior(position: Vec2, bounds: WorldBounds, margin: number): Vec2 {
	const box = interiorPositionBounds(bounds, margin);
	return {
		x: Math.min(box.maxX, Math.max(box.minX, position.x)),
		y: Math.min(box.maxY, Math.max(box.minY, position.y))
	};
}

export function sampleInteriorPoint(
	bounds: WorldBounds,
	margin: number,
	nextRange: (min: number, max: number) => number
): Vec2 {
	const box = interiorPositionBounds(bounds, margin);
	if (box.minX > box.maxX || box.minY > box.maxY) {
		throw new Error(
			`Interior margin ${margin} does not fit world ${bounds.width}×${bounds.height}`
		);
	}
	return {
		x: nextRange(box.minX, box.maxX),
		y: nextRange(box.minY, box.maxY)
	};
}

/**
 * Sample a wander target for a creature decision index using a derived seed stream.
 * Does not mutate shared RNG state on the creature or simulation.
 */
export function sampleWanderTarget(
	simulationSeed: string,
	creatureId: string,
	decisionIndex: number,
	bounds: WorldBounds,
	margin: number
): Vec2 {
	const rng = createSeededRng(deriveSeed(simulationSeed, 'wander', creatureId, decisionIndex));
	return sampleInteriorPoint(bounds, margin, (min, max) => rng.nextRange(min, max));
}

/**
 * Sample a search destination using a stream independent of wander.
 * Same bounds/margin rules as wander; semantic ownership remains distinct.
 */
export function sampleSearchTarget(
	simulationSeed: string,
	creatureId: string,
	decisionIndex: number,
	bounds: WorldBounds,
	margin: number
): Vec2 {
	const rng = createSeededRng(deriveSeed(simulationSeed, 'search', creatureId, decisionIndex));
	return sampleInteriorPoint(bounds, margin, (min, max) => rng.nextRange(min, max));
}

/**
 * Turn toward a destination and translate for one fixed step, clamped to interior.
 * Used by behaviour and announcement preparation movement.
 */
export function moveToward(
	creature: Pick<Creature, 'position' | 'facing' | 'movementSpeed'>,
	destination: Vec2,
	dt: number,
	bounds: WorldBounds,
	config: Pick<SimulationConfig, 'maxTurnRate' | 'creatureRadius'>
): Pick<Creature, 'position' | 'facing'> {
	const desiredFacing = Math.atan2(
		destination.y - creature.position.y,
		destination.x - creature.position.x
	);
	const delta = shortestAngleDelta(creature.facing, desiredFacing);
	const maxTurn = config.maxTurnRate * dt;
	const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
	const facing = normalizeAngle(creature.facing + turn);

	const distance = creature.movementSpeed * dt;
	let position = {
		x: creature.position.x + Math.cos(facing) * distance,
		y: creature.position.y + Math.sin(facing) * distance
	};
	position = clampToInterior(position, bounds, config.creatureRadius);
	return { position, facing };
}

/**
 * Pure movement helper: turn toward a wander target, move, clamp, retarget.
 * Behavioural goals/actions are owned by `behaviour/step-creature-behaviour.ts`;
 * this remains available for focused movement tests.
 */
export function stepCreature(
	creature: Creature,
	dt: number,
	simulationSeed: string,
	bounds: WorldBounds,
	config: Pick<SimulationConfig, 'maxTurnRate' | 'creatureRadius' | 'arrivalDistance'>
): Creature {
	let { position, facing, wanderTarget, wanderDecisionIndex } = creature;
	const margin = config.creatureRadius;

	// If already at (or inside) arrival of target, pick the next one first so
	// the step still turns/moves productively.
	const arrivalSq = config.arrivalDistance * config.arrivalDistance;
	if (distanceSquared(position, wanderTarget) <= arrivalSq) {
		wanderDecisionIndex += 1;
		wanderTarget = sampleWanderTarget(
			simulationSeed,
			creature.id,
			wanderDecisionIndex,
			bounds,
			margin
		);
	}

	const desiredFacing = Math.atan2(wanderTarget.y - position.y, wanderTarget.x - position.x);
	const delta = shortestAngleDelta(facing, desiredFacing);
	const maxTurn = config.maxTurnRate * dt;
	const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
	facing = normalizeAngle(facing + turn);

	const distance = creature.movementSpeed * dt;
	position = {
		x: position.x + Math.cos(facing) * distance,
		y: position.y + Math.sin(facing) * distance
	};
	position = clampToInterior(position, bounds, margin);

	// If clamping left us effectively stuck on the boundary with an exterior
	// target, force a fresh interior target so we do not oscillate forever.
	if (distanceSquared(position, wanderTarget) <= arrivalSq) {
		wanderDecisionIndex += 1;
		wanderTarget = sampleWanderTarget(
			simulationSeed,
			creature.id,
			wanderDecisionIndex,
			bounds,
			margin
		);
	}

	return {
		...creature,
		position,
		facing,
		wanderTarget,
		wanderDecisionIndex,
		// Keep behaviour target aligned when only the wander stream moves.
		target:
			creature.goal === 'wander'
				? { kind: 'point', position: { x: wanderTarget.x, y: wanderTarget.y } }
				: creature.target
	};
}
