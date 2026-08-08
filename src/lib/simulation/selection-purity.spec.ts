import { describe, expect, it } from 'vitest';
import {
	createSimulation,
	defaultSimulationConfig,
	formatCreatureInspection,
	simulationSnapshot
} from './index';

describe('selection purity', () => {
	it('formatting inspection does not mutate simulation state', () => {
		const state = createSimulation(defaultSimulationConfig('select-pure'));
		const before = simulationSnapshot(state);
		const creature = state.creatures[0]!;
		const text = formatCreatureInspection(creature, state.timeSeconds);
		expect(text).toContain(creature.id);
		expect(text).toContain('hunger:');
		expect(text).toContain('verbosity:');
		expect(simulationSnapshot(state)).toBe(before);
	});
});
