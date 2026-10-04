/** Local sensory sequences and bounded response opportunities; never speaker intent. */
import type { Vec2 } from '$lib/habitat';
import { distanceSquared } from '../../creature-movement';
import { deriveMood, type PeerObservation } from '../../social';
import type { Creature } from '../../types';
import { applyMovementOutcomes } from './evidence';
import { MOVEMENT_DEFAULTS as POLICY } from './defaults';
import type {
	MovementEncounter,
	MovementHeardSignal,
	MovementLearningConfig,
	MovementLearningState,
	MovementOutcome,
	MovementTrace
} from './types';

const EPSILON = 1e-9;
const distance = (a: Vec2, b: Vec2) => Math.sqrt(distanceSquared(a, b));

export function emptyMovementLearningState(): MovementLearningState {
	return { encounters: [], response: null, lastBinding: null };
}

function freshPeers(
	creature: Creature,
	time: number,
	config: MovementLearningConfig
): PeerObservation[] {
	return creature.perceivedPeers
		.filter(
			(peer) =>
				peer.observedAt <= time &&
				time - peer.observedAt <= config.perceptionIntervalSeconds + EPSILON &&
				distanceSquared(peer.position, creature.position) <= config.sensingRadius ** 2
		)
		.sort(
			(a, b) =>
				distanceSquared(a.position, creature.position) -
					distanceSquared(b.position, creature.position) || a.id.localeCompare(b.id)
		)
		.slice(0, POLICY.encounterCapacity);
}

function newEncounter(peer: PeerObservation, position: Vec2): MovementEncounter {
	return {
		peerId: peer.id,
		firstObservedAt: peer.observedAt,
		lastObservedAt: peer.observedAt,
		lastPeerPosition: { ...peer.position },
		lastListenerPosition: { ...position },
		trace: null,
		responseOffered: false,
		nextResponseAt: 0
	};
}

/** Consuming a response cannot refresh its original hearing deadline. */
export function consumeMovementResponse(
	state: MovementLearningState,
	time: number
): MovementLearningState {
	if (!state.response) return state;
	return {
		...state,
		response: null,
		encounters: state.encounters.map((row) =>
			row.peerId === state.response!.peerId
				? { ...row, nextResponseAt: time + POLICY.responseCooldownSeconds }
				: row
		)
	};
}

function finish(
	trace: MovementTrace,
	status: Exclude<MovementTrace['status'], 'pending'>,
	reason: string
): MovementTrace {
	return { ...trace, status, reason };
}

function expireTrace(trace: MovementTrace, interval: number): MovementTrace {
	if (trace.lastObservedAt + interval + EPSILON < trace.expiresAt)
		return finish(trace, 'unobserved', 'observation window ended without continuous sight');
	if (trace.peerTowardDistance <= POLICY.negligiblePeerApproachDistance)
		return finish(trace, 'contradicted', 'watched the window without an approaching peer');
	return finish(trace, 'unobserved', 'partial approach did not establish comfortable contact');
}

function updateTrace(
	row: MovementEncounter,
	peer: PeerObservation | undefined,
	listener: Vec2,
	comfortable: boolean,
	time: number,
	interval: number
): MovementTrace | null {
	const trace = row.trace;
	if (!trace || trace.status !== 'pending') return trace;
	if (
		!peer ||
		peer.observedAt - row.lastObservedAt >
			interval * POLICY.maximumObservationGapIntervals + EPSILON
	) {
		return time - trace.lastObservedAt > interval * POLICY.maximumObservationGapIntervals + EPSILON
			? finish(trace, 'unobserved', 'visual contact was lost')
			: trace;
	}
	if (time > trace.expiresAt + EPSILON) return expireTrace(trace, interval);
	if (peer.observedAt <= trace.lastObservedAt) return trace;
	const previousDistance = distance(row.lastPeerPosition, row.lastListenerPosition);
	const dx = peer.position.x - row.lastPeerPosition.x;
	const dy = peer.position.y - row.lastPeerPosition.y;
	const inward =
		previousDistance > EPSILON
			? (dx * (row.lastListenerPosition.x - row.lastPeerPosition.x) +
					dy * (row.lastListenerPosition.y - row.lastPeerPosition.y)) /
				previousDistance
			: 0;
	const currentDistance = distance(peer.position, listener);
	const contact = comfortable && currentDistance <= POLICY.contactDistance;
	const elapsed = Math.min(interval, peer.observedAt - trace.lastObservedAt);
	const updated: MovementTrace = {
		...trace,
		peerTowardDistance: trace.peerTowardDistance + inward,
		closestDistance: Math.min(trace.closestDistance, currentDistance),
		comfortableContactSeconds:
			contact && trace.lastComfortableContact ? trace.comfortableContactSeconds + elapsed : 0,
		lastComfortableContact: contact,
		lastObservedAt: peer.observedAt
	};
	if (
		updated.peerTowardDistance + EPSILON >= POLICY.minimumPeerApproachDistance &&
		updated.comfortableContactSeconds + EPSILON >= POLICY.comfortableContactSeconds
	)
		return finish(updated, 'confirmed', 'peer approached and comfortable proximity followed');
	return time + EPSILON >= trace.expiresAt ? expireTrace(updated, interval) : updated;
}

/** Call only after an actual local peer sensing pass. */
export function observeMovementLearning(
	creature: Creature,
	time: number,
	config: MovementLearningConfig
): Creature {
	const peers = freshPeers(creature, time, config);
	const byId = new Map(peers.map((peer) => [peer.id, peer]));
	let state = creature.movementLearning;
	const responsePeer = state.response ? byId.get(state.response.peerId) : undefined;
	if (
		state.response &&
		(!responsePeer ||
			time >= state.response.expiresAt ||
			distance(creature.position, responsePeer.position) <= POLICY.contactDistance)
	)
		state = consumeMovementResponse(state, time);
	const comfortable = deriveMood(creature).comfort >= POLICY.minimumComfort;
	const outcomes: MovementOutcome[] = [];
	const encounters = state.encounters.flatMap((row) => {
		const peer = byId.get(row.peerId);
		if (peer && peer.observedAt - row.lastObservedAt >= POLICY.encounterAbsenceSeconds) {
			if (row.trace?.status === 'pending')
				outcomes.push({
					peerId: row.peerId,
					trace: finish(row.trace, 'unobserved', 'previous encounter was no longer observed')
				});
			return [{ ...newEncounter(peer, creature.position), nextResponseAt: row.nextResponseAt }];
		}
		const trace = updateTrace(
			row,
			peer,
			creature.position,
			comfortable,
			time,
			config.perceptionIntervalSeconds
		);
		if (trace && row.trace?.status === 'pending' && trace.status !== 'pending')
			outcomes.push({ peerId: row.peerId, trace });
		if (
			!peer &&
			time - row.lastObservedAt >= POLICY.encounterAbsenceSeconds &&
			time >= row.nextResponseAt
		)
			return [];
		return [
			{
				...row,
				trace,
				...(peer
					? {
							lastObservedAt: peer.observedAt,
							lastPeerPosition: { ...peer.position },
							lastListenerPosition: { ...creature.position }
						}
					: {})
			}
		];
	});
	for (const peer of peers)
		if (!encounters.some((row) => row.peerId === peer.id))
			encounters.push(newEncounter(peer, creature.position));
	encounters.sort(
		(a, b) =>
			Number(byId.has(b.peerId)) - Number(byId.has(a.peerId)) ||
			b.lastObservedAt - a.lastObservedAt ||
			a.peerId.localeCompare(b.peerId)
	);
	for (const row of encounters.slice(POLICY.encounterCapacity))
		if (row.trace?.status === 'pending')
			outcomes.push({
				peerId: row.peerId,
				trace: finish(row.trace, 'unobserved', 'bounded observation capacity evicted the sequence')
			});
	return applyMovementOutcomes(
		{
			...creature,
			movementLearning: { ...state, encounters: encounters.slice(0, POLICY.encounterCapacity) }
		},
		outcomes,
		time,
		config
	);
}

/** Bind a sound origin to a uniquely visible peer; senderId is deliberately never read. */
export function hearMovementLearning(
	creature: Creature,
	heard: readonly MovementHeardSignal[],
	time: number,
	config: MovementLearningConfig
): Creature {
	const peers = freshPeers(creature, time, config);
	let state = creature.movementLearning;
	for (const signal of [...heard]
		.filter((event) => event.heardAt === time)
		.sort((a, b) => a.emissionId.localeCompare(b.emissionId))) {
		const matches = peers.filter(
			(peer) => distanceSquared(peer.position, signal.origin) <= POLICY.originBindingRadius ** 2
		);
		const binding = {
			emissionId: signal.emissionId,
			symbolId: signal.symbolId,
			heardAt: signal.heardAt,
			peerId: matches.length === 1 ? matches[0]!.id : null
		};
		if (matches.length !== 1) {
			state = {
				...state,
				lastBinding: { ...binding, status: matches.length ? 'ambiguous' : 'unseen' }
			};
			continue;
		}
		const peer = matches[0]!;
		const existing = state.encounters.find((row) => row.peerId === peer.id);
		if (!existing && state.encounters.length >= POLICY.encounterCapacity) {
			state = { ...state, lastBinding: { ...binding, status: 'budget' } };
			continue;
		}
		let row = existing ?? newEncounter(peer, creature.position);
		const pending = state.encounters.filter(
			(encounter) => encounter.trace?.status === 'pending'
		).length;
		const canTrace = !row.trace && pending < POLICY.pendingCapacity;
		if (canTrace) {
			const currentDistance = distance(signal.origin, creature.position);
			row = {
				...row,
				lastPeerPosition: { ...signal.origin },
				lastListenerPosition: { ...creature.position },
				lastObservedAt: time,
				trace: {
					emissionId: signal.emissionId,
					symbolId: signal.symbolId,
					heardAt: signal.heardAt,
					expiresAt: signal.heardAt + POLICY.observationWindowSeconds,
					status: 'pending',
					peerTowardDistance: 0,
					closestDistance: currentDistance,
					comfortableContactSeconds: 0,
					lastComfortableContact:
						currentDistance <= POLICY.contactDistance &&
						deriveMood(creature).comfort >= POLICY.minimumComfort,
					lastObservedAt: time,
					reason: 'waiting for independently observed peer movement'
				}
			};
		}
		let response = state.response;
		if (
			!response &&
			!row.responseOffered &&
			time >= row.nextResponseAt &&
			distance(peer.position, creature.position) > POLICY.contactDistance
		) {
			response = {
				...binding,
				peerId: peer.id,
				expiresAt: signal.heardAt + POLICY.responseLifetimeSeconds
			};
			row = { ...row, responseOffered: true };
		}
		state = {
			...state,
			response,
			encounters: [...state.encounters.filter((entry) => entry.peerId !== peer.id), row],
			lastBinding: { ...binding, status: !row.trace && !canTrace ? 'budget' : 'bound' }
		};
	}
	return { ...creature, movementLearning: state };
}
