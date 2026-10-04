/**
 * Pure Overview aggregates for the workbench dashboard.
 * Observational only — does not mutate simulation state.
 */

import type { Creature, IntentionKind, SimulationState } from '$lib/simulation';

export type NeedExtremum = {
	value: number;
	creatureId: string;
};

export type PopulationWellbeing = {
	creatureCount: number;
	averageHunger: number;
	averageThirst: number;
	averageEnergy: number;
	highestHunger: NeedExtremum | null;
	highestThirst: NeedExtremum | null;
	lowestEnergy: NeedExtremum | null;
};

export type BehaviourSnapshot = {
	byIntention: Record<IntentionKind, number>;
};

export type WorldSnapshot = {
	worldWidth: number;
	worldHeight: number;
	foodCount: number;
	waterCount: number;
	homeCount: number;
	/** All living wildlife; danger depends on the observer and encounter. */
	wildlifeCount: number;
	activeAnnouncementCount: number;
};

export type OverviewAlert = {
	id: string;
	severity: 'info' | 'warning';
	message: string;
};

export type PopulationLifecycle = {
	averageAgeSeconds: number;
	youngestAgeSeconds: number | null;
	oldestAgeSeconds: number | null;
	highestGeneration: number | null;
	recentBirthCount: number;
	recentDeathCount: number;
	recentCourtshipFailureCount: number;
};

export type OverviewViewModel = {
	population: PopulationLifecycle;
	wellbeing: PopulationWellbeing;
	behaviour: BehaviourSnapshot;
	world: WorldSnapshot;
	alerts: OverviewAlert[];
};

const INTENTIONS: readonly IntentionKind[] = [
	'explore',
	'satisfy_hunger',
	'satisfy_thirst',
	'rest',
	'investigate_signal',
	'announce_resource',
	'flee',
	'hunt',
	'warn_danger',
	'avoid_danger',
	'approach_peer',
	'court_peer',
	'dance',
	'cry'
] as const;

function emptyIntentionCounts(): Record<IntentionKind, number> {
	return {
		explore: 0,
		satisfy_hunger: 0,
		satisfy_thirst: 0,
		rest: 0,
		investigate_signal: 0,
		announce_resource: 0,
		flee: 0,
		hunt: 0,
		warn_danger: 0,
		avoid_danger: 0,
		approach_peer: 0,
		court_peer: 0,
		dance: 0,
		cry: 0
	};
}

function mean(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function highestBy(
	creatures: readonly Creature[],
	pick: (c: Creature) => number
): NeedExtremum | null {
	if (creatures.length === 0) {
		return null;
	}
	let best = creatures[0]!;
	let bestValue = pick(best);
	for (let i = 1; i < creatures.length; i++) {
		const c = creatures[i]!;
		const v = pick(c);
		if (v > bestValue) {
			best = c;
			bestValue = v;
		}
	}
	return { value: bestValue, creatureId: best.id };
}

function lowestBy(
	creatures: readonly Creature[],
	pick: (c: Creature) => number
): NeedExtremum | null {
	if (creatures.length === 0) {
		return null;
	}
	let best = creatures[0]!;
	let bestValue = pick(best);
	for (let i = 1; i < creatures.length; i++) {
		const c = creatures[i]!;
		const v = pick(c);
		if (v < bestValue) {
			best = c;
			bestValue = v;
		}
	}
	return { value: bestValue, creatureId: best.id };
}

/**
 * Derive overview dashboard metrics from authoritative simulation state.
 */
export function buildOverviewViewModel(state: SimulationState): OverviewViewModel {
	const creatures = state.creatures;
	const n = creatures.length;

	const wellbeing: PopulationWellbeing = {
		creatureCount: n,
		averageHunger: mean(creatures.map((c) => c.hunger)),
		averageThirst: mean(creatures.map((c) => c.thirst)),
		averageEnergy: mean(creatures.map((c) => c.energy)),
		highestHunger: highestBy(creatures, (c) => c.hunger),
		highestThirst: highestBy(creatures, (c) => c.thirst),
		lowestEnergy: lowestBy(creatures, (c) => c.energy)
	};

	const byIntention = emptyIntentionCounts();
	for (const creature of creatures) {
		byIntention[creature.intention] = (byIntention[creature.intention] ?? 0) + 1;
	}
	// Ensure every known intention key is present for stable UI.
	for (const intention of INTENTIONS) {
		byIntention[intention] = byIntention[intention] ?? 0;
	}

	const world: WorldSnapshot = {
		worldWidth: state.habitat.bounds.width,
		worldHeight: state.habitat.bounds.height,
		foodCount: state.habitat.food.length,
		waterCount: state.habitat.water.length,
		homeCount: 1,
		wildlifeCount: state.wildlife.filter((animal) => animal.health > 0).length,
		activeAnnouncementCount: state.activeEmissions.length
	};

	const alerts = buildAlerts(state);

	const ages = creatures.map((c) => c.lifecycle.ageSeconds);
	const population: PopulationLifecycle = {
		averageAgeSeconds: mean(ages),
		youngestAgeSeconds: n ? Math.min(...ages) : null,
		oldestAgeSeconds: n ? Math.max(...ages) : null,
		highestGeneration: n ? Math.max(...creatures.map((c) => c.lifecycle.generation)) : null,
		recentBirthCount: state.recentLifeEvents.filter((event) => event.kind === 'birth').length,
		recentDeathCount: state.recentLifeEvents.filter((event) => event.kind === 'death').length,
		recentCourtshipFailureCount: state.recentLifeEvents.filter(
			(event) => event.kind === 'courtship_failed'
		).length
	};
	return { wellbeing, behaviour: { byIntention }, world, alerts, population };
}

function buildAlerts(state: SimulationState): OverviewAlert[] {
	const alerts: OverviewAlert[] = [];
	const creatures = state.creatures;

	for (const creature of creatures) {
		if (creature.hunger >= 0.999) {
			alerts.push({
				id: `max-hunger-${creature.id}`,
				severity: 'warning',
				message: `${creature.id} at maximum hunger pressure`
			});
		}
		if (creature.thirst >= 0.999) {
			alerts.push({
				id: `max-thirst-${creature.id}`,
				severity: 'warning',
				message: `${creature.id} at maximum thirst pressure`
			});
		}
		if (creature.energy <= 0.001) {
			alerts.push({
				id: `min-energy-${creature.id}`,
				severity: 'warning',
				message: `${creature.id} at minimum energy`
			});
		}
		if (creature.activeInvestigation) {
			const duration = state.timeSeconds - creature.activeInvestigation.startedAt;
			if (duration >= 30) {
				alerts.push({
					id: `long-investigation-${creature.id}`,
					severity: 'info',
					message: `${creature.id} investigating for ${duration.toFixed(1)}s`
				});
			}
		}
	}

	const anyRecentEmission = creatures.some((c) => c.recentEmitted.length > 0);
	const anyRecentLearning = creatures.some((c) => c.recentLearning.length > 0);

	if (nCreatures(creatures) > 0 && !anyRecentEmission && state.timeSeconds > 5) {
		alerts.push({
			id: 'no-recent-emissions',
			severity: 'info',
			message: 'No recent emissions in bounded creature histories'
		});
	}
	if (nCreatures(creatures) > 0 && !anyRecentLearning && state.timeSeconds > 10) {
		alerts.push({
			id: 'no-recent-learning',
			severity: 'info',
			message: 'No recent learning outcomes in bounded creature histories'
		});
	}

	return alerts.slice(0, 12);
}

function nCreatures(creatures: readonly Creature[]): number {
	return creatures.length;
}
