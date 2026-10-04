<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import type { ContextPopulationSummary } from '$lib/simulation';
	let { ctx, creatureCount }: { ctx: ContextPopulationSummary; creatureCount: number } = $props();
</script>

<section
	class="block"
	data-testid={`population-context-${ctx.context}`}
	aria-label={`${ctx.context} symbol summary`}
>
	<h3>{ctx.context} symbol summary</h3>
	<dl class="meta">
		<div>
			<dt>Most assigned (lexicon)</dt>
			<dd data-testid={`population-${ctx.context}-most-assigned`}>
				{#if ctx.mostAssignedSymbolId}
					<SymbolGlyph symbolId={ctx.mostAssignedSymbolId} />
				{:else}
					none
				{/if}
			</dd>
		</div>
		<div>
			<dt>Unassigned creatures</dt>
			<dd data-testid={`population-${ctx.context}-unassigned`}>
				{ctx.creaturesUnassigned}/{creatureCount}
			</dd>
		</div>
		<div>
			<dt>Highest mean evidence</dt>
			<dd data-testid={`population-${ctx.context}-highest-mean`}>
				{#if ctx.highestMeanAssociationSymbolId}
					<SymbolGlyph symbolId={ctx.highestMeanAssociationSymbolId} />
				{:else}
					none
				{/if}
			</dd>
		</div>
		<div>
			<dt>Most emitted in window</dt>
			<dd data-testid={`population-${ctx.context}-most-emitted`}>
				{#if ctx.mostEmittedSymbolId}
					<SymbolGlyph symbolId={ctx.mostEmittedSymbolId} />
				{:else}
					none
				{/if}
			</dd>
		</div>
		<div>
			<dt>Learned vs exploratory</dt>
			<dd data-testid={`population-${ctx.context}-emission-modes`}>
				learned={ctx.recentLearnedEmissions} · exploratory={ctx.recentExploratoryEmissions}
			</dd>
		</div>
	</dl>
	<div class="table-wrap">
		<table class="table" data-testid={`population-${ctx.context}-symbol-rows`}>
			<thead>
				<tr>
					<th scope="col">Symbol</th>
					<th scope="col">Assigned</th>
					<th scope="col">Evidence</th>
					<th scope="col">Recent emit</th>
					<th scope="col">Share</th>
				</tr>
			</thead>
			<tbody>
				{#each ctx.associations as assoc (assoc.symbolId)}
					{@const emit = ctx.emissions.find((e) => e.symbolId === assoc.symbolId)}
					<tr data-testid={`population-${ctx.context}-row-${assoc.symbolId}`}>
						<td><SymbolGlyph symbolId={assoc.symbolId} /></td>
						<td>{assoc.creaturesAssigned}</td>
						<td>{assoc.creaturesWithEvidence}</td>
						<td>{emit?.recentCount ?? 0}</td>
						<td>{(emit?.recentShare ?? 0).toFixed(3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		color: #9ca3af;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
		color: #e2e8f0;
	}
	.table th,
	.table td {
		padding: 0.28rem 0.35rem;
		border-bottom: 1px solid #1e293b;
		text-align: left;
		vertical-align: top;
	}
	.table th {
		color: #94a3b8;
		font-weight: 600;
	}
	.meta {
		display: grid;
		gap: 0.28rem;
		margin: 0 0 0.45rem;
		font-size: 0.75rem;
	}
	.meta div {
		display: grid;
		grid-template-columns: 9.5rem 1fr;
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
</style>
