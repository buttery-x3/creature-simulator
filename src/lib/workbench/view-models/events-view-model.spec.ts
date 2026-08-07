import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_FILTER } from '../workbench-types';
import { buildEventRows, filterEventRows } from './events-view-model';

describe('events-view-model', () => {
	it('builds sorted rows from bounded histories without mutating state', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		const before = JSON.stringify(state);
		const rows = buildEventRows(state);
		expect(JSON.stringify(state)).toBe(before);
		expect(Array.isArray(rows)).toBe(true);
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i]!.timeSeconds).toBeGreaterThanOrEqual(rows[i - 1]!.timeSeconds);
		}
	});

	it('filters by category and creature', () => {
		const state = createSimulation(defaultSimulationConfig('demo'));
		// Seed a transition on first creature for a stable filter target.
		const creature = state.creatures[0]!;
		creature.recentTransitions = [
			{
				timeSeconds: 1,
				fromGoal: 'wander',
				toGoal: 'seek_food',
				fromAction: 'wander',
				toAction: 'move',
				reason: 'test'
			}
		];
		const rows = buildEventRows(state);
		const filtered = filterEventRows(
			rows,
			{ ...DEFAULT_EVENT_FILTER, category: 'Behaviour', creatureId: creature.id },
			state.timeSeconds
		);
		expect(filtered.length).toBeGreaterThan(0);
		expect(filtered.every((r) => r.category === 'Behaviour' && r.creatureId === creature.id)).toBe(
			true
		);
	});
});
