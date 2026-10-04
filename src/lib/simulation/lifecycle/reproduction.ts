import type { Creature } from '../types';
import { reproductionEligible } from './physiology';
import type { BirthSpec, LifeEvent, LifecycleConfig } from './types';

function selectedPeer(creature: Creature): string | null {
	return creature.intention === 'court_peer' && creature.target?.kind === 'creature'
		? creature.target.creatureId
		: null;
}

function inContact(first: Creature, second: Creature, config: LifecycleConfig): boolean {
	return (
		Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y) <=
		config.courtshipDistance
	);
}

function finishAttempt(
	creature: Creature,
	time: number,
	cooldown: number,
	config: LifecycleConfig,
	birth: boolean
): Creature {
	return {
		...creature,
		energy: birth ? Math.max(0, creature.energy - config.reproductionEnergyCost) : creature.energy,
		hunger: birth ? Math.min(1, creature.hunger + config.reproductionHungerCost) : creature.hunger,
		lifecycle: { ...creature.lifecycle, courtship: null, nextReproductionAt: time + cooldown },
		pendingArbitrationTrigger: 'action_complete',
		nextReconsiderAt: 0
	};
}

/** Physical mutual contact resolution, independent from cognitive mate selection and creation. */
export function resolveReproduction(
	creatures: readonly Creature[],
	time: number,
	config: LifecycleConfig,
	nextCreatureId: number
): { creatures: Creature[]; births: BirthSpec[]; nextCreatureId: number; events: LifeEvent[] } {
	const original = new Map(creatures.map((creature) => [creature.id, creature]));
	const updated = new Map<string, Creature>();
	const ordered = [...creatures].sort((a, b) => a.id.localeCompare(b.id));
	const births: BirthSpec[] = [];
	const events: LifeEvent[] = [];
	// All contact/mutual checks use the same snapshot, never a partially updated partner.
	for (const creature of ordered) {
		const peerId = selectedPeer(creature);
		const peer = peerId ? original.get(peerId) : null;
		if (
			!peer ||
			peer.id === creature.id ||
			peer.body.health <= 0 ||
			!reproductionEligible(creature, time, config) ||
			!inContact(creature, peer, config)
		) {
			updated.set(creature.id, {
				...creature,
				lifecycle: { ...creature.lifecycle, courtship: null }
			});
			continue;
		}
		const prior =
			creature.lifecycle.courtship?.peerId === peer.id ? creature.lifecycle.courtship : null;
		const mutual = selectedPeer(peer) === creature.id && reproductionEligible(peer, time, config);
		updated.set(creature.id, {
			...creature,
			lifecycle: {
				...creature.lifecycle,
				courtship: {
					peerId: peer.id,
					startedAt: prior?.startedAt ?? time,
					mutualSince: mutual ? (prior?.mutualSince ?? time) : null
				}
			}
		});
	}
	const finished = new Set<string>();
	const livingCount = creatures.filter((creature) => creature.body.health > 0).length;
	for (const originalCreature of ordered) {
		const creature = updated.get(originalCreature.id)!;
		if (finished.has(creature.id)) continue;
		const attempt = creature.lifecycle.courtship;
		if (!attempt) continue;
		const peer = updated.get(attempt.peerId)!;
		const peerAttempt = peer.lifecycle.courtship;
		const mutualSince =
			attempt.mutualSince !== null &&
			peerAttempt?.peerId === creature.id &&
			peerAttempt.mutualSince !== null
				? Math.max(attempt.mutualSince, peerAttempt.mutualSince)
				: null;
		if (mutualSince !== null && time - mutualSince + 1e-9 >= config.mutualCourtshipSeconds) {
			const pair = [creature, peer].sort((a, b) => a.id.localeCompare(b.id));
			const parentIds: [string, string] = [pair[0].id, pair[1].id];
			const hasCapacity = livingCount + births.length < config.populationCap;
			for (const parent of pair) {
				finished.add(parent.id);
				updated.set(
					parent.id,
					finishAttempt(parent, time, config.reproductionCooldownSeconds, config, hasCapacity)
				);
			}
			if (!hasCapacity) {
				events.push({
					kind: 'courtship_failed',
					time,
					creatureIds: parentIds,
					reason: 'population_cap'
				});
				continue;
			}
			const birth: BirthSpec = {
				id: `creature-${nextCreatureId++}`,
				position: {
					x: (creature.position.x + peer.position.x) / 2,
					y: (creature.position.y + peer.position.y) / 2
				},
				parentIds,
				generation: Math.max(creature.lifecycle.generation, peer.lifecycle.generation) + 1
			};
			births.push(birth);
			events.push({
				kind: 'birth',
				time,
				creatureId: birth.id,
				parentIds,
				generation: birth.generation
			});
		} else if (time - attempt.startedAt + 1e-9 >= config.courtshipTimeoutSeconds) {
			finished.add(creature.id);
			updated.set(
				creature.id,
				finishAttempt(creature, time, config.failedCourtshipCooldownSeconds, config, false)
			);
			events.push({
				kind: 'courtship_failed',
				time,
				creatureIds: [creature.id],
				reason: 'timeout'
			});
		}
	}
	return {
		creatures: creatures.map((creature) => updated.get(creature.id)!),
		births,
		nextCreatureId,
		events
	};
}
