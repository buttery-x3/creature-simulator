import type { Creature } from '../types';
import type { HeardSignal, SignalEmission } from '../communication/types';

export function formatEmissionLine(emission: SignalEmission): string {
	const evidence = emission.selectionEvidence;
	const candidateSummary = evidence.candidates.map((c) => `${c.symbolId}:${c.note}`).join(' ');
	return (
		`${emission.id} symbol=${emission.symbolId} sender=${emission.senderId} ` +
		`origin=(${emission.origin.x.toFixed(3)}, ${emission.origin.y.toFixed(3)}) ` +
		`emitted@${emission.emittedAt.toFixed(3)} expires@${emission.expiresAt.toFixed(3)} ` +
		`sender-context(observer-only)=${emission.context}/${emission.contextDetail} ` +
		`mode=${evidence.mode} symbolReason=${emission.symbolSelectionReason} ` +
		`fallback=${evidence.usedFallback} candidates=[${candidateSummary}]`
	);
}

function formatHeardLine(heard: HeardSignal): string {
	return (
		`emission=${heard.emissionId} symbol=${heard.symbolId} sender=${heard.senderId} ` +
		`origin=(${heard.origin.x.toFixed(3)}, ${heard.origin.y.toFixed(3)}) ` +
		`emitted@${heard.emittedAt.toFixed(3)} heard@${heard.heardAt.toFixed(3)}`
	);
}

/** Personal communication evidence only: sender context is never a listener translation. */
export function formatCommunicationInspection(
	creature: Creature,
	hearingRadius?: number
): string[] {
	const lines: string[] = [];

	lines.push('', 'communication:');
	lines.push(
		`  preferred symbol: ${creature.preferredSymbolId} (cold-start fallback / initial arbitrary preference)`
	);
	if (hearingRadius !== undefined) {
		lines.push(`  hearing radius: ${hearingRadius.toFixed(3)}`);
	}
	lines.push(
		`  emission count: ${creature.emissionCount}`,
		`  last emission: ${creature.lastEmissionAt >= 0 ? `${creature.lastEmissionAt.toFixed(3)} s` : 'never'}`
	);

	lines.push(
		'  exclusive lexicon (one symbol per meaning; not a global dictionary):',
		`    food → ${creature.lexicon.food ?? 'unassigned'}`,
		`    water → ${creature.lexicon.water ?? 'unassigned'}`,
		`    danger → ${creature.lexicon.danger ?? 'unassigned'}`
	);
	if (creature.recentLexiconChanges.length > 0) {
		lines.push('  recent lexicon changes:');
		for (const change of creature.recentLexiconChanges) {
			lines.push(
				`    t=${change.timeSeconds.toFixed(3)} ${change.meaning}: ` +
					`${change.previousSymbolId ?? 'null'}→${change.newSymbolId ?? 'null'}` +
					` score=${change.assignmentScore.toFixed(3)} — ${change.reason}`
			);
		}
	}

	if (creature.recentEmitted.length === 0) {
		lines.push('  recent emitted: (none)');
	} else {
		lines.push('  recent emitted:');
		for (const emission of creature.recentEmitted) {
			lines.push(`    ${formatEmissionLine(emission)}`);
		}
		const last = creature.recentEmitted[creature.recentEmitted.length - 1]!;
		lines.push(
			`  last selection: sender-context(observer-only)=${last.selectionEvidence.emissionContext}` +
				` symbol=${last.selectionEvidence.selectedSymbolId}` +
				` mode=${last.selectionEvidence.mode}` +
				` reason=${last.selectionEvidence.reason}` +
				` fallback=${last.selectionEvidence.usedFallback}`
		);
	}
	if (creature.recentHeard.length === 0) {
		lines.push('  recent heard: (none)');
	} else {
		lines.push('  recent heard:');
		for (const heard of creature.recentHeard) {
			lines.push(`    ${formatHeardLine(heard)}`);
		}
	}

	lines.push('', 'learning (raw evidence; no global symbol meaning):');
	if (creature.symbolAssociations.length === 0) {
		lines.push('  evidence: (none)');
	} else {
		for (const assoc of creature.symbolAssociations) {
			lines.push(
				`  ${assoc.symbolId}: food=${assoc.evidence.food.strength.toFixed(3)} (n=${assoc.evidence.food.count})` +
					` water=${assoc.evidence.water.strength.toFixed(3)} (n=${assoc.evidence.water.count})` +
					` danger=${assoc.evidence.danger.strength.toFixed(3)} (n=${assoc.evidence.danger.count})`
			);
		}
	}

	if (creature.activeInvestigation) {
		const inv = creature.activeInvestigation;
		lines.push(
			`  active investigation: emission=${inv.emissionId} symbol=${inv.symbolId}` +
				` origin=(${inv.origin.x.toFixed(3)}, ${inv.origin.y.toFixed(3)})` +
				` started@${inv.startedAt.toFixed(3)}` +
				` (execution context; not a lock)`
		);
	} else {
		lines.push('  active investigation: (none)');
	}

	const investigateCandidate = (creature.lastArbitration?.candidates ?? []).find(
		(c) => c.intention === 'investigate_signal'
	);
	if (investigateCandidate) {
		lines.push(
			`  investigation candidate: score=${investigateCandidate.score.toFixed(3)} ` +
				`valid=${investigateCandidate.valid} codes=[${investigateCandidate.reasonCodes.join(',')}]` +
				(investigateCandidate.rejectionReason ? ` | ${investigateCandidate.rejectionReason}` : '')
		);
	}

	if (creature.recentLearning.length === 0) {
		lines.push('  recent learning: (none)');
	} else {
		lines.push('  recent learning:');
		for (const entry of creature.recentLearning) {
			lines.push(
				`    t=${entry.timeSeconds.toFixed(3)} ${entry.outcome} symbol=${entry.symbolId}` +
					` emission=${entry.emissionId} — ${entry.reason}`
			);
		}
	}

	return lines;
}
