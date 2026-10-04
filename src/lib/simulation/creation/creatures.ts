import { createSeededRng, deriveSeed } from '$lib/determinism';
import { featureRect } from '$lib/habitat';
import { replanFromArbitration } from '../behaviour/apply-arbitration';
import { emptyPerception } from '../behaviour/perception';
import { pointTarget } from '../behaviour/resource-awareness';
import { selectPreferredSymbol } from '../communication/emission';
import { sampleSearchTarget } from '../creature-movement';
import { createExplorationState, selectExplorationTarget } from '../exploration';
import { emptyLexicon } from '../learning/lexicon-resolution';
import { createEmptyAssociations } from '../learning/signal-associations';
import { createEmptyMemory, sampleMemoryCapacity } from '../memory/create-memory';
import { emptySocialState } from '../social';
import { createBody } from '../ecology';
import type { Creature, SimulationConfig, SimulationState } from '../types';
import { SimulationCreationError } from './validation';

/**
 * Place a spawn centre inside the home footprint, inset by creatureRadius.
 */
function sampleHomeSpawn(
	home: { position: { x: number; y: number }; size: { width: number; height: number } },
	creatureRadius: number,
	nextRange: (min: number, max: number) => number
): { x: number; y: number } {
	const rect = featureRect(home);
	const minX = rect.minX + creatureRadius;
	const maxX = rect.maxX - creatureRadius;
	const minY = rect.minY + creatureRadius;
	const maxY = rect.maxY - creatureRadius;

	if (minX > maxX || minY > maxY) {
		throw new SimulationCreationError(
			`Home region ${home.size.width}×${home.size.height} is too small for creatureRadius ${creatureRadius}`
		);
	}

	return {
		x: nextRange(minX, maxX),
		y: nextRange(minY, maxY)
	};
}

/** Seed channel for independent per-creature speech-preference sampling. */
export const VERBOSITY_CHANNEL = 'verbosity';

/**
 * Sample lifetime-stable verbosity in [0, 1) from an independent seeded stream.
 * Identical (seed, creatureId) always yields the same value; does not share the
 * creatures placement/speed stream.
 */
export function sampleVerbosity(simulationSeed: string, creatureId: string): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, VERBOSITY_CHANNEL, creatureId));
	return rng.next();
}

/** Seed channel for independent per-creature novelty / optional-information sampling. */
export const CURIOSITY_CHANNEL = 'curiosity';

/**
 * Sample lifetime-stable curiosity in [0, 1) from an independent seeded stream.
 * Identical (seed, creatureId) always yields the same value; independent of
 * verbosity and the creatures placement/speed stream.
 */
export function sampleCuriosity(simulationSeed: string, creatureId: string): number {
	const rng = createSeededRng(deriveSeed(simulationSeed, CURIOSITY_CHANNEL, creatureId));
	return rng.next();
}

export function createCreatures(
	config: SimulationConfig,
	habitat: SimulationState['habitat']
): Creature[] {
	const rng = createSeededRng(deriveSeed(config.seed, 'creatures'));
	const creatures: Creature[] = [];

	for (let i = 0; i < config.creatureCount; i += 1) {
		const id = `creature-${i}`;
		const position = sampleHomeSpawn(habitat.home, config.creatureRadius, (min, max) =>
			rng.nextRange(min, max)
		);
		const facing = rng.nextRange(-Math.PI, Math.PI);
		const movementSpeed = rng.nextRange(config.movementSpeed.min, config.movementSpeed.max);
		const searchDecisionIndex = 0;
		const searchTarget = sampleSearchTarget(
			config.seed,
			id,
			searchDecisionIndex,
			habitat.bounds,
			config.creatureRadius
		);

		// Independent exploration map per creature — never share lastFullySensedAt arrays.
		const explorationBase = createExplorationState(habitat.bounds, config.explorationCellSize);
		const initialExplore = selectExplorationTarget(
			explorationBase.map,
			habitat.bounds,
			position,
			0,
			{
				explorationDistanceWeight: config.explorationDistanceWeight,
				explorationStalenessWeight: config.explorationStalenessWeight,
				explorationStalenessScaleSeconds: config.explorationStalenessScaleSeconds
			}
		);
		const exploration = {
			map: explorationBase.map,
			activeCellIndex: initialExplore.cellIndex
		};

		const preferredSymbolId = selectPreferredSymbol(config.seed, id, config.symbolInventory);
		const memoryCapacity = sampleMemoryCapacity(config.seed, id, config.memoryCapacityRange);
		const verbosity = sampleVerbosity(config.seed, id);
		const curiosity = sampleCuriosity(config.seed, id);

		const draft: Creature = {
			social: emptySocialState(),
			perceivedPeers: [],
			id,
			body: createBody(config.seed, id),
			perceivedWildlife: [],
			position,
			facing,
			movementSpeed,
			verbosity,
			curiosity,
			exploration,
			searchTarget,
			searchDecisionIndex,
			perception: emptyPerception(),
			hunger: config.initialHunger,
			thirst: config.initialThirst,
			energy: config.initialEnergy,
			// Independent memory object per creature — never share references.
			memory: createEmptyMemory(memoryCapacity),
			intention: 'explore',
			action: 'explore',
			target: pointTarget(initialExplore.centre),
			intentionStartedAt: 0,
			actionStartedAt: 0,
			nextReconsiderAt: 0,
			pendingArbitrationTrigger: null,
			lastArbitration: null,
			recentTransitions: [],
			preferredSymbolId,
			emissionCount: 0,
			lastEmissionAt: -1,
			recentEmitted: [],
			recentHeard: [],
			// Independent evidence array and lexicon per creature — never share references.
			symbolAssociations: createEmptyAssociations(config.symbolInventory),
			lexicon: emptyLexicon(),
			recentLexiconChanges: [],
			activeInvestigation: null,
			recentLearning: [],
			activeAnnouncementExecution: null,
			announcementExecutionCounter: 0,
			recentAnnouncementOutcomes: []
		};

		const initial = replanFromArbitration(draft, habitat, 0, 'initial', config, config.seed);

		creatures.push({
			...initial,
			// replanFromArbitration already sets explore target/active cell when explore wins.
			exploration: initial.exploration,
			target:
				initial.intention === 'explore'
					? (initial.target ?? pointTarget(initialExplore.centre))
					: (initial.target ?? pointTarget(initialExplore.centre))
		});
	}

	return creatures;
}
