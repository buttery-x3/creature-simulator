/** Observational arbitration text; all rankings and score terms come from the saved record. */
import type { ArbitrationRecord, CreatureTarget, IntentionCandidate } from './types';

type SignalEvaluation = NonNullable<IntentionCandidate['signalEvaluations']>[number];

export function formatDiagnosticTarget(target: CreatureTarget | null): string {
	if (!target) {
		return 'none';
	}
	if (target.kind === 'point') {
		return `point=(${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)})`;
	}
	if (target.kind === 'creature') return `creature:${target.creatureId}`;
	if (target.kind === 'wildlife') return `wildlife:${target.wildlifeId}`;
	return `${target.featureKind}:${target.featureId}`;
}

function formatSignalEvaluation(signal: SignalEvaluation): string {
	return (
		`    ${signal.selected ? 'selected signal' : 'alternative signal'}: emission=${signal.emissionId} symbol=${signal.symbolId}` +
		` origin=(${signal.origin.x.toFixed(3)}, ${signal.origin.y.toFixed(3)}) sequence=${signal.sequence}` +
		` listener interpretation=${signal.interpretation}` +
		` hunger=${signal.hungerPressure.toFixed(3)} thirst=${signal.thirstPressure.toFixed(3)}` +
		` actionable food knowledge=${signal.foodKnowledge} water knowledge=${signal.waterKnowledge}` +
		` optional=${signal.optionalScore.toFixed(3)} informationFloor=${signal.informationFloor.toFixed(3)}` +
		` semantic=${signal.semanticContribution.toFixed(3)} recency=${signal.recencyBoost.toFixed(3)}` +
		` score=${signal.score.toFixed(3)}`
	);
}

function formatSignalEvaluations(candidate: IntentionCandidate): string[] {
	const signals = candidate.signalEvaluations ?? [];
	if (signals.length === 0) return ['  retained signal evaluations: (none in snapshot)'];
	return [
		`  retained signal evaluations: ${signals.length} (listener-local lexicon; unknown stays eligible)`,
		'    rank: highest score first; ties use newest sequence, then emission ID ascending',
		'    score = max(optional, informationFloor) + semantic; excludes intention continuity',
		'    semantic requires a matching unresolved need at threshold; actionable visible/remembered knowledge suppresses it',
		'    selected signal supplies investigate_signal; another intention may win arbitration',
		...signals.map(formatSignalEvaluation)
	];
}

/** Format the bounded snapshot without reading current memory, lexicon or resource state. */
export function formatArbitrationDiagnostics(record: ArbitrationRecord | null): string[] {
	const lines: string[] = [];
	lines.push('', 'last arbitration:');

	if (record) {
		const d = record;
		lines.push(
			`  time: ${d.timeSeconds.toFixed(3)} s`,
			`  trigger: ${d.trigger}`,
			`  previous intention: ${d.previousIntention ?? 'none'}`,
			`  selected: ${d.selectedIntention} → ${formatDiagnosticTarget(d.selectedTarget)}`,
			`  reasons: ${d.selectionReasonCodes.join(', ')}`
		);
	} else {
		lines.push('  (none)');
	}

	lines.push('', 'candidates:');
	const candidates = record?.candidates ?? [];
	if (candidates.length === 0) {
		lines.push('  (none)');
	} else {
		for (const c of candidates) {
			const flag = c.valid ? 'valid' : 'invalid';
			const reject = c.rejectionReason ? ` | reject: ${c.rejectionReason}` : '';
			const continuity =
				c.continuityAdjustment !== 0 ? ` cont=${c.continuityAdjustment.toFixed(3)}` : '';
			const factors =
				c.factors.length > 0
					? ` factors=[${c.factors.map((f) => `${f.code}=${f.value.toFixed(3)}`).join(', ')}]`
					: '';
			lines.push(
				`  ${c.intention}: score=${c.score.toFixed(3)} base=${c.baseScore.toFixed(3)}${continuity} ${flag}` +
					` codes=[${c.reasonCodes.join(',')}]${reject}` +
					` target=${formatDiagnosticTarget(c.target)}${factors}`
			);
			if (c.intention === 'investigate_signal') lines.push(...formatSignalEvaluations(c));
		}
	}

	return lines;
}
