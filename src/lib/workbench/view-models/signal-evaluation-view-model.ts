/** Present the last authoritative signal ranking without recomputing listener policy. */
import type { Creature, IntentionCandidate } from '$lib/simulation';

type SignalEvaluation = NonNullable<IntentionCandidate['signalEvaluations']>[number];

export type SignalEvaluationView = SignalEvaluation & {
	originLabel: string;
	interpretationLabel: string;
	selectionLabel: string;
};

export const SIGNAL_RANKING_EXPLANATION =
	'Rank: highest score first; ties use newest sequence, then emission ID ascending.';

/** The snapshot is already ranked and bounded by creature memory capacity. */
export function buildSignalEvaluationViews(creature: Creature): SignalEvaluationView[] {
	const candidate = creature.lastArbitration?.candidates.find(
		(entry) => entry.intention === 'investigate_signal'
	);
	return (candidate?.signalEvaluations ?? []).map((signal) => ({
		...signal,
		origin: { ...signal.origin },
		originLabel: `(${signal.origin.x.toFixed(2)}, ${signal.origin.y.toFixed(2)})`,
		interpretationLabel:
			signal.interpretation === 'unknown'
				? 'unknown to this listener'
				: `${signal.interpretation} in this listener’s lexicon`,
		selectionLabel: signal.selected ? 'selected signal' : 'alternative signal'
	}));
}
