/** Listener-local coincidence grounding while a danger is still observable. */
import { distanceSquared } from '../creature-movement';
import { markHeardSignalEvidenceApplied } from '../memory';
import type { Creature } from '../types';
import { applyLexiconResolution } from './lexicon-resolution';
import { findAssociation, reinforceAssociation } from './signal-associations';
import {
	appendLearningHistory,
	outcomeFromEvidenceFlags,
	qualifyEvidenceNearOrigin,
	qualifyLocalDanger,
	localDangerEpisodes
} from './signal-investigation';
import type { LearningStepConfig } from './step-signal-learning';

/**
 * Called after this step's reception and heard-memory writes. Sender intent is
 * unavailable here. Retained provenance prevents counting a reception again at
 * arrival, without consuming the warning that cognition can still interpret.
 */
export function learnFromLocalDangerReception(
	creatures: readonly Creature[],
	timeSeconds: number,
	config: LearningStepConfig
): Creature[] {
	return creatures.map((creature) => {
		let next = creature;
		for (const heard of creature.recentHeard) {
			if (heard.heardAt !== timeSeconds) continue;
			const retained = next.memory.entries.find(
				(entry) => entry.kind === 'heard_signal' && entry.emissionId === heard.emissionId
			);
			if (!retained || retained.kind !== 'heard_signal' || retained.evidenceApplied) continue;
			const dangerIds = qualifyLocalDanger(next, heard.origin, timeSeconds, config);
			if (dangerIds.length === 0) continue;
			const episodes = localDangerEpisodes(next, dangerIds);
			const credited =
				findAssociation(next.symbolAssociations, heard.symbolId)?.dangerEvidenceEpisodes ?? [];
			if (episodes.every((episode) => credited.includes(episode))) {
				next = { ...next, memory: markHeardSignalEvidenceApplied(next.memory, heard.emissionId) };
				continue;
			}
			const resources = qualifyEvidenceNearOrigin(
				{
					...next.perception,
					observations: next.perception.observations.filter(
						(observation) =>
							timeSeconds >= observation.observedAt &&
							timeSeconds - observation.observedAt <= config.perceptionIntervalSeconds + 1e-9 &&
							distanceSquared(next.position, observation.position) <= config.sensingRadius ** 2
					)
				},
				heard.origin,
				config
			);
			const update = reinforceAssociation(
				next.symbolAssociations,
				heard.symbolId,
				{
					reinforceFood: resources.food,
					reinforceWater: resources.water,
					reinforceDanger: true,
					dangerEpisodes: episodes,
					amount: config.associationReinforcement
				},
				config
			);
			const outcome = outcomeFromEvidenceFlags(resources.food, resources.water, true);
			const resolved = applyLexiconResolution(
				next.lexicon,
				next.recentLexiconChanges,
				update.associations,
				config.symbolInventory,
				timeSeconds,
				config,
				`local coincidence ${heard.emissionId} symbol=${heard.symbolId} outcome=${outcome}`
			);
			next = {
				...next,
				memory: markHeardSignalEvidenceApplied(next.memory, heard.emissionId),
				symbolAssociations: update.associations,
				lexicon: resolved.lexicon,
				recentLexiconChanges: resolved.recentLexiconChanges,
				recentLearning: appendLearningHistory(
					next.recentLearning,
					{
						timeSeconds,
						outcome,
						symbolId: heard.symbolId,
						emissionId: heard.emissionId,
						reason: `local reception: danger[${dangerIds.join(',')}] food[${resources.foodFeatureIds.join(',')}] water[${resources.waterFeatureIds.join(',')}] near origin`,
						foodStrengthBefore: update.foodStrengthBefore,
						foodStrengthAfter: update.foodStrengthAfter,
						waterStrengthBefore: update.waterStrengthBefore,
						waterStrengthAfter: update.waterStrengthAfter,
						dangerStrengthBefore: update.dangerStrengthBefore,
						dangerStrengthAfter: update.dangerStrengthAfter
					},
					config.learningHistoryLimit
				)
			};
		}
		return next;
	});
}
