/** Temporal observations update only the listener's approach prediction. */
import type { Creature } from '../../types';
import { applyLexiconResolution } from '../lexicon-resolution';
import { appendLearningHistory } from '../signal-investigation';
import {
	clampStrength,
	getOrCreateAssociation,
	reinforceAssociation,
	snapshotAssociationStrengths
} from '../signal-associations';
import { MOVEMENT_DEFAULTS } from './defaults';
import type { MovementLearningConfig, MovementOutcome } from './types';

export function applyMovementOutcomes(
	creature: Creature,
	outcomes: readonly MovementOutcome[],
	timeSeconds: number,
	config: MovementLearningConfig
): Creature {
	let next = creature;
	for (const { peerId, trace } of outcomes) {
		const original = next.symbolAssociations.find((row) => row.symbolId === trace.symbolId);
		const before = snapshotAssociationStrengths(original);
		let associations = next.symbolAssociations;
		if (trace.status === 'confirmed') {
			associations = reinforceAssociation(
				associations,
				trace.symbolId,
				{ meanings: { approach: true }, amount: config.associationReinforcement },
				config
			).associations;
		} else if (trace.status === 'contradicted') {
			const update = getOrCreateAssociation(associations, trace.symbolId);
			update.association.evidence.approach.strength = clampStrength(
				update.association.evidence.approach.strength - MOVEMENT_DEFAULTS.contradictionReduction,
				config
			);
			update.associations[update.index] = update.association;
			associations = update.associations;
		}
		const after = snapshotAssociationStrengths(
			associations.find((row) => row.symbolId === trace.symbolId)
		);
		const outcome =
			trace.status === 'confirmed'
				? 'approach_evidence'
				: trace.status === 'contradicted'
					? 'approach_contradicted'
					: 'approach_unobserved';
		const resolution = applyLexiconResolution(
			next.lexicon,
			next.recentLexiconChanges,
			associations,
			config.symbolInventory,
			timeSeconds,
			config,
			`local movement ${trace.emissionId} peer=${peerId} outcome=${outcome}`
		);
		next = {
			...next,
			symbolAssociations: associations,
			lexicon: resolution.lexicon,
			recentLexiconChanges: resolution.recentLexiconChanges,
			recentLearning: appendLearningHistory(
				next.recentLearning,
				{
					timeSeconds,
					outcome,
					symbolId: trace.symbolId,
					emissionId: trace.emissionId,
					reason: `observed peer ${peerId}: ${trace.reason}; inward=${trace.peerTowardDistance.toFixed(3)} contact=${trace.comfortableContactSeconds.toFixed(3)}s`,
					before,
					after
				},
				config.learningHistoryLimit
			)
		};
	}
	return next;
}
