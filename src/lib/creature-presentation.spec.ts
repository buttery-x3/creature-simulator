import { describe, expect, it } from 'vitest';
import type { Creature, CreatureAction } from '$lib/simulation';
import {
	INVESTIGATION_HOP_DURATION_SECONDS,
	INVESTIGATION_HOP_HEIGHT,
	clearCreaturePresentation,
	createCreaturePresentationResources,
	hopHeightFactor,
	investigationHopKey,
	reconcileCreatures
} from './creature-presentation';

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
			tracked: null,
			activeEpisodes: [],
			episodeCounter: 0
		},
		hunger: 0.2,
		thirst: 0.2,
		energy: 0.85,
		curiosity: 0.45,
		memory: { capacity: 10, nextSequence: 0, entries: [] },
		recentAnnouncementOpportunityDecisions: [],
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
		recentLearning: [],
		activeAnnouncementOpportunity: null,
		announcementOpportunityCounter: 0,
		recentAnnouncementOutcomes: [],
		activeAnnouncementCue: null
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

		clearCreaturePresentation(resources);
	});

	it('triggers exactly one vertical hop when investigation is newly committed', () => {
		const resources = createCreaturePresentationResources();
		const base = creature('creature-0', 1, 2);
		const withInv: Creature = {
			...base,
			goal: 'investigate_signal',
			action: 'investigate',
			activeInvestigation: {
				emissionId: 'em-1',
				symbolId: 'glyph-1',
				senderId: 'creature-9',
				origin: { x: 4, y: 0 },
				startedAt: 5
			}
		};

		// Commitment starts at t=5.0 presentation time; mid-hop has Z > 0.
		reconcileCreatures(resources, [withInv], null, 5.0);
		const hopKey = investigationHopKey(withInv.activeInvestigation);
		expect(resources.hopById.get('creature-0')?.key).toBe(hopKey);
		expect(resources.hopById.get('creature-0')?.startedAt).toBe(5.0);

		const midTime = 5.0 + INVESTIGATION_HOP_DURATION_SECONDS * 0.5;
		reconcileCreatures(resources, [withInv], null, midTime);
		const group = resources.byId.get('creature-0')!;
		const midZ = group.position.z;
		expect(midZ).toBeGreaterThan(0.2);
		expect(midZ).toBeLessThanOrEqual(INVESTIGATION_HOP_HEIGHT + 1e-6);
		// Authoritative coordinates unchanged.
		expect(withInv.position.x).toBe(1);
		expect(withInv.position.y).toBe(2);
		expect(group.position.x).toBeCloseTo(1);
		expect(group.position.y).toBeCloseTo(2);

		// Continuing the same investigation does not restart hop key.
		reconcileCreatures(resources, [withInv], null, midTime + 0.05);
		expect(resources.hopById.get('creature-0')?.key).toBe(hopKey);
		expect(resources.hopById.get('creature-0')?.startedAt).toBe(5.0);

		// After duration, hop offset settles to 0 while investigation remains.
		reconcileCreatures(resources, [withInv], null, 5.0 + INVESTIGATION_HOP_DURATION_SECONDS + 0.01);
		expect(group.position.z).toBeCloseTo(0);

		// Hearing alone (no investigation) does not hop.
		const heardOnly = creature('creature-1', 0, 0);
		heardOnly.recentHeard = [
			{
				emissionId: 'em-x',
				symbolId: 'glyph-0',
				senderId: 's',
				origin: { x: 0, y: 0 },
				emittedAt: 10,
				heardAt: 10
			}
		];
		reconcileCreatures(resources, [heardOnly], null, 10.1);
		expect(resources.byId.get('creature-1')!.position.z).toBeCloseTo(0);
		expect(resources.hopById.has('creature-1')).toBe(false);

		// Different investigation key may hop again.
		const second: Creature = {
			...withInv,
			activeInvestigation: {
				emissionId: 'em-2',
				symbolId: 'glyph-2',
				senderId: 'creature-9',
				origin: { x: 1, y: 1 },
				startedAt: 20
			}
		};
		reconcileCreatures(resources, [second], null, 20.0);
		expect(resources.hopById.get('creature-0')?.key).toBe(
			investigationHopKey(second.activeInvestigation)
		);
		reconcileCreatures(resources, [second], null, 20.0 + INVESTIGATION_HOP_DURATION_SECONDS * 0.5);
		expect(resources.byId.get('creature-0')!.position.z).toBeGreaterThan(0.2);

		clearCreaturePresentation(resources);
		expect(resources.hopById.size).toBe(0);
	});

	it('uses a rise-and-settle hop curve', () => {
		expect(hopHeightFactor(0)).toBeCloseTo(0);
		expect(hopHeightFactor(0.5)).toBeCloseTo(1);
		expect(hopHeightFactor(1)).toBeCloseTo(0);
	});
});
