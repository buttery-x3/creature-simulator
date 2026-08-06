import { describe, expect, it } from 'vitest';
import { generateHabitat } from '$lib/habitat';
import { commitDecision, evaluateCandidates, WANDER_BASELINE_SCORE } from '../behaviour/decisions';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';
import { testCreature } from '../test-creature';
import type { PendingSignal, SymbolAssociation } from './types';

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
	investigationCuriosityBaseline: DEFAULT_SIMULATION_CONFIG.investigationCuriosityBaseline,
	investigationDistanceWeight: DEFAULT_SIMULATION_CONFIG.investigationDistanceWeight,
	investigationAgeWeight: DEFAULT_SIMULATION_CONFIG.investigationAgeWeight
};

function pendingNear(): PendingSignal {
	return {
		emissionId: 'em-near',
		symbolId: 'glyph-0',
		senderId: 'creature-9',
		origin: { x: 1, y: 0 },
		heardAt: 1,
		expiresAt: 20
	};
}

describe('investigate_signal decisions', () => {
	it('includes a valid investigate candidate targeting emission origin', () => {
		const creature = testCreature({
			pendingSignals: [pendingNear()],
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.9
		});
		const candidates = evaluateCandidates(creature, habitat, decisionConfig, 1.5);
		const inv = candidates.find((c) => c.goal === 'investigate_signal');
		expect(inv?.valid).toBe(true);
		expect(inv?.score).toBeGreaterThan(0);
		expect(inv?.target).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
		expect(inv?.score).toBeGreaterThan(WANDER_BASELINE_SCORE - 0.05);
	});

	it('allows commitment to prevent switching into investigation', () => {
		const foodAssoc: SymbolAssociation[] = testCreature().symbolAssociations.map((a) =>
			a.symbolId === 'glyph-0' ? { ...a, foodStrength: 0.9, foodEvidenceCount: 3 } : a
		);
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 10,
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.95,
			pendingSignals: [pendingNear()],
			symbolAssociations: foodAssoc
		});
		// Ordinary reconsider while commitment not met
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

	it('can select investigate when free to reconsider with a pending signal', () => {
		// Ordinary reconsider requires beating wander by goalSwitchMargin; use action_complete
		// (forced replan) so curiosity can win when needs are mild.
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			nextReconsiderAt: 0,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [
				{
					...pendingNear(),
					heardAt: 5,
					expiresAt: 20
				}
			]
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 5,
			trigger: 'action_complete',
			config: decisionConfig
		});
		// Curiosity baseline 0.4 > wander 0.35 and needs below thresholds
		expect(decision.selectedGoal).toBe('investigate_signal');
		expect(decision.selectedTarget).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
	});
});
