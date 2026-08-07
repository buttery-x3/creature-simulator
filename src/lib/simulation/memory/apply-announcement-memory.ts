/**
 * Apply resource-announcement memories for emissions accepted this fixed step.
 *
 * Invoked after communication so only successful emissions create memory.
 * Communication does not own memory storage semantics.
 */

import type { Creature } from '../types';
import type { SignalEmission } from '../communication/types';
import { ensureCreatureMemory } from './create-memory';
import { rememberResourceAnnouncement } from './mutate';

/**
 * For each successful resource-announcement emission, write one memory on the sender.
 * Emissions without announcement provenance are ignored.
 */
export function applySuccessfulAnnouncementMemories(
	creatures: readonly Creature[],
	emissions: readonly SignalEmission[],
	timeSeconds: number
): Creature[] {
	if (emissions.length === 0) {
		return creatures as Creature[];
	}

	const bySender = new Map<string, SignalEmission[]>();
	for (const emission of emissions) {
		const provenance = emission.provenance;
		if (
			provenance === null ||
			provenance === undefined ||
			!provenance.triggerFeatureId ||
			!provenance.opportunityId
		) {
			continue;
		}
		if (emission.context !== 'resource_discovered') {
			continue;
		}
		const list = bySender.get(emission.senderId) ?? [];
		list.push(emission);
		bySender.set(emission.senderId, list);
	}

	if (bySender.size === 0) {
		return creatures as Creature[];
	}

	return creatures.map((raw) => {
		const mine = bySender.get(raw.id);
		if (!mine || mine.length === 0) {
			return raw;
		}
		const creature = ensureCreatureMemory(raw);
		let memory = creature.memory;
		for (const emission of mine) {
			const provenance = emission.provenance;
			if (!provenance) {
				continue;
			}
			memory = rememberResourceAnnouncement(memory, {
				rememberedAt: timeSeconds,
				featureId: provenance.triggerFeatureId,
				resourceKind: emission.contextDetail,
				opportunityId: provenance.opportunityId,
				emissionId: emission.id
			});
		}
		if (memory === creature.memory && creature === raw) {
			return raw;
		}
		return { ...creature, memory };
	});
}
