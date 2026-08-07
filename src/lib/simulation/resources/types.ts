/**
 * Runtime resource lifecycle and minimal weather state.
 * Plain JSON-serialisable values only — no RNG closures or presentation.
 */

/** Minimal weather: clear or rain. No storms, seasons, or hydrology. */
export type WeatherPhase = 'clear' | 'rain';

export type FoodSpawnOutcome =
	'spawned' | 'skipped_at_cap' | 'skipped_not_due' | 'placement_failed' | null;

/**
 * Authoritative environment clocks and counters for resources/weather.
 * Reset/regeneration must restore a deterministic initial schedule.
 */
export type EnvironmentState = {
	weather: WeatherPhase;
	/**
	 * When rain ends (simulation seconds). Meaningful while weather === 'rain'.
	 * While clear, equals the previous rain end or 0 at start.
	 */
	weatherPhaseEndsAt: number;
	/** Next simulation time at which rain begins while clear. */
	nextRainAt: number;
	/** Monotonic rain schedule index for seed derivation. */
	rainEventIndex: number;
	/** Next simulation time for a food-spawn opportunity. */
	nextFoodSpawnAt: number;
	/** Monotonic food-spawn index for seed derivation and new feature ids. */
	foodSpawnEventIndex: number;
	/**
	 * Next serial for runtime food ids (`food-runtime-${serial}`).
	 * Never reuses depleted initial or prior runtime ids.
	 */
	nextFoodSerial: number;
	/** Last food-spawn attempt outcome (diagnostics). */
	lastFoodSpawnOutcome: FoodSpawnOutcome;
	/** Simulation time of last food-spawn attempt, if any. */
	lastFoodSpawnAt: number | null;
};

/** Per-creature quantity actually withdrawn this fixed step (need recovery units). */
export type ConsumptionGrant = {
	food: number;
	water: number;
};

export function emptyGrant(): ConsumptionGrant {
	return { food: 0, water: 0 };
}
