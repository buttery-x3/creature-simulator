/**
 * Lightweight simulation diagnostics for the workbench.
 * Arbitration, perception and communication reasons come from structured simulation records only.
 * Symbols are arbitrary at emission — listener associations are personal learned evidence only.
 * Population convergence metrics are pure derived observations (never feed back into behaviour).
 */

import type { Creature, CreatureTarget, SimulationConfig, SimulationState } from './types';
import type { HeardSignal, SignalEmission } from './communication/types';
import {
	buildPopulationSymbolDiagnostics,
	formatPopulationSymbolDiagnostics
} from './population-symbol-diagnostics';

function formatTarget(target: CreatureTarget | null): string {
	if (!target) {
		return 'none';
	}
	if (target.kind === 'point') {
		return `point=(${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)})`;
	}
	return `${target.featureKind}:${target.featureId}`;
}

function formatCreature(creature: Creature): string {
	const {
		id,
		position,
		facing,
		movementSpeed,
		verbosity,
		hunger,
		thirst,
		energy,
		intention,
		action,
		target,
		nextReconsiderAt
	} = creature;
	return (
		`${id}: pos=(${position.x.toFixed(3)}, ${position.y.toFixed(3)}) ` +
		`facing=${facing.toFixed(3)} speed=${movementSpeed.toFixed(3)} ` +
		`verbosity=${verbosity.toFixed(3)} ` +
		`needs=[h=${hunger.toFixed(2)} t=${thirst.toFixed(2)} e=${energy.toFixed(2)}] ` +
		`intention=${intention} action=${action} target=${formatTarget(target)} ` +
		`reconsider@${nextReconsiderAt.toFixed(2)}`
	);
}

function formatEmissionLine(emission: SignalEmission): string {
	const evidence = emission.selectionEvidence;
	const candidateSummary = evidence.candidates.map((c) => `${c.symbolId}:${c.note}`).join(' ');
	return (
		`${emission.id} symbol=${emission.symbolId} sender=${emission.senderId} ` +
		`origin=(${emission.origin.x.toFixed(3)}, ${emission.origin.y.toFixed(3)}) ` +
		`emitted@${emission.emittedAt.toFixed(3)} expires@${emission.expiresAt.toFixed(3)} ` +
		`context=${emission.context}/${emission.contextDetail} ` +
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

/**
 * Human-readable simulation summary plus per-creature lines.
 * Optional config enables population symbol diagnostics (pure, observational).
 */
export function formatSimulationDiagnostics(
	state: SimulationState,
	options?: {
		paused?: boolean;
		config?: Pick<SimulationConfig, 'symbolInventory' | 'recentEmissionDiagnosticsWindowSeconds'>;
	}
): string {
	const paused = options?.paused ?? false;
	const lines: string[] = [
		`seed: ${state.seed}`,
		`status: ${paused ? 'paused' : 'running'}`,
		`time: ${state.timeSeconds.toFixed(3)} s`,
		`creatures: ${state.creatures.length}`,
		`active emissions: ${state.activeEmissions.length}`,
		'',
		'creatures:'
	];

	for (const creature of state.creatures) {
		lines.push(`  ${formatCreature(creature)}`);
	}

	if (state.activeEmissions.length > 0) {
		lines.push('', 'active emissions:');
		for (const emission of state.activeEmissions) {
			lines.push(`  ${formatEmissionLine(emission)}`);
		}
	}

	if (options?.config) {
		const population = buildPopulationSymbolDiagnostics(state, options.config);
		lines.push('', formatPopulationSymbolDiagnostics(population));
	}

	return lines.join('\n');
}

export type InspectionConfig = Pick<
	SimulationConfig,
	'sensingRadius' | 'hearingRadius' | 'symbolInventory'
>;

/**
 * Pure inspection view for the workbench. Does not mutate the creature.
 * Selection of a creature is presentation state and never calls this for side effects.
 * Distances to perceived resources are derived from authoritative perception + position.
 */
export function formatCreatureInspection(
	creature: Creature,
	timeSeconds: number,
	config?: InspectionConfig
): string {
	const sensingRadius = config?.sensingRadius;
	const p = creature.perception;

	const lines: string[] = [
		`id: ${creature.id}`,
		`position: (${creature.position.x.toFixed(3)}, ${creature.position.y.toFixed(3)})`,
		`facing: ${creature.facing.toFixed(3)}`,
		`verbosity: ${creature.verbosity.toFixed(3)} (speech preference; 0=quiet 1=talkative)`,
		`hunger: ${creature.hunger.toFixed(3)} (pressure; 0=sated 1=max)`,
		`thirst: ${creature.thirst.toFixed(3)} (pressure; 0=quenched 1=max)`,
		`energy: ${creature.energy.toFixed(3)} (satisfaction; 0=exhausted 1=full)`,
		`intention: ${creature.intention}`,
		`action: ${creature.action}`,
		`target: ${formatTarget(creature.target)}`,
		`intention started: ${creature.intentionStartedAt.toFixed(3)} s`,
		`action started: ${creature.actionStartedAt.toFixed(3)} s`,
		`next reconsider: ${creature.nextReconsiderAt.toFixed(3)} s (in ${Math.max(0, creature.nextReconsiderAt - timeSeconds).toFixed(3)} s)`,
		`pending trigger: ${creature.pendingArbitrationTrigger ?? 'none'}`,
		''
	];

	if (creature.action === 'search') {
		lines.push(
			`search destination: (${creature.searchTarget.x.toFixed(3)}, ${creature.searchTarget.y.toFixed(3)})`,
			''
		);
	}

	lines.push('perception:');
	if (sensingRadius !== undefined) {
		lines.push(`  sensing radius: ${sensingRadius.toFixed(3)}`);
	}
	lines.push(
		`  last update: ${p.lastUpdatedAt >= 0 ? `${p.lastUpdatedAt.toFixed(3)} s` : 'never'}`,
		`  perceived food: ${p.perceivedFoodIds.length > 0 ? p.perceivedFoodIds.join(', ') : '(none)'}`,
		`  perceived water: ${p.perceivedWaterIds.length > 0 ? p.perceivedWaterIds.join(', ') : '(none)'}`
	);
	if (p.observations.length === 0) {
		lines.push('  observations: (none)');
	} else {
		for (const obs of p.observations) {
			const dx = obs.position.x - creature.position.x;
			const dy = obs.position.y - creature.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			lines.push(
				`  obs ${obs.featureKind}:${obs.featureId} pos=(${obs.position.x.toFixed(3)}, ${obs.position.y.toFixed(3)}) dist=${dist.toFixed(3)} at ${obs.observedAt.toFixed(3)} s`
			);
		}
	}

	lines.push('', 'last arbitration:');

	if (creature.lastArbitration) {
		const d = creature.lastArbitration;
		lines.push(
			`  time: ${d.timeSeconds.toFixed(3)} s`,
			`  trigger: ${d.trigger}`,
			`  previous intention: ${d.previousIntention ?? 'none'}`,
			`  selected: ${d.selectedIntention} → ${formatTarget(d.selectedTarget)}`,
			`  reasons: ${d.selectionReasonCodes.join(', ')}`
		);
	} else {
		lines.push('  (none)');
	}

	lines.push('', 'candidates:');
	const candidates = creature.lastArbitration?.candidates ?? [];
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
					` target=${formatTarget(c.target)}${factors}`
			);
		}
	}

	lines.push('', 'recent transitions:');
	if (creature.recentTransitions.length === 0) {
		lines.push('  (none)');
	} else {
		for (const t of creature.recentTransitions) {
			lines.push(
				`  t=${t.timeSeconds.toFixed(3)}: ${t.fromIntention}/${t.fromAction} → ${t.toIntention}/${t.toAction} (${t.reason})`
			);
		}
	}

	const hearingRadius = config?.hearingRadius;
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
		`    water → ${creature.lexicon.water ?? 'unassigned'}`
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
			`  last selection: context=${last.selectionEvidence.emissionContext}` +
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
				`  ${assoc.symbolId}: food=${assoc.foodStrength.toFixed(3)} (n=${assoc.foodEvidenceCount})` +
					` water=${assoc.waterStrength.toFixed(3)} (n=${assoc.waterEvidenceCount})` +
					` bias=${(assoc.foodStrength * creature.hunger + assoc.waterStrength * creature.thirst).toFixed(3)}`
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

	const mem = creature.memory;
	lines.push('', `memory: ${mem.entries.length}/${mem.capacity} (nextSeq=${mem.nextSequence})`);
	if (mem.entries.length === 0) {
		lines.push('  entries: (none)');
	} else {
		for (const entry of mem.entries) {
			if (entry.kind === 'heard_signal') {
				lines.push(
					`  #${entry.sequence} heard_signal ${entry.symbolId} emission=${entry.emissionId}` +
						` origin=(${entry.origin.x.toFixed(2)}, ${entry.origin.y.toFixed(2)}) @${entry.rememberedAt.toFixed(2)}`
				);
			} else if (entry.kind === 'resource_observation') {
				lines.push(
					`  #${entry.sequence} observation ${entry.resourceKind}:${entry.featureId}` +
						` empty=${entry.empty} @${entry.rememberedAt.toFixed(2)}`
				);
			} else {
				lines.push(
					`  #${entry.sequence} announced ${entry.resourceKind}:${entry.featureId}` +
						` emission=${entry.emissionId} @${entry.rememberedAt.toFixed(2)}`
				);
			}
		}
	}

	return lines.join('\n');
}
