import { describe, expect, it } from 'vitest';
import { buildArbitrationInput } from '../../behaviour/build-arbitration-input';
import { createSimulation, defaultSimulationConfig } from '../../create-simulation';
import { createEmptyMemory, rememberDangerObservation } from '../../memory';
import { testCreature } from '../../test-creature';
import { arbitrate } from '../arbitrate';
import { buildCandidates } from '../build-candidates';
import { applyDangerRouteRisk } from './danger-policy';
import { buildRestCandidate } from './rest-candidate';

function fixture(position = { x: 8, y: 0 }, energy = 0) {
	const config = defaultSimulationConfig('rest-destination');
	config.ecology.wildlifeCount = 0;
	const state = createSimulation(config);
	const habitat = {
		...state.habitat,
		home: { ...state.habitat.home, position: { x: 0, y: 0 }, size: { width: 2, height: 2 } }
	};
	return buildArbitrationInput(
		testCreature({ position, energy, hunger: 0.2, thirst: 0.2, verbosity: 0 }),
		habitat,
		45,
		'periodic',
		config
	);
}

describe('local and home rest destinations', () => {
	it('allows a safely exhausted creature far from home to rest exactly where it stands', () => {
		const input = fixture();
		const record = arbitrate(input);
		expect(record.selectedIntention).toBe('rest');
		expect(record.selectedTarget).toEqual({ kind: 'point', position: input.position });
		expect(record.candidates.filter((candidate) => candidate.intention === 'rest')).toHaveLength(1);
		expect(buildRestCandidate(input).factors).toContainEqual({
			code: 'rest_recovery_multiplier',
			value: 0.75
		});
	});

	it('prefers more restorative home nearby and resolves an equal on-home option toward home', () => {
		for (const position of [
			{ x: 1.5, y: 0 },
			{ x: 0, y: 0 }
		]) {
			const input = fixture(position, 0.5);
			expect(buildRestCandidate(input).target).toEqual({
				kind: 'feature',
				featureId: input.homeFeatureId,
				featureKind: 'home'
			});
		}
	});

	it('penalises lingering at a threat even when the planned route has zero length', () => {
		const input = fixture({ x: 3, y: 0 }, 0.5);
		const memory = rememberDangerObservation(createEmptyMemory(8), {
			wildlifeId: 'predator',
			position: input.position,
			size: 2,
			physicality: 2,
			health: 1,
			energy: 1,
			rememberedAt: 45
		});
		const threatened = { ...input, memory };
		const local = {
			...buildRestCandidate(input),
			target: { kind: 'point' as const, position: input.position }
		};
		expect(applyDangerRouteRisk(threatened, [local])[0].baseScore).toBeLessThan(local.baseScore);
		expect(arbitrate(threatened).selectedIntention).toBe('flee');
	});

	it('compares both risk-adjusted options and does not apply the chosen penalty twice', () => {
		const input = fixture({ x: 1.5, y: 0 }, 0.5);
		const memory = rememberDangerObservation(createEmptyMemory(8), {
			wildlifeId: 'predator',
			position: { x: 0, y: 0 },
			size: 1.5,
			physicality: 1.5,
			health: 1,
			energy: 1,
			rememberedAt: 45
		});
		const threatened = { ...input, memory };
		const option = buildRestCandidate(threatened);
		expect(buildRestCandidate(input).target?.kind).toBe('feature');
		expect(option.target?.kind).toBe('point');
		const candidate = buildCandidates(threatened).find(
			(candidate) => candidate.intention === 'rest'
		)!;
		expect(candidate.baseScore).toBe(option.baseScore);
		expect(
			candidate.factors.filter((factor) => factor.code === 'danger_route_multiplier')
		).toHaveLength(1);
		const scores = option.factors.filter((factor) =>
			['home_rest_score', 'local_rest_score'].includes(factor.code)
		);
		expect(option.baseScore).toBe(Math.max(...scores.map((factor) => factor.value)));
	});

	it('uses remembered evidence only until its expiry, and leaves pure home-only callers supported', () => {
		const input = fixture();
		const stale = rememberDangerObservation(createEmptyMemory(8), {
			wildlifeId: 'predator',
			position: input.position,
			size: 2,
			physicality: 2,
			health: 1,
			energy: 1,
			rememberedAt: 0
		});
		expect(buildRestCandidate({ ...input, memory: stale })).toEqual(buildRestCandidate(input));
		expect(buildRestCandidate({ ...input, physical: undefined }).target?.kind).toBe('feature');
	});
});
