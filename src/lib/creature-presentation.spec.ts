import { describe, expect, it } from 'vitest';
import type { Creature, CreatureAction } from '$lib/simulation';
import { createCreaturePresentationResources, reconcileCreatures } from './creature-presentation';

function creature(
	id: string,
	x: number,
	y: number,
	facing = 0,
	action: CreatureAction = 'wander'
): Creature {
	return {
		id,
		position: { x, y },
		facing,
		movementSpeed: 1,
		wanderTarget: { x: x + 1, y },
		wanderDecisionIndex: 0,
		searchTarget: { x: x - 1, y },
		searchDecisionIndex: 0,
		perception: {
			lastUpdatedAt: -1,
			perceivedFoodIds: [],
			perceivedWaterIds: [],
			observations: [],
			tracked: null
		},
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		curiosity: 0.45,
		goal: action === 'wander' ? 'wander' : action === 'search' ? 'seek_food' : 'seek_food',
		action,
		target: { kind: 'point', position: { x: x + 1, y } },
		goalStartedAt: 0,
		actionStartedAt: 0,
		nextReconsiderAt: 1.5,
		lastDecision: null,
		lastCandidates: [],
		recentTransitions: [],
		preferredSymbolId: 'glyph-0',
		emissionCount: 0,
		lastEmissionAt: -1,
		recentEmitted: [],
		recentHeard: [],
		symbolAssociations: [
			{
				symbolId: 'glyph-0',
				foodStrength: 0,
				waterStrength: 0,
				foodEvidenceCount: 0,
				waterEvidenceCount: 0
			},
			{
				symbolId: 'glyph-1',
				foodStrength: 0,
				waterStrength: 0,
				foodEvidenceCount: 0,
				waterEvidenceCount: 0
			},
			{
				symbolId: 'glyph-2',
				foodStrength: 0,
				waterStrength: 0,
				foodEvidenceCount: 0,
				waterEvidenceCount: 0
			},
			{
				symbolId: 'glyph-3',
				foodStrength: 0,
				waterStrength: 0,
				foodEvidenceCount: 0,
				waterEvidenceCount: 0
			}
		],
		lexicon: { food: null, water: null },
		recentLexiconChanges: [],
		pendingSignals: [],
		activeInvestigation: null,
		recentLearning: []
	};
}

describe('reconcileCreatures', () => {
	it('creates meshes for new creatures and updates transforms without structural churn', () => {
		const resources = createCreaturePresentationResources();
		const first = [creature('creature-0', 1, 2, 0.5), creature('creature-1', -1, 0, 1)];
		reconcileCreatures(resources, first);
		expect(resources.byId.size).toBe(2);
		const versionAfterCreate = resources.structureVersion;
		expect(versionAfterCreate).toBeGreaterThan(0);

		const group0 = resources.byId.get('creature-0')!;
		expect(group0.position.x).toBeCloseTo(1);
		expect(group0.position.y).toBeCloseTo(2);
		expect(group0.rotation.z).toBeCloseTo(0.5);

		// Move only — structure version must not change.
		reconcileCreatures(resources, [
			creature('creature-0', 3, 4, -0.25),
			creature('creature-1', -1, 0, 1)
		]);
		expect(resources.structureVersion).toBe(versionAfterCreate);
		expect(group0.position.x).toBeCloseTo(3);
		expect(group0.position.y).toBeCloseTo(4);
		expect(group0.rotation.z).toBeCloseTo(-0.25);

		// Remove one creature — structure changes once.
		reconcileCreatures(resources, [creature('creature-0', 3, 4, -0.25)]);
		expect(resources.byId.size).toBe(1);
		expect(resources.structureVersion).toBe(versionAfterCreate + 1);
		expect(resources.byId.has('creature-1')).toBe(false);

		// Action visuals update without structural churn.
		reconcileCreatures(resources, [creature('creature-0', 3, 4, -0.25, 'eat')]);
		expect(resources.structureVersion).toBe(versionAfterCreate + 1);
		const mats = resources.materialsById.get('creature-0');
		expect(mats).toBeTruthy();
		expect(mats!.body.color.getHex()).toBe(0x2a9d8f);

		// Dispose shared resources used by the test harness.
		resources.bodyGeometry.dispose();
		resources.noseGeometry.dispose();
		for (const materials of resources.materialsById.values()) {
			materials.body.dispose();
			materials.nose.dispose();
		}
	});
});
