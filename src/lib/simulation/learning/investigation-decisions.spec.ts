import { describe, expect, it } from 'vitest';
import { generateHabitat } from '$lib/habitat';
import {
	commitDecision,
	evaluateCandidates,
	INVESTIGATION_ELIGIBLE_SCORE,
	isExploreExemption,
	WANDER_BASELINE_SCORE
} from '../behaviour/decisions';
import { DEFAULT_SIMULATION_CONFIG } from '../create-simulation';
import { testCreature } from '../test-creature';
import type { SignalInvestigationOpportunity } from './types';

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
	trackedObservationDurationSeconds: DEFAULT_SIMULATION_CONFIG.trackedObservationDurationSeconds
};

function acceptedNear(): SignalInvestigationOpportunity {
	return {
		emissionId: 'em-near',
		symbolId: 'glyph-0',
		senderId: 'creature-9',
		origin: { x: 1, y: 0 },
		heardAt: 5,
		expiresAt: 30,
		curiosityDecision: 'accepted',
		curiosityEvidence: { curiosity: 0.5, deterministicSample: 0.1 }
	};
}

function rejectedNear(): SignalInvestigationOpportunity {
	return {
		...acceptedNear(),
		emissionId: 'em-rej',
		curiosityDecision: 'rejected',
		curiosityEvidence: { curiosity: 0.2, deterministicSample: 0.9 }
	};
}

describe('investigate_signal decisions (curiosity opportunities)', () => {
	it('includes a valid investigate candidate for an accepted opportunity', () => {
		const creature = testCreature({
			pendingSignals: [acceptedNear()],
			curiosity: 0.5,
			hunger: 0.2,
			thirst: 0.2,
			energy: 0.9
		});
		const candidates = evaluateCandidates(creature, habitat, decisionConfig, 5);
		const inv = candidates.find((c) => c.goal === 'investigate_signal');
		expect(inv?.valid).toBe(true);
		expect(inv?.score).toBe(INVESTIGATION_ELIGIBLE_SCORE);
		expect(inv?.score).toBe(WANDER_BASELINE_SCORE);
		expect(inv?.target).toEqual({ kind: 'point', position: { x: 1, y: 0 } });
		expect(inv?.reason).toMatch(/curiosity accepted/);
	});

	it('does not treat rejected opportunities as valid investigation candidates', () => {
		const creature = testCreature({
			pendingSignals: [rejectedNear()],
			curiosity: 0.2,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95
		});
		const candidates = evaluateCandidates(creature, habitat, decisionConfig, 5);
		const inv = candidates.find((c) => c.goal === 'investigate_signal');
		expect(inv?.valid).toBe(false);
		expect(inv?.rejectionReason).toMatch(/rejected/);
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
			pendingSignals: [acceptedNear()]
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

	it('selects an accepted opportunity from ordinary wander reconsideration', () => {
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			nextReconsiderAt: 0,
			curiosity: 0.5,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [acceptedNear()]
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

	it('continues wander when the only opportunity is rejected', () => {
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			curiosity: 0.1,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [rejectedNear()]
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		expect(decision.selectedGoal).toBe('wander');
		expect(decision.candidates.find((c) => c.goal === 'investigate_signal')?.valid).toBe(false);
	});

	it('can accept curiosity but not select investigation when a need goal wins', () => {
		const creature = testCreature({
			goal: 'wander',
			action: 'wander',
			goalStartedAt: 0,
			curiosity: 0.8,
			hunger: 0.95,
			thirst: 0.15,
			energy: 0.95,
			pendingSignals: [acceptedNear()]
		});
		const decision = commitDecision({
			creature,
			habitat,
			timeSeconds: 5,
			trigger: 'reconsider',
			config: decisionConfig
		});
		const inv = decision.candidates.find((c) => c.goal === 'investigate_signal')!;
		expect(inv.valid).toBe(true);
		expect(inv.reason).toMatch(/curiosity accepted/);
		expect(decision.selectedGoal).toBe('seek_food');
		expect(inv.rejectionReason).toMatch(/not selected/);
	});

	it('treats distant accepted opportunities the same as near ones for eligibility score', () => {
		const far: SignalInvestigationOpportunity = {
			...acceptedNear(),
			emissionId: 'em-far',
			origin: { x: 20, y: 0 }
		};
		const nearCreature = testCreature({
			pendingSignals: [acceptedNear()],
			curiosity: 0.5,
			hunger: 0.15,
			thirst: 0.15,
			energy: 0.95
		});
		const farCreature = testCreature({
			...nearCreature,
			pendingSignals: [far]
		});
		const nearInv = evaluateCandidates(nearCreature, habitat, decisionConfig, 5).find(
			(c) => c.goal === 'investigate_signal'
		)!;
		const farInv = evaluateCandidates(farCreature, habitat, decisionConfig, 5).find(
			(c) => c.goal === 'investigate_signal'
		)!;
		expect(nearInv.valid).toBe(true);
		expect(farInv.valid).toBe(true);
		expect(nearInv.score).toBe(farInv.score);
		expect(nearInv.reason).not.toMatch(/distance/i);
		expect(farInv.reason).not.toMatch(/distance/i);
	});
});
