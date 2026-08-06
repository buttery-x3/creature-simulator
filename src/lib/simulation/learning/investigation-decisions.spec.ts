import { describe, expect, it } from 'vitest';
import { generateHabitat } from '$lib/habitat';
import {
	commitDecision,
	evaluateCandidates,
	isExploreExemption,
	WANDER_BASELINE_SCORE
} from '../behaviour/decisions';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';
import { testCreature } from '../test-creature';
import type { PendingSignal } from './types';

const habitat = generateHabitat({
	...DEFAULT_SIMULATION_CONFIG.habitat,
	seed: 'investigate-decisions'
});

const decisionConfig = {
	seekFoodThreshold: DEFAULT_SIMULATION_CONFIG.seekFoodThreshold,
	seekWaterThreshold: DEFAULT_SIMULATION_CONFIG.seekWaterThreshold,
	restThreshold: DEFAULT_SIMULATION_CONFIG.restThreshold,
	goalSwitchMargin: DEFAULT_SIMULATION_CONFIG.goalSwitchMargin,
	minGoalCommitmentSeconds: DEFAULT_SIMULATION_CONFIG.minGoalCommitmentSeconds,
	reconsiderIntervalSeconds: DEFAULT_SIMULATION_CONFIG.reconsiderIntervalSeconds,
	trackedObservationDurationSeconds: DEFAULT_SIMULATION_CONFIG.trackedObservationDurationSeconds,
	pendingSignalLifetimeSeconds: DEFAULT_SIMULATION_CONFIG.pendingSignalLifetimeSeconds,
	investigationCuriosityWeight: DEFAULT_SIMULATION_CONFIG.investigationCuriosityWeight,
	investigationDistanceScale: DEFAULT_SIMULATION_CONFIG.investigationDistanceScale,
	investigationAgeWeight: DEFAULT_SIMULATION_CONFIG.investigationAgeWeight
};

function pendingNear(): PendingSignal {
	return {
		emissionId: 'em-near',
		symbolId: 'glyph-0',
		senderId: 'creature-9',
		origin: { x: 1, y: 0 },
		heardAt: 5,
		expiresAt: 30
	};
}

describe('investigate_signal decisions', () => {
	it('includes a valid investigate candidate targeting emission origin', () => {
		const creature = testCreature({
			pendingSignals: [pendingNear()],
			curiosity: 0.5,
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.9
		});
		const candidates = evaluateCandidates(creature, habitat, decisionConfig, 5);
		const inv = candidates.find((c) => c.goal === 'investigate_signal');
		expect(inv?.valid).toBe(true);
		expect(inv?.score).toBeGreaterThan(0);
		expect(inv?.target).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
		expect(inv!.score).toBeGreaterThan(WANDER_BASELINE_SCORE - 0.2);
	});

	it('documents explore exemption for wander → investigate_signal', () => {
		expect(isExploreExemption('wander', 'investigate_signal')).toBe(true);
		expect(isExploreExemption('seek_food', 'investigate_signal')).toBe(false);
		expect(isExploreExemption('wander', 'seek_food')).toBe(false);
	});

	it('allows commitment to prevent switching into investigation too early', () => {
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 10,
			curiosity: 0.55,
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.95,
			pendingSignals: [pendingNear()]
		});
		const held = commitDecision({
			creature,
			habitat,
			timeSeconds: 10.5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		expect(held.selectedGoal).toBe('wander');
		expect(held.selectionReason).toMatch(/commitment/);
	});

	it('selects an unknown pending signal from ordinary wander reconsideration', () => {
		// Not action_complete / invalid_target — explore exemption waives margin only.
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			nextReconsiderAt: 0,
			curiosity: 0.5,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [pendingNear()]
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		expect(decision.selectedGoal).toBe('investigate_signal');
		expect(decision.selectedTarget).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
		expect(decision.selectionReason).toMatch(/explore exemption|investigate_signal/);
	});

	it('allows a highly curious creature to select a more distant unknown signal', () => {
		// Mid-range: high curiosity × distanceFactor can still beat wander; low curiosity cannot.
		const midRange: PendingSignal = {
			emissionId: 'em-mid',
			symbolId: 'glyph-1',
			senderId: 'creature-9',
			origin: { x: 4, y: 0 },
			heardAt: 5,
			expiresAt: 30
		};
		const curious = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			curiosity: 0.55,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [midRange]
		});
		const shy = testCreature({
			...curious,
			curiosity: 0.3
		});
		const curiousDecision = commitDecision({
			creature: curious,
			habitat,
			timeSeconds: 5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		const shyDecision = commitDecision({
			creature: shy,
			habitat,
			timeSeconds: 5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		const curiousScore = curiousDecision.candidates.find(
			(c) => c.goal === 'investigate_signal'
		)!.score;
		const shyScore = shyDecision.candidates.find((c) => c.goal === 'investigate_signal')!.score;
		expect(curiousScore).toBeGreaterThan(shyScore);
		expect(curiousDecision.selectedGoal).toBe('investigate_signal');
		expect(shyDecision.selectedGoal).toBe('wander');
	});
});
