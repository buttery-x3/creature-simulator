import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepCommunication } from '../communication';
import type { SignalContextDetail } from '../communication';
import { applyHeardSignalMemories, rememberDangerObservation } from '../memory';
import { senseCreature } from '../behaviour/sensing/sense-creature';
import { rememberResourceObservation } from '../memory';
import type { Wildlife } from '../ecology/types';
import { testCreature } from '../test-creature';
import type { Creature, WildlifeObservation } from '../types';
import { learnFromLocalDangerReception } from './reception-learning';
import { beginInvestigation } from './signal-investigation';
import { resolveInvestigationAtSite } from './step-signal-learning';

const config = {
	...defaultSimulationConfig('danger-learning'),
	creatureCount: 0,
	wildlifeCount: 0,
	associationReinforcement: 0.25,
	hearingRadius: 5
};
const world = createSimulation(config);
const threat: WildlifeObservation = {
	id: 'animal',
	position: { x: 0.5, y: 0 },
	size: 2,
	physicality: 2,
	health: 1,
	energy: 1,
	foodAmount: 1,
	observedAt: 1,
	firstObservedAt: 1
};

function listener(overrides: Partial<Creature> = {}): Creature {
	const base = testCreature({ id: 'listener', perceivedWildlife: [threat], ...overrides });
	return {
		...base,
		memory: rememberDangerObservation(base.memory, {
			wildlifeId: threat.id,
			position: threat.position,
			size: threat.size,
			physicality: threat.physicality,
			health: threat.health,
			energy: threat.energy,
			rememberedAt: 1
		})
	};
}

/** Actual emission/reception; context deliberately stays on the sender side. */
function hear(
	receiver: Creature,
	time = 1,
	context: SignalContextDetail = 'danger',
	count = 0,
	hearingRadius = config.hearingRadius
): Creature {
	const sender = testCreature({
		id: 'speaker',
		emissionCount: count,
		lexicon: { food: null, water: null, danger: null, [context]: 'glyph-2', approach: null }
	});
	const { state, receivedThisStep } = stepCommunication(
		{ ...world, creatures: [sender, receiver] },
		[
			{
				senderId: sender.id,
				origin: sender.position,
				context: context === 'danger' ? 'danger_observed' : 'resource_discovered',
				contextDetail: context
			}
		],
		time,
		{ ...config, hearingRadius }
	);
	return applyHeardSignalMemories(state.creatures, time, receivedThisStep).find(
		(c) => c.id === receiver.id
	)!;
}

function learn(receiver: Creature, time = 1): Creature {
	return learnFromLocalDangerReception(
		[receiver],
		time,
		config,
		new Map([[receiver.id, receiver.recentHeard]])
	)[0]!;
}

function association(creature: Creature) {
	return creature.symbolAssociations.find((row) => row.symbolId === 'glyph-2')!;
}

describe('listener-local danger reception learning', () => {
	it('grounds an unknown symbol from actual hearing and fresh personal threat observation', () => {
		const before = hear(listener());
		expect(before.lexicon.danger).toBeNull();
		expect(before.recentHeard[0]).not.toHaveProperty('contextDetail');
		const after = learn(before);
		expect(association(after).evidence.danger.count).toBe(1);
		expect(after.lexicon.danger).toBe('glyph-2');
		expect(after.recentLearning.at(-1)?.outcome).toBe('danger_evidence');
		expect(after.memory.entries.find((e) => e.kind === 'heard_signal')).toMatchObject({
			evidenceApplied: true
		});
	});

	it('cannot learn without hearing the same nearby hazard', () => {
		const receiver = listener({ position: { x: 1, y: 0 } });
		const outsideHearing = hear(receiver, 1, 'danger', 0, 0.1);
		expect(learn(outsideHearing).lexicon.danger).toBeNull();
		expect(learn(receiver).symbolAssociations).toEqual(receiver.symbolAssociations);
	});

	it('cannot infer hidden danger from sender meaning or a retained old hazard', () => {
		for (const perceivedWildlife of [
			[],
			[{ ...threat, observedAt: 0 }],
			[{ ...threat, position: { x: 50, y: 0 } }],
			[{ ...threat, health: 0 }]
		]) {
			const next = learn(hear(listener({ perceivedWildlife })));
			expect(association(next).evidence.danger.strength).toBe(0);
		}
	});

	it('requires physical threat to this listener, not merely an animal label', () => {
		const next = learn(
			hear(listener({ body: { size: 10, physicality: 10, health: 1, nextAttackAt: 0 } }))
		);
		expect(association(next).evidence.danger.strength).toBe(0);
	});

	it('preserves mixed local evidence even when sender intends a different meaning', () => {
		const receiver = listener();
		receiver.perception = {
			...receiver.perception,
			lastUpdatedAt: 1,
			perceivedFoodIds: ['food'],
			observations: [
				{ featureId: 'food', featureKind: 'food', position: { x: 0.25, y: 0 }, observedAt: 1 }
			]
		};
		const next = learn(hear(receiver, 1, 'water'));
		expect(association(next)).toMatchObject({
			evidence: {
				food: { strength: 0.25 },
				danger: { strength: 0.25 },
				water: { strength: 0 },
				approach: { strength: 0, count: 0 }
			}
		});
		expect(next.recentLearning.at(-1)?.outcome).toBe('mixed_evidence');
		expect(next.lexicon.food).toBe('glyph-2');
		expect(next.lexicon.danger).toBeNull();
	});

	it('does not count stale resource snapshots in mixed coincidence evidence', () => {
		const receiver = listener();
		receiver.perception.observations = [
			{ featureId: 'old-food', featureKind: 'food', position: { x: 0.25, y: 0 }, observedAt: 0 }
		];
		expect(association(learn(hear(receiver))).evidence.food.count).toBe(0);
	});

	it('counts a received episode once across repeated hooks, warning emissions, and arrival', () => {
		const first = learn(hear(listener()));
		expect(learn(first)).toEqual(first);
		const heard = first.recentHeard[0]!;
		const arrived = resolveInvestigationAtSite(
			{ ...first, activeInvestigation: beginInvestigation(heard, 1) },
			world.habitat,
			1,
			config
		);
		expect(association(arrived).evidence.danger.count).toBe(1);
		const repeated = learn(
			hear({ ...first, perceivedWildlife: [{ ...threat, observedAt: 5 }] }, 5, 'danger', 1),
			5
		);
		expect(association(repeated).evidence.danger.count).toBe(1);
		expect(repeated.recentLearning).toHaveLength(1);
	});

	it('allows a genuinely separate retained observation episode to confirm a meaning', () => {
		let next = learn(hear(listener()));
		next = {
			...next,
			perceivedWildlife: [{ ...threat, observedAt: 20, firstObservedAt: 20 }],
			memory: rememberDangerObservation(next.memory, {
				wildlifeId: threat.id,
				position: threat.position,
				size: threat.size,
				physicality: threat.physicality,
				health: threat.health,
				energy: threat.energy,
				rememberedAt: 20
			})
		};
		next = learn(hear(next, 20, 'danger', 1), 20);
		expect(association(next).evidence.danger.count).toBe(2);
		expect(association(next).dangerEvidenceEpisodes).toEqual(['animal:1', 'animal:20']);
	});

	it('can ground danger at arrival only from current local observation', () => {
		const before = hear(listener({ perceivedWildlife: [] }));
		const activeInvestigation = beginInvestigation(before.recentHeard[0]!, 1);
		const unseen = resolveInvestigationAtSite(
			{ ...before, activeInvestigation },
			world.habitat,
			1,
			config
		);
		expect(association(unseen).evidence.danger.strength).toBe(0);
		const seen = resolveInvestigationAtSite(
			{ ...before, activeInvestigation, perceivedWildlife: [threat] },
			world.habitat,
			1,
			config
		);
		expect(association(seen).evidence.danger.strength).toBe(0.25);
	});
});

it.each([1, 2])(
	'keeps continuous encounters independent of shared memory eviction at capacity %i',
	(capacity) => {
		const animal: Wildlife = {
			...threat,
			facing: 0,
			nextAttackAt: 0,
			patrolPhase: 0,
			mode: 'roam'
		};
		let next = testCreature({ id: 'listener', memory: { capacity, nextSequence: 0, entries: [] } });
		for (let index = 0; index < 4; index++) {
			const time = 1 + index * 4;
			next = {
				...next,
				memory: rememberResourceObservation(next.memory, {
					featureId: 'resource',
					resourceKind: 'water',
					position: { x: 1, y: 0 },
					rememberedAt: time,
					empty: false
				})
			};
			next = senseCreature(next, world.habitat, time, config, [animal]).creature;
			next = learn(hear(next, time, 'danger', index), time);
			expect(next.memory.entries.length).toBeLessThanOrEqual(capacity);
		}
		expect(association(next).evidence.danger.count).toBe(1);
	}
);

it('starts a new observed episode after actual loss of sight and expiry at capacity one', () => {
	const animal: Wildlife = { ...threat, facing: 0, nextAttackAt: 0, patrolPhase: 0, mode: 'roam' };
	let next = testCreature({
		id: 'listener',
		memory: { capacity: 1, nextSequence: 0, entries: [] }
	});
	next = senseCreature(next, world.habitat, 1, config, [animal]).creature;
	next = learn(hear(next, 1), 1);
	next = senseCreature(next, world.habitat, 5, config, []).creature;
	expect(next.perceivedWildlife).toEqual([]);
	next = senseCreature(next, world.habitat, 20, config, [animal]).creature;
	next = learn(hear(next, 20, 'danger', 1), 20);
	expect(association(next).evidence.danger.count).toBe(2);
	expect(association(next).dangerEvidenceEpisodes).toEqual(['animal:1', 'animal:20']);
});
