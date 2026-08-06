/**
 * Fixed-step communication advance: create emissions, receive, expire.
 * Invoked after behaviour within the same fixed simulation step.
 *
 * Symbol choice uses the emitter's exclusive lexicon for the discovery context
 * (see symbol-selection.ts). Listeners never receive context or selection evidence.
 */

import type { Creature, SimulationConfig, SimulationState } from '../types';
import { appendBounded, buildEmission, canEmit, nextEmissionId, toHeardSignal } from './emission';
import { selectReceivers } from './reception';
import { selectContextSymbol } from './symbol-selection';
import type { EmissionRequest, SignalEmission } from './types';

export type CommunicationStepConfig = Pick<
	SimulationConfig,
	| 'hearingRadius'
	| 'signalLifetimeSeconds'
	| 'emissionCooldownSeconds'
	| 'recentEmittedHistoryLimit'
	| 'recentHeardHistoryLimit'
	| 'recentSimulationEmissionHistoryLimit'
	| 'symbolInventory'
>;

/**
 * Apply emission requests then expire stale active emissions.
 *
 * Ordering (authoritative):
 * 1. Process requests in given order (caller sorts by sender id).
 * 2. For each accepted request: select symbol from lexicon, build emission,
 *    select receivers at post-behaviour positions, update histories.
 * 3. Drop active emissions with expiresAt <= timeSeconds.
 *
 * Hearing does not alter goals, actions, needs, targets or perception.
 * Selection never mutates evidence/lexicon or routes listener outcomes to the emitter.
 */
export function stepCommunication(
	state: SimulationState,
	requests: readonly EmissionRequest[],
	timeSeconds: number,
	config: CommunicationStepConfig
): SimulationState {
	let creatures = state.creatures;
	let activeEmissions = [...state.activeEmissions];
	let recentEmissions = [...state.recentEmissions];

	const byId = new Map(creatures.map((c) => [c.id, c]));

	for (const request of requests) {
		const sender = byId.get(request.senderId);
		if (!sender) {
			continue;
		}
		if (!canEmit(sender.lastEmissionAt, timeSeconds, config.emissionCooldownSeconds)) {
			continue;
		}

		const emissionCount = sender.emissionCount;
		const selection = selectContextSymbol({
			simulationSeed: state.seed,
			creatureId: request.senderId,
			emissionCount,
			contextDetail: request.contextDetail,
			inventory: config.symbolInventory,
			lexicon: sender.lexicon,
			preferredSymbolId: sender.preferredSymbolId
		});

		const emission = buildEmission({
			id: nextEmissionId(request.senderId, emissionCount),
			symbolId: selection.symbolId,
			senderId: request.senderId,
			origin: request.origin,
			emittedAt: timeSeconds,
			lifetimeSeconds: config.signalLifetimeSeconds,
			context: request.context,
			contextDetail: request.contextDetail,
			symbolSelectionReason: selection.reasonText,
			selectionEvidence: selection.evidence
		});

		const receivers = selectReceivers(
			emission,
			creatures.map((c) => ({ id: c.id, position: c.position })),
			config.hearingRadius
		);

		const updatedSender: Creature = {
			...sender,
			emissionCount: emissionCount + 1,
			lastEmissionAt: timeSeconds,
			recentEmitted: appendBounded(sender.recentEmitted, emission, config.recentEmittedHistoryLimit)
		};
		byId.set(sender.id, updatedSender);

		for (const receiver of receivers) {
			const creature = byId.get(receiver.id);
			if (!creature) {
				continue;
			}
			const heard = toHeardSignal(emission, timeSeconds);
			byId.set(receiver.id, {
				...creature,
				recentHeard: appendBounded(creature.recentHeard, heard, config.recentHeardHistoryLimit)
			});
		}

		activeEmissions.push(emission);
		recentEmissions = appendBounded(
			recentEmissions,
			emission,
			config.recentSimulationEmissionHistoryLimit
		);

		// Refresh creatures array order from byId using original order for stability,
		// then rebuild from current creature list ids so array order matches input.
		creatures = creatures.map((c) => byId.get(c.id) ?? c);
	}

	activeEmissions = expireEmissions(activeEmissions, timeSeconds);

	return {
		...state,
		creatures: creatures.map((c) => byId.get(c.id) ?? c),
		activeEmissions,
		recentEmissions
	};
}

export function expireEmissions(
	emissions: readonly SignalEmission[],
	timeSeconds: number
): SignalEmission[] {
	return emissions.filter((e) => e.expiresAt > timeSeconds);
}
