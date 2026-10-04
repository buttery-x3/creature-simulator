<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import type { Creature } from '$lib/simulation';
	import {
		buildCandidateViews,
		formatTargetLabel,
		type InvestigationSummary
	} from '../view-models/creature-detail-view-model';
	import {
		buildSignalEvaluationViews,
		SIGNAL_RANKING_EXPLANATION
	} from '../view-models/signal-evaluation-view-model';
	let { creature, investigation }: { creature: Creature; investigation: InvestigationSummary } =
		$props();
	const candidates = $derived(buildCandidateViews(creature, investigation));
	const signals = $derived(buildSignalEvaluationViews(creature));
</script>

<section class="block" data-testid="creature-behaviour" aria-label="Current behaviour">
	<h3>Current behaviour</h3>
	<dl class="meta">
		<div>
			<dt>Trigger</dt>
			<dd data-testid="inspector-decision-trigger">
				{creature.lastArbitration?.trigger ?? '—'}
			</dd>
		</div>
		<div>
			<dt>Selected intention</dt>
			<dd>
				{creature.lastArbitration?.selectedIntention ?? creature.intention}
			</dd>
		</div>
		<div>
			<dt>Selected target</dt>
			<dd>
				{formatTargetLabel(creature.lastArbitration?.selectedTarget ?? creature.target)}
			</dd>
		</div>
		<div>
			<dt>Selection reasons</dt>
			<dd data-testid="inspector-decision-reason">
				{creature.lastArbitration?.selectionReasonCodes.join(', ') ?? '—'}
			</dd>
		</div>
		<div>
			<dt>Pending arbitration</dt>
			<dd>{creature.pendingArbitrationTrigger ?? '—'}</dd>
		</div>
	</dl>

	{#if investigation}
		<div class="score-box" data-testid="investigation-summary">
			<h4>Heard signals & investigation</h4>
			<dl class="meta">
				<div>
					<dt>Heard-signal memories</dt>
					<dd data-testid="investigation-summary-heard-count">
						{investigation.heardSignalMemoryCount}
					</dd>
				</div>
				<div>
					<dt>Newest heard</dt>
					<dd data-testid="investigation-summary-recent-decision">
						{#if investigation.newestHeardSymbolId}
							<SymbolGlyph symbolId={investigation.newestHeardSymbolId} />
							{investigation.newestHeardEmissionId}
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt>Active</dt>
					<dd data-testid="investigation-summary-active">
						{#if investigation.activeSymbolId}
							<SymbolGlyph symbolId={investigation.activeSymbolId} />
							{investigation.activeEmissionId}
						{:else}
							—
						{/if}
					</dd>
				</div>
			</dl>
		</div>
	{/if}

	<div class="score-box" data-testid="inspector-signal-evaluations">
		<h4>Retained signals at last arbitration ({signals.length})</h4>
		<p class="hint">
			Personal listener interpretations; unknown symbols remain eligible for investigation. Learned
			danger signals instead contribute to the separate avoidance candidate. Scores exclude
			intention continuity.
		</p>
		<p class="hint">{SIGNAL_RANKING_EXPLANATION}</p>
		{#if signals.length === 0}
			<p class="hint">No retained signal evaluations in this snapshot.</p>
		{:else}
			<ol class="signal-evaluations">
				{#each signals as signal (signal.emissionId)}
					<li data-testid="inspector-signal-evaluation" class:selected={signal.selected}>
						<div>
							<SymbolGlyph symbolId={signal.symbolId} />
							{signal.emissionId} · {signal.selectionLabel}
						</div>
						<div>Listener interpretation: {signal.interpretationLabel}</div>
						<div>Origin {signal.originLabel} · sequence {signal.sequence}</div>
						<div>
							Hunger {signal.hungerPressure.toFixed(3)} · actionable food knowledge: {signal.foodKnowledge}
						</div>
						<div>
							Thirst {signal.thirstPressure.toFixed(3)} · actionable water knowledge: {signal.waterKnowledge}
						</div>
						<div>
							Optional {signal.optionalScore.toFixed(3)} · information floor {signal.informationFloor.toFixed(
								3
							)}
						</div>
						<div>
							Semantic contribution {signal.semanticContribution.toFixed(3)} · recency boost {signal.recencyBoost.toFixed(
								3
							)}
						</div>
						<div>
							Investigation score = max(optional, floor) + semantic = {signal.score.toFixed(3)}
						</div>
						{#if signal.interpretation === 'danger'}<div>
								This learned warning is excluded from approach. See the recorded avoid_danger
								candidate below for avoidance evidence.
							</div>{/if}
					</li>
				{/each}
			</ol>
			<p class="hint">
				Selected signal supplies the investigation candidate; another intention can still win
				arbitration. Matching actionable knowledge or a below-threshold need suppresses semantic
				contribution.
			</p>
		{/if}
	</div>

	<h4 class="subhead">Arbitration candidates</h4>
	<ul class="candidates" data-testid="inspector-candidates">
		{#each candidates as candidate (candidate.intention)}
			<li
				data-testid={`inspector-candidate-${candidate.intention}`}
				class:selected={candidate.selected}
			>
				<strong>{candidate.intention}</strong>
				score={candidate.score.toFixed(3)}
				{candidate.valid ? 'valid' : 'invalid'}
				{#if candidate.scoreTerms}
					<ul class="terms">
						{#each candidate.scoreTerms as term (term.label)}
							<li>{term.label}: {term.value.toFixed(3)}</li>
						{/each}
					</ul>
				{:else}
					— {candidate.reasonCodes.join(', ') || 'n/a'}
				{/if}
				{#if candidate.rejectionReason}
					<span class="reject">({candidate.rejectionReason})</span>
				{/if}
			</li>
		{:else}
			<li data-testid="inspector-candidates-empty">No candidate snapshot yet.</li>
		{/each}
	</ul>
</section>

<style>
	.block h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.subhead,
	.score-box h4 {
		margin: 0.45rem 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.hint {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.35rem;
	}

	.meta dt {
		margin: 0;
		color: #94a3b8;
	}

	.meta dd {
		margin: 0;
		color: #e2e8f0;
		word-break: break-word;
	}

	.score-box {
		margin-top: 0.45rem;
		padding: 0.45rem;
		border: 1px solid #1e293b;
		border-radius: 0.35rem;
		background: #0f172a;
	}

	.candidates {
		margin: 0;
		padding-left: 1rem;
		color: #cbd5e1;
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.candidates .selected {
		color: #e2e8f0;
	}

	.candidates .reject {
		color: #fca5a5;
	}

	.terms {
		margin: 0.15rem 0 0.25rem;
		padding-left: 1rem;
		color: #94a3b8;
	}

	.signal-evaluations {
		max-height: 26rem;
		overflow: auto;
		margin: 0.5rem 0;
		padding-left: 1.25rem;
		font-size: 0.72rem;
		line-height: 1.5;
		color: #94a3b8;
	}
	.signal-evaluations li {
		padding: 0.4rem;
		overflow-wrap: anywhere;
	}
	.signal-evaluations .selected {
		border-left: 2px solid #a5b4fc;
		color: #e2e8f0;
	}
</style>
