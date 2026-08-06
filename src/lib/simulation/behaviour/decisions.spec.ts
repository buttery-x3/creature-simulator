import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { testCreature } from '../test-creature';
import {
	commitDecision,
	evaluateCandidates,
	GOAL_TIE_BREAK_ORDER,
	selectBestCandidate,
	WANDER_BASELINE_SCORE
} from './decisions';

const config = defaultSimulationConfig('decisions');

describe('evaluateCandidates', () => {
	it('marks need-driven goals invalid below thresholds and keeps wander valid', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.1, thirst: 0.1, energy: 0.95 }),
			habitat,
			config
		);
		const byGoal = Object.fromEntries(candidates.map((c) => [c.goal, c]));
		expect(byGoal.seek_food?.valid).toBe(false);
		expect(byGoal.seek_water?.valid).toBe(false);
		expect(byGoal.rest?.valid).toBe(false);
		expect(byGoal.wander?.valid).toBe(true);
		expect(byGoal.wander?.score).toBe(WANDER_BASELINE_SCORE);
	});

	it('scores seek_food from hunger and attaches a food feature target', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.9, thirst: 0.1, energy: 0.95 }),
			habitat,
			config
		);
		const food = candidates.find((c) => c.goal === 'seek_food')!;
		expect(food.valid).toBe(true);
		expect(food.score).toBeCloseTo(0.9, 10);
		expect(food.target?.kind).toBe('feature');
		if (food.target && food.target.kind === 'feature') {
			expect(food.target.featureKind).toBe('food');
			const featureId = food.target.featureId;
			expect(habitat.food.some((f) => f.id === featureId)).toBe(true);
		}
	});

	it('targets the home region for rest', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.1, thirst: 0.1, energy: 0.1 }),
			habitat,
			config
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
			config
		);
		expect(selectBestCandidate(candidates).goal).toBe('seek_food');
	});

	it('uses fixed tie-break order when scores are equal', () => {
		const tied = GOAL_TIE_BREAK_ORDER.map((goal) => ({
			goal,
			valid: true,
			score: 0.7,
			reason: 'tied',
			target: null
		}));
		expect(selectBestCandidate(tied).goal).toBe('seek_food');
	});

	it('falls back to wander when no need-driven goal is valid', () => {
		const habitat = createSimulation(config).habitat;
		const candidates = evaluateCandidates(
			testCreature({ hunger: 0.1, thirst: 0.1, energy: 0.95 }),
			habitat,
			config
		);
		expect(selectBestCandidate(candidates).goal).toBe('wander');
	});
});

describe('commitDecision', () => {
	it('records structured evidence matching the selected goal', () => {
		const habitat = createSimulation(config).habitat;
		const creature = testCreature({
			hunger: 0.9,
			thirst: 0.1,
			energy: 0.95,
			goal: 'wander',
			goalStartedAt: 0
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 10,
			trigger: 'reconsider',
			config
		});
		expect(decision.selectedGoal).toBe('seek_food');
		expect(decision.selectionReason.length).toBeGreaterThan(0);
		expect(decision.candidates.length).toBe(4);
		expect(decision.candidates.find((c) => c.goal === decision.selectedGoal)).toBeTruthy();
		expect(decision.trigger).toBe('reconsider');
	});

	it('holds the current goal under small score advantages (hysteresis)', () => {
		const habitat = createSimulation(config).habitat;
		// Current seek_water score 0.5; food at 0.55 — within default margin 0.12
		const creature = testCreature({
			hunger: 0.55,
			thirst: 0.5,
			energy: 0.95,
			goal: 'seek_water',
			goalStartedAt: 0
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 20,
			trigger: 'reconsider',
			config
		});
		expect(decision.selectedGoal).toBe('seek_water');
		expect(decision.selectionReason).toMatch(/hold|margin/i);
	});

	it('does not thrash when commitment has not elapsed', () => {
		const habitat = createSimulation(config).habitat;
		const creature = testCreature({
			hunger: 0.95,
			thirst: 0.1,
			energy: 0.95,
			goal: 'wander',
			goalStartedAt: 10
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 10.5,
			trigger: 'reconsider',
			config
		});
		// Wander may be invalid as "best" but still held if valid — wander is always valid
		// Food is much higher; commitment blocks switch.
		expect(decision.selectedGoal).toBe('wander');
		expect(decision.selectionReason).toMatch(/commitment/i);
	});

	it('switches immediately on action_complete without commitment hold', () => {
		const habitat = createSimulation(config).habitat;
		const creature = testCreature({
			hunger: 0.1,
			thirst: 0.1,
			energy: 0.95,
			goal: 'seek_food',
			goalStartedAt: 10
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 10.1,
			trigger: 'action_complete',
			config
		});
		expect(decision.selectedGoal).toBe('wander');
		expect(decision.trigger).toBe('action_complete');
	});
});
