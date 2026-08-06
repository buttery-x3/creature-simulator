/**
 * Test-only factory for complete Creature values.
 * Not exported from the public simulation barrel.
 */

import { emptyPerception } from './behaviour/perception';
import type { Creature } from './types';

export function testCreature(overrides: Partial<Creature> = {}): Creature {
	const wanderTarget = overrides.wanderTarget ?? { x: 1, y: 0 };
	const searchTarget = overrides.searchTarget ?? { x: -1, y: 0 };
	return {
		id: 'creature-0',
		position: { x: 0, y: 0 },
		facing: 0,
		movementSpeed: 1,
		wanderTarget,
		wanderDecisionIndex: 0,
		searchTarget,
		searchDecisionIndex: 0,
		perception: emptyPerception(),
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		goal: 'wander',
		action: 'wander',
		target: { kind: 'point', position: { ...wanderTarget } },
		goalStartedAt: 0,
		actionStartedAt: 0,
		nextReconsiderAt: 1.5,
		lastDecision: null,
		lastCandidates: [],
		recentTransitions: [],
		...overrides
	};
}
