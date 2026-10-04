import type { Creature } from '../types';
import { SOCIAL_DEFAULTS } from './defaults';
import type { MoodSnapshot, PeerObservation, SocialState } from './types';

export type MoodInput = {
	hunger: number;
	thirst: number;
	energy: number;
	body: { health: number };
	social: SocialState;
	perceivedPeers: readonly PeerObservation[];
};

const unit = (value: number) => Math.max(0, Math.min(1, value));

export function deriveMood(input: MoodInput): MoodSnapshot {
	const company = input.perceivedPeers.reduce((best, peer) => {
		const relationship = input.social.relationships.find((row) => row.peerId === peer.id);
		return Math.max(
			best,
			(relationship?.familiarity ?? 0) * Math.max(0, relationship?.liking ?? 0)
		);
	}, 0);
	const comfort = Math.pow(
		unit((1 - input.hunger) * (1 - input.thirst) * input.energy * input.body.health),
		0.25
	);
	const distress = unit(
		Math.max(
			input.hunger * 0.7,
			input.thirst * 0.7,
			(1 - input.energy) * 0.6,
			1 - input.body.health,
			input.social.recentPain
		)
	);
	const positive = unit((comfort - 0.35) / 0.65 + company * 0.15 - input.social.recentPain);
	return { comfort, distress, positive, company, valence: positive - distress };
}

export function advanceSocial(social: SocialState, dt: number, timeSeconds: number): SocialState {
	return {
		...social,
		recentPain: unit(social.recentPain - Math.max(0, dt) * SOCIAL_DEFAULTS.painDecayPerSecond),
		expression:
			social.expression && social.expression.expiresAt > timeSeconds ? social.expression : null,
		relationships: social.relationships.filter(
			(row) => timeSeconds - row.lastSeenAt < SOCIAL_DEFAULTS.relationshipLifetimeSeconds
		)
	};
}

/** Personal received injury only; no blame assigned to peers who happen to be nearby. */
export function recordInjury(social: SocialState, amount: number): SocialState {
	return { ...social, recentPain: unit(social.recentPain + Math.max(0, amount) * 3) };
}

/** Executes a selected action, never chooses it. Aborting consumes the start cooldown. */
export function executeExpression(creature: Creature, timeSeconds: number): Creature {
	const kind = creature.action === 'court' ? 'dance' : creature.action;
	const active = creature.social.expression;
	if (kind !== 'dance' && kind !== 'cry') {
		return active ? { ...creature, social: { ...creature.social, expression: null } } : creature;
	}
	if (active?.kind === kind && active.expiresAt > timeSeconds) return creature;
	if (timeSeconds < creature.social.nextExpressionAt) {
		return active ? { ...creature, social: { ...creature.social, expression: null } } : creature;
	}
	const mood = deriveMood(creature);
	const sequence = creature.social.expressionSequence;
	return {
		...creature,
		energy: Math.max(0, creature.energy - SOCIAL_DEFAULTS.expressionEnergyCost),
		social: {
			...creature.social,
			expressionSequence: sequence + 1,
			nextExpressionAt: timeSeconds + SOCIAL_DEFAULTS.expressionCooldownSeconds,
			expression: {
				id: `${creature.id}:expression:${sequence}`,
				kind,
				startedAt: timeSeconds,
				expiresAt: timeSeconds + SOCIAL_DEFAULTS.expressionDurationSeconds,
				intensity: kind === 'dance' ? mood.positive : mood.distress
			}
		}
	};
}
