import { describe, expect, it } from 'vitest';
import { buildArbitrationInput } from '../../behaviour/build-arbitration-input';
import { senseCreature } from '../../behaviour/sensing/sense-creature';
import { createSimulation, defaultSimulationConfig } from '../../create-simulation';
import { createEmptyMemory, listDangerObservations, rememberDangerObservation } from '../../memory';
import { testCreature } from '../../test-creature';
import { arbitrate } from '../arbitrate';
import { buildCandidates } from '../build-candidates';
import { applyDangerRouteRisk, perceivedDanger, retreatFrom } from './danger-policy';
import { buildPhysicalCandidates } from './physical-candidates';

function fixture() {
	const config = defaultSimulationConfig('danger-retention');
	const state = createSimulation(config);
	const danger = {
		wildlifeId: 'predator',
		position: { x: 0, y: 0 },
		size: 2,
		physicality: 1,
		health: 1,
		energy: 1,
		rememberedAt: 0
	};
	const creature = testCreature({
		position: { x: 3.1, y: 0 },
		energy: 0.45,
		hunger: 0.1,
		thirst: 0.1,
		memory: rememberDangerObservation(createEmptyMemory(8), danger),
		intention: 'rest',
		target: { kind: 'feature', featureKind: 'home', featureId: state.habitat.home.id }
	});
	const habitat = { ...state.habitat, home: { ...state.habitat.home, position: { x: -3, y: 0 } } };
	const input = buildArbitrationInput(creature, habitat, 0.3, 'periodic', config);
	return { config, state, danger, creature, habitat, input };
}

describe('local remembered danger utility', () => {
	it('reduces immediate unseen return into danger through ordinary competing scores', () => {
		const { input } = fixture();
		const forgotten = { ...input, memory: createEmptyMemory(8) };
		expect(arbitrate(forgotten).selectedIntention).toBe('rest');
		expect(arbitrate(input).selectedIntention).toBe('flee');
		const rest = buildCandidates(input).find((candidate) => candidate.intention === 'rest')!;
		const safeRest = buildCandidates(forgotten).find(
			(candidate) => candidate.intention === 'rest'
		)!;
		expect(rest.baseScore).toBeLessThan(safeRest.baseScore);
		expect(rest.reasonCodes).toContain('danger_aware_route');
	});

	it('lets stale danger expire and never hunts a remembered animal', () => {
		const { input } = fixture();
		expect(
			buildPhysicalCandidates(input).find((candidate) => candidate.intention === 'hunt')?.valid
		).toBe(false);
		const expired = { ...input, timeSeconds: 13 };
		expect(perceivedDanger(expired)).toEqual([]);
		expect(arbitrate(expired).selectedIntention).toBe('rest');
	});

	it('allows urgent visible food to compete with mild remembered danger', () => {
		const { input, danger } = fixture();
		const urgent = {
			...input,
			energy: 1,
			hunger: 1,
			memory: rememberDangerObservation(createEmptyMemory(8), { ...danger, size: 1 }),
			availableFood: [
				{ featureId: 'food', resourceKind: 'food' as const, position: { x: 5, y: 0 } }
			]
		};
		expect(arbitrate(urgent).selectedIntention).toBe('satisfy_hunger');
		const crossing = {
			...urgent,
			availableFood: [
				{ featureId: 'food', resourceKind: 'food' as const, position: { x: -3, y: 0 } }
			]
		};
		const candidate = buildCandidates({ ...crossing, memory: createEmptyMemory(8) }).find(
			(candidate) => candidate.intention === 'satisfy_hunger'
		)!;
		const desperateScore = applyDangerRouteRisk(crossing, [candidate])[0].baseScore;
		const mildScore = applyDangerRouteRisk({ ...crossing, hunger: 0.5 }, [candidate])[0].baseScore;
		expect(desperateScore).toBeGreaterThan(mildScore);
		expect(desperateScore).toBeGreaterThan(0);
		const strong = {
			...input,
			energy: 1,
			physical: { ...input.physical!, body: { ...input.physical!.body, physicality: 4 } }
		};
		expect(buildPhysicalCandidates(strong)[0].valid).toBe(false);
	});

	it('keeps weak visible prey huntable and does not penalise movement away from danger', () => {
		const { input } = fixture();
		const hunter = {
			...input,
			energy: 1,
			hunger: 1,
			memory: createEmptyMemory(8),
			physical: {
				...input.physical!,
				wildlife: [
					{
						id: 'prey',
						position: { x: 3.5, y: 0 },
						size: 0.3,
						physicality: 0.4,
						health: 1,
						energy: 1,
						foodAmount: 0,
						observedAt: 0.3,
						firstObservedAt: 0.3
					}
				]
			}
		};
		expect(arbitrate(hunter).selectedIntention).toBe('hunt');
		const away = { ...input, physical: { ...input.physical!, homePosition: { x: 8, y: 0 } } };
		const candidate = buildCandidates({ ...away, memory: createEmptyMemory(8) }).find(
			(candidate) => candidate.intention === 'rest'
		)!;
		expect(applyDangerRouteRisk(away, [candidate])[0]).toEqual(candidate);
	});

	it('retains observed coordinates without following unseen wildlife and then forgets them', () => {
		const { config, state, habitat } = fixture();
		const creature = testCreature({ position: { x: 0, y: 0 } });
		const predator = {
			...state.wildlife[0],
			id: 'predator',
			position: { x: 1, y: 0 },
			size: 2,
			physicality: 2,
			health: 1,
			energy: 1
		};
		const observed = senseCreature(creature, habitat, 0, config, [predator]).creature;
		const unseen = senseCreature(observed, habitat, 0.3, config, [
			{ ...predator, position: { x: 100, y: 100 } }
		]).creature;
		expect(unseen.perceivedWildlife).toEqual([]);
		expect(listDangerObservations(unseen.memory, 0.3)[0].position).toEqual({ x: 1, y: 0 });
		const expired = senseCreature(unseen, habitat, 13, config, []).creature;
		expect(expired.memory.entries.some((entry) => entry.kind === 'danger_observation')).toBe(false);
	});

	it('uses a tangential retreat at an outward-blocked edge', () => {
		const destination = retreatFrom({ x: 9.7, y: 0 }, { x: 9, y: 0 }, { width: 20, height: 20 });
		expect(destination.x).toBeLessThanOrEqual(9.7);
		expect(Math.abs(destination.y)).toBeGreaterThan(1);
	});
});
