/**
 * Test-only factory for complete Creature values.
 * Not exported from the public simulation barrel.
 */

import { emptyPerception } from './behaviour/perception';
import { DEFAULT_SYMBOL_INVENTORY } from './communication/types';
import { createExplorationState } from './exploration';
import { emptyLexicon } from './learning/lexicon-resolution';
import { createEmptyAssociations } from './learning/signal-associations';
import { createEmptyMemory } from './memory/create-memory';
import type { Creature } from './types';

const DEFAULT_TEST_BOUNDS = { width: 20, height: 14 };

export function testCreature(overrides: Partial<Creature> = {}): Creature {
	const searchTarget = overrides.searchTarget ?? { x: -1, y: 0 };
	const exploration = overrides.exploration ?? createExplorationState(DEFAULT_TEST_BOUNDS, 2);
	return {
		id: 'creature-0',
		position: { x: 0, y: 0 },
		facing: 0,
		movementSpeed: 1,
		// Talkative default so pure fixtures keep full announce_baseline competitiveness.
		verbosity: 1,
		// Fully curious default so pure fixtures keep full optional investigation competitiveness.
		curiosity: 1,
		exploration,
		searchTarget,
		searchDecisionIndex: 0,
		perception: emptyPerception(),
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		memory: createEmptyMemory(10),
		intention: 'explore',
		action: 'explore',
		target: { kind: 'point', position: { x: 1, y: 0 } },
		intentionStartedAt: 0,
		actionStartedAt: 0,
		nextReconsiderAt: 1.5,
		pendingArbitrationTrigger: null,
		lastArbitration: null,
		recentTransitions: [],
		preferredSymbolId: 'glyph-0',
		emissionCount: 0,
		lastEmissionAt: -1,
		recentEmitted: [],
		recentHeard: [],
		symbolAssociations: createEmptyAssociations(DEFAULT_SYMBOL_INVENTORY),
		lexicon: emptyLexicon(),
		recentLexiconChanges: [],
		activeInvestigation: null,
		recentLearning: [],
		activeAnnouncementExecution: null,
		announcementExecutionCounter: 0,
		recentAnnouncementOutcomes: [],
		...overrides
	};
}
