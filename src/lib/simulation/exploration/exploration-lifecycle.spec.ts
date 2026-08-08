/**
 * Integration coverage for explore enter/continue/interrupt and sensing completion.
 */

import { describe, expect, it } from 'vitest';
import { replanFromArbitration } from '../behaviour/apply-arbitration';
import { stepCreatureBehaviour } from '../behaviour/step-creature-behaviour';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { testCreature } from '../test-creature';
import { cellCentre, createExplorationState, selectExplorationTarget } from './index';

describe('exploration lifecycle', () => {
	it('preserves active cell across re-arbitration when still exploring', () => {
		const config = defaultSimulationConfig('explore-continue');
		const state = createSimulation(config);
		const creature = state.creatures[0]!;
		// Force explore with known active cell.
		const forced = {
			...creature,
			hunger: 0,
			thirst: 0,
			energy: 1,
			intention: 'explore' as const,
			action: 'explore' as const,
			exploration: {
				map: creature.exploration.map,
				activeCellIndex: 5
			},
			target: {
				kind: 'point' as const,
				position: cellCentre(state.habitat.bounds, creature.exploration.map, 5)
			},
			nextReconsiderAt: 0
		};
		const next = replanFromArbitration(forced, state.habitat, 1, 'periodic', config, config.seed);
		expect(next.intention).toBe('explore');
		expect(next.exploration.activeCellIndex).toBe(5);
	});

	it('clears active cell when switching away from explore', () => {
		const config = defaultSimulationConfig('explore-interrupt');
		const state = createSimulation(config);
		const habitat = state.habitat;
		const food = habitat.food[0];
		if (!food) {
			// Habitat always has food under default config.
			expect(food).toBeTruthy();
			return;
		}
		const creature = testCreature({
			position: { ...food.position },
			hunger: 0.9,
			thirst: 0,
			energy: 1,
			intention: 'explore',
			action: 'explore',
			exploration: {
				map: createExplorationState(habitat.bounds, config.explorationCellSize).map,
				activeCellIndex: 3
			},
			perception: {
				lastUpdatedAt: 0,
				perceivedFoodIds: [food.id],
				perceivedWaterIds: [],
				observations: [
					{
						featureId: food.id,
						featureKind: 'food',
						position: { ...food.position },
						observedAt: 0
					}
				]
			},
			nextReconsiderAt: 0
		});
		const next = replanFromArbitration(creature, habitat, 1, 'periodic', config, config.seed);
		expect(next.intention).not.toBe('explore');
		expect(next.exploration.activeCellIndex).toBeNull();
	});

	it('retargets when a sensing pass fully senses the active cell before arrival', () => {
		const config = defaultSimulationConfig('explore-complete');
		const state = createSimulation(config);
		const bounds = state.habitat.bounds;
		const map = createExplorationState(bounds, config.explorationCellSize).map;
		// Choose cell 0; place creature at its centre so sensing completes immediately.
		const centre = cellCentre(bounds, map, 0);
		const creature = testCreature({
			position: { ...centre },
			facing: 0,
			movementSpeed: 0.01,
			// Quiet + sated so perception of nearby food cannot steal explore via announce.
			verbosity: 0,
			curiosity: 0,
			hunger: 0,
			thirst: 0,
			energy: 1,
			intention: 'explore',
			action: 'explore',
			exploration: { map, activeCellIndex: 0 },
			// Far destination so we are not "at target" for other reasons.
			target: { kind: 'point', position: { x: centre.x + 5, y: centre.y } },
			// Never updated → sensing pass runs on this step.
			perception: {
				lastUpdatedAt: -1,
				perceivedFoodIds: [],
				perceivedWaterIds: [],
				observations: []
			},
			// Suppress ordinary re-arbitration; still allow sensing-driven retarget.
			nextReconsiderAt: 999,
			pendingArbitrationTrigger: null
		});

		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			state.habitat,
			config
		);
		expect(result.creature.exploration.map.lastFullySensedAt[0]).toBe(1);
		// Must have selected a new active cell (just-sensed staleness 0 loses to neighbours).
		expect(result.creature.exploration.activeCellIndex).not.toBeNull();
		expect(result.creature.exploration.activeCellIndex).not.toBe(0);
		const selection = selectExplorationTarget(
			result.creature.exploration.map,
			bounds,
			result.creature.position,
			1,
			{
				explorationDistanceWeight: config.explorationDistanceWeight,
				explorationStalenessWeight: config.explorationStalenessWeight,
				explorationStalenessScaleSeconds: config.explorationStalenessScaleSeconds
			}
		);
		expect(result.creature.exploration.activeCellIndex).toBe(selection.cellIndex);
	});

	it('does not mutate exploration timestamps between sensing passes', () => {
		const config = {
			...defaultSimulationConfig('explore-no-update'),
			perceptionIntervalSeconds: 10
		};
		const state = createSimulation(config);
		const creature = {
			...state.creatures[0]!,
			perception: {
				...state.creatures[0]!.perception,
				lastUpdatedAt: 0
			},
			nextReconsiderAt: 999
		};
		const before = creature.exploration.map.lastFullySensedAt.slice();
		const result = stepCreatureBehaviour(
			creature,
			config.fixedDt,
			1,
			config.seed,
			state.habitat,
			config
		);
		// timeSeconds 1 - lastUpdated 0 < 10 interval → no sensing pass.
		expect(result.creature.exploration.map.lastFullySensedAt).toEqual(before);
	});
});
