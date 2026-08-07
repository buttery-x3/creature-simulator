import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { testCreature } from '../test-creature';
import { emptyPerception, senseAt } from './perception';
import {
	commitDecision,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	selectBestCandidate,
	WANDER_BASELINE_SCORE
} from './decisions';
import { actionForGoal } from './actions';

const config = defaultSimulationConfig('decisions');

describe('evaluateCandidates', () => {
	it('marks need-driven goals invalid below thresholds and keeps wander valid', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.1, thirst: 0.1, energy: 0.95 }),
			habitat,
			config,
			0
		);
		const byGoal = Object.fromEntries(candidates.map((c) => [c.goal, c]));
		expect(byGoal.seek_food?.valid).toBe(false);
		expect(byGoal.seek_water?.valid).toBe(false);
		expect(byGoal.rest?.valid).toBe(false);
		expect(byGoal.wander?.valid).toBe(true);
		expect(byGoal.wander?.score).toBe(WANDER_BASELINE_SCORE);
	});

	it('keeps seek_food valid when hungry even with no perceived food', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({
				hunger: 0.9,
				thirst: 0.1,
				energy: 0.95,
				perception: emptyPerception()
			}),
			habitat,
			config,
			0
		);
		const food = candidates.find((c) => c.goal === 'seek_food')!;
		expect(food.valid).toBe(true);
		expect(food.score).toBeCloseTo(0.9, 10);
		expect(food.target).toBeNull();
		expect(food.reason).toMatch(/will search/i);
	});

	it('attaches a food feature target only when perceived', () => {
		const habitat = createSimulation(config).habitat;
		const foodFeature = habitat.food[0]!;
		const perception = senseAt(foodFeature.position, habitat, 1, {
			sensingRadius: config.sensingRadius
		}).perception;
		const candidates = evaluateCandidates(
			testCreature({
				position: { ...foodFeature.position },
				hunger: 0.9,
				thirst: 0.1,
				energy: 0.95,
				perception
			}),
			habitat,
			config,
			1
		);
		const food = candidates.find((c) => c.goal === 'seek_food')!;
		expect(food.valid).toBe(true);
		expect(food.target?.kind).toBe('feature');
		if (food.target && food.target.kind === 'feature') {
			expect(food.target.featureKind).toBe('food');
			expect(food.target.featureId).toBe(foodFeature.id);
		}
	});

	it('targets the home region for rest regardless of sensing distance', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({
				hunger: 0.1,
				thirst: 0.1,
				energy: 0.1,
				position: { x: 100, y: 100 },
				perception: emptyPerception()
			}),
			habitat,
			config,
			0
		);
		const rest = candidates.find((c) => c.goal === 'rest')!;
		expect(rest.valid).toBe(true);
		expect(rest.target).toEqual({
			kind: 'feature',
			featureId: habitat.home.id,
			featureKind: 'home'
		});
	});
});

describe('selectBestCandidate', () => {
	it('picks the highest valid need-driven goal', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.95, thirst: 0.5, energy: 0.9 }),
			habitat,
			config,
			0
		);
		expect(selectBestCandidate(candidates).goal).toBe('seek_food');
	});

	it('uses fixed tie-break order when scores are equal', () => {
		const tied = GOAL_TIE_BREAK_ORDER.map((goal) => ({
			goal,
			valid: true,
			score: 0.7,
			reason: 'tie',
			target: null
		}));
		expect(selectBestCandidate(tied).goal).toBe('seek_food');
	});
});

describe('actionForGoal with search', () => {
	it('returns search when seek_food has no usable feature target', () => {
		expect(actionForGoal('seek_food', false, false)).toBe('search');
		expect(actionForGoal('seek_water', false, false)).toBe('search');
	});

	it('returns move when a feature target is available', () => {
		expect(actionForGoal('seek_food', false, true)).toBe('move');
		expect(actionForGoal('seek_food', true, true)).toBe('eat');
	});
});

describe('commitDecision', () => {
	it('selects seek_food with null target when hungry and nothing perceived', () => {
		const habitat = createSimulation(config).habitat;
		const decision = commitDecision({
			creature: testCreature({
				hunger: 0.9,
				thirst: 0.1,
				energy: 0.95,
				perception: emptyPerception()
			}),
			habitat,
			timeSeconds: 0,
			trigger: 'initial',
			config
		});
		expect(decision.selectedGoal).toBe('seek_food');
		expect(decision.selectedTarget).toBeNull();
	});
});
