<script lang="ts">
	import {
		buildPopulationSymbolDiagnostics,
		type PopulationSymbolDiagnostics,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
	};

	let { simulation, config }: Props = $props();

	const diagnostics: PopulationSymbolDiagnostics = $derived(
		buildPopulationSymbolDiagnostics(simulation, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		})
	);
</script>

<section class="panel" data-testid="population-communication-panel">
	<h2>Population symbols</h2>
	<p class="hint" data-testid="population-communication-hint">
		Observational summaries only — not a global dictionary or “correct” food/water symbol.
	</p>
	<p class="summary" data-testid="population-communication-window">
		t={diagnostics.timeSeconds.toFixed(2)}s · window={diagnostics.windowSeconds.toFixed(0)}s ·
		creatures={diagnostics.creatureCount}
	</p>

	{#each [diagnostics.food, diagnostics.water] as ctx (ctx.context)}
		<div class="context-block" data-testid={`population-context-${ctx.context}`}>
			<h3 class="subhead">{ctx.context} context</h3>
			<dl class="meta">
				<div>
					<dt>Highest mean association</dt>
					<dd data-testid={`population-${ctx.context}-highest-mean`}>
						{ctx.highestMeanAssociationSymbolId ?? 'none'}
						<span class="muted">(observational)</span>
					</dd>
				</div>
				<div>
					<dt>Most emitted in window</dt>
					<dd data-testid={`population-${ctx.context}-most-emitted`}>
						{ctx.mostEmittedSymbolId ?? 'none'}
						<span class="muted">(observational)</span>
					</dd>
				</div>
				<div>
					<dt>Concentration max-share</dt>
					<dd data-testid={`population-${ctx.context}-concentration`}>
						{ctx.emissionConcentrationMaxShare.toFixed(3)}
					</dd>
				</div>
				<div>
					<dt>Entropy (normalised)</dt>
					<dd data-testid={`population-${ctx.context}-entropy`}>
						{ctx.emissionEntropyNormalised.toFixed(3)}
					</dd>
				</div>
				<div>
					<dt>Evidence contributors</dt>
					<dd data-testid={`population-${ctx.context}-contributors`}>
						{ctx.creaturesContributingEvidence}
					</dd>
				</div>
			</dl>
			<ul class="symbol-rows" data-testid={`population-${ctx.context}-symbol-rows`}>
				{#each ctx.associations as assoc (assoc.symbolId)}
					{@const emit = ctx.emissions.find((e) => e.symbolId === assoc.symbolId)}
					<li data-testid={`population-${ctx.context}-row-${assoc.symbolId}`}>
						<strong>{assoc.symbolId}</strong>
						mean={assoc.meanStrength.toFixed(3)} median={assoc.medianStrength.toFixed(3)}
						evidence={assoc.creaturesWithEvidence}/{diagnostics.creatureCount}
						strongest={assoc.creaturesStrongest}
						recentEmit={emit?.recentCount ?? 0}
						share={(emit?.recentShare ?? 0).toFixed(3)}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.panel h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}

	.summary {
		margin: 0;
		font-size: 0.8rem;
		color: #d1d5db;
	}

	.subhead {
		margin: 0.35rem 0 0.25rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #cbd5e1;
		text-transform: capitalize;
	}

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.75rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		gap: 0.35rem;
	}

	.meta dt {
		margin: 0;
		color: #94a3b8;
	}

	.meta dd {
		margin: 0;
		color: #e5e7eb;
	}

	.muted {
		color: #64748b;
		font-size: 0.7rem;
	}

	.symbol-rows {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		font-size: 0.72rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.symbol-rows li {
		padding: 0.15rem 0;
		border-bottom: 1px solid #1f2937;
	}

	.symbol-rows strong {
		color: #e5e7eb;
	}

	.context-block + .context-block {
		margin-top: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px solid #1f2937;
	}
</style>
