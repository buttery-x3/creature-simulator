import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '../create-simulation';
import { stepCommunication } from '../communication';
import { applyHeardSignalMemories } from '../memory';
import { hearMovementLearning, MOVEMENT_DEFAULTS } from '../learning/movement';
import { stepSimulation } from '../step-simulation';
import { testCreature } from '../test-creature';
import type { Creature, SimulationState } from '../types';

function fixture() {
	const config = defaultSimulationConfig('local-movement-learning');
	config.ecology.wildlifeCount = 0;
	config.foodSpawnIntervalSeconds = 10_000;
	config.hungerRisePerSecond = config.thirstRisePerSecond = config.energyDrainPerSecond = 0;
	config.ecology.activityHungerCostPerSecond = config.ecology.movementEnergyCostPerUnit = 0;
	const state = createSimulation(config);
	state.habitat = { ...state.habitat, food: [], water: [] };
	state.creatures = ['listener', 'speaker'].map((id, index) => {
		const creature = testCreature({
			id,
			position: { x: index * 2, y: 0 },
			hunger: 0,
			thirst: 0,
			energy: 1,
			verbosity: 0,
			curiosity: 0,
			movementSpeed: 0
		});
		return {
			...creature,
			// Isolate contact evidence from births and their physical costs in this experiment.
			lifecycle: { ...creature.lifecycle, nextReproductionAt: 10_000 },
			social: { ...creature.social, nextExpressionAt: 10_000 },
			lexicon:
				index === 0
					? creature.lexicon
					: { ...creature.lexicon, food: 'glyph-3' as const, water: 'glyph-2' as const }
		};
	});
	return { state, config };
}
type Config = ReturnType<typeof defaultSimulationConfig>;
const listener = (state: SimulationState) =>
	state.creatures.find((creature) => creature.id === 'listener')!;
function patch(state: SimulationState, id: string, changes: Partial<Creature>): SimulationState {
	return {
		...state,
		creatures: state.creatures.map((creature) =>
			creature.id === id ? { ...creature, ...changes } : creature
		)
	};
}
function advance(state: SimulationState, config: Config, seconds: number): SimulationState {
	for (let i = 0; i < Math.ceil(seconds / config.fixedDt); i++)
		state = stepSimulation(state, config);
	return state;
}
function hear(
	state: SimulationState,
	config: Config,
	detail: 'food' | 'water' = 'food'
): SimulationState {
	const speaker = state.creatures.find((creature) => creature.id === 'speaker')!;
	const communicated = stepCommunication(
		state,
		[
			{
				senderId: speaker.id,
				origin: speaker.position,
				context: 'resource_discovered',
				contextDetail: detail
			}
		],
		state.timeSeconds,
		config
	);
	const remembered = applyHeardSignalMemories(
		communicated.state.creatures,
		state.timeSeconds,
		communicated.receivedThisStep
	);
	return {
		...communicated.state,
		creatures: remembered.map((creature) =>
			hearMovementLearning(
				creature,
				communicated.receivedThisStep.get(creature.id) ?? [],
				state.timeSeconds,
				config
			)
		)
	};
}
function senseAt(
	state: SimulationState,
	config: Config,
	speakerX: number,
	listenerX = 0
): SimulationState {
	state = patch(state, 'speaker', { position: { x: speakerX, y: 0 } });
	state = patch(state, 'listener', {
		position: { x: listenerX, y: 0 },
		perception: { ...listener(state).perception, lastUpdatedAt: -1 }
	});
	return stepSimulation(state, config);
}
/** Controlled world trajectories; all observations and outcomes still use actual simulation sensing. */
function episode(
	state: SimulationState,
	config: Config,
	mode: 'heard' | 'silent' | 'self' | 'ambiguous'
): SimulationState {
	state = senseAt(state, config, 2);
	if (mode === 'ambiguous') {
		state = {
			...state,
			creatures: [...state.creatures, testCreature({ ...state.creatures[1], id: 'bystander' })]
		};
		state = senseAt(state, config, 2);
	}
	if (mode !== 'silent') state = hear(state, config);
	for (const distance of [1.5, 1, 0.8, 0.8, 0.8]) {
		state =
			mode === 'self' ? senseAt(state, config, 2, 2 - distance) : senseAt(state, config, distance);
		state = advance(state, config, 0.3);
	}
	return state;
}
function separate(state: SimulationState, config: Config): SimulationState {
	state = senseAt(state, config, 8);
	return advance(state, config, MOVEMENT_DEFAULTS.encounterAbsenceSeconds + 0.5);
}

describe('heard movement sequences in actual local simulation', () => {
	it('learns approach after two separate heard and observed episodes, regardless of sender resource context', () => {
		const { config, state } = fixture();
		const first = episode(state, config, 'heard');
		expect(
			listener(first).symbolAssociations.find((row) => row.symbolId === 'glyph-3')!.evidence
				.approach.count
		).toBe(1);
		expect(listener(first).lexicon.approach).toBeNull();
		const second = episode(separate(first, config), config, 'heard');
		const learned = listener(second);
		expect(
			learned.symbolAssociations.find((row) => row.symbolId === 'glyph-3')!.evidence.approach.count
		).toBe(2);
		expect(learned.lexicon.approach).toBe('glyph-3');
		expect(learned.lexicon.food).toBeNull();
		expect(
			learned.recentLearning.filter((event) => event.outcome === 'approach_evidence')
		).toHaveLength(2);
	});

	it.each(['silent', 'self', 'ambiguous'] as const)(
		'does not confirm from the matched %s trajectory',
		(mode) => {
			const { config, state } = fixture();
			const result = episode(state, config, mode);
			expect(
				listener(result).symbolAssociations.every((row) => row.evidence.approach.count === 0)
			).toBe(true);
			expect(listener(result).lexicon.approach).toBeNull();
			if (mode === 'ambiguous')
				expect(listener(result).movementLearning.lastBinding?.status).toBe('ambiguous');
		}
	);

	it('later re-emits its own acquired arbitrary approach form through a selected calling plan', () => {
		const { config, state } = fixture();
		let trained = episode(separate(episode(state, config, 'heard'), config), config, 'heard');
		trained = advance(trained, config, 50);
		trained = senseAt(separate(trained, config), config, 1.8);
		expect(listener(trained).lexicon.approach).toBe('glyph-3');
		const ready = patch(trained, 'listener', {
			verbosity: 1,
			movementSpeed: 1,
			nextReconsiderAt: 0
		});
		const calling = stepSimulation(ready, config);
		const caller = listener(calling);
		expect(caller.intention).toBe('approach_peer');
		expect(
			caller.lastArbitration!.candidates.find(
				(candidate) => candidate.intention === 'approach_peer'
			)!.factors
		).toContainEqual({ code: 'movement_call_selected', value: 1 });
		const emitted = caller.recentEmitted.at(-1)!;
		expect(emitted).toMatchObject({
			symbolId: 'glyph-3',
			context: 'approach_started',
			contextDetail: 'approach'
		});
		expect(emitted.selectionEvidence.mode).toBe('learned_lexicon');
		expect(
			calling.creatures.find((creature) => creature.id === 'speaker')!.recentHeard.at(-1)?.symbolId
		).toBe('glyph-3');
		expect(listener(stepSimulation(calling, config)).emissionCount).toBe(caller.emissionCount);
	});

	it('uses personal learned prediction as a soft approach bonus while urgent needs and sight loss can release it', () => {
		const { config, state } = fixture();
		let learned = episode(separate(episode(state, config, 'heard'), config), config, 'heard');
		// Accrue ordinary local familiarity without assigning either relationship or meaning.
		learned = advance(learned, config, 50);
		learned = separate(learned, config);
		learned = senseAt(learned, config, 2);
		const known = hear(learned, config, 'food');
		const unknown = hear(learned, config, 'water');
		const reconsider = (value: SimulationState) =>
			patch(value, 'listener', { nextReconsiderAt: 0 });
		const chosen = stepSimulation(reconsider(known), config);
		const ignored = stepSimulation(reconsider(unknown), config);
		expect(listener(chosen).intention).toBe('approach_peer');
		expect(listener(ignored).intention).toBe('explore');
		const bonus = listener(chosen)
			.lastArbitration!.candidates.find((candidate) => candidate.intention === 'approach_peer')!
			.factors.find((factor) => factor.code === 'approach_signal_bonus')!.value;
		expect(bonus).toBeGreaterThan(0);
		const thirsty = stepSimulation(
			patch(chosen, 'listener', { thirst: 1, nextReconsiderAt: 0 }),
			config
		);
		expect(listener(thirsty).intention).toBe('satisfy_thirst');
		const lost = senseAt(chosen, config, 8);
		expect(listener(lost).target?.kind).not.toBe('creature');
		expect(listener(lost).movementLearning.response).toBeNull();
	});
});
