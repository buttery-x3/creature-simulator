<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import { SYMBOL_PRESENTATIONS } from '$lib/symbol-presentation';
	import type { SimulationConfig, SimulationState } from '$lib/simulation';
	import { buildCommunicationViewModel } from '../view-models/communication-view-model';
	import type { WorkbenchNavigate } from '../workbench-types';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		filterCreatureId?: string | null;
		onNavigate: (intent: WorkbenchNavigate) => void;
	};

	let { simulation, config, filterCreatureId = null, onNavigate }: Props = $props();

	const vm = $derived(
		buildCommunicationViewModel(simulation, {
			symbolInventory: config.symbolInventory,
			recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
		})
	);

	const matrixRows = $derived(
		filterCreatureId
			? vm.lexiconMatrix.filter((r) => r.creatureId === filterCreatureId)
			: vm.lexiconMatrix
	);
</script>

<div class="communication" data-testid="communication-tab" data-population-panel="true">
	<!-- Preserve legacy testid used by e2e for population surface -->
	<section class="block" data-testid="population-communication-panel">
		<h3>Symbol legend</h3>
		<p class="hint" data-testid="population-communication-hint">
			Observational summaries only — exclusive lexicons and raw evidence are personal, not a global
			dictionary or “correct” food/water symbol.
		</p>
		<div class="legend" data-testid="symbol-presentation-legend" aria-label="Symbol legend">
			<span class="legend-title">Glyphs</span>
			{#each SYMBOL_PRESENTATIONS as entry (entry.symbolId)}
				<span class="legend-item">
					<SymbolGlyph symbolId={entry.symbolId} />
				</span>
			{/each}
		</div>
		<p class="summary" data-testid="population-communication-window">
			t={vm.population.timeSeconds.toFixed(2)}s · window={vm.population.windowSeconds.toFixed(0)}s ·
			creatures={vm.population.creatureCount}
		</p>
	</section>

	<section class="block" data-testid="communication-funnel" aria-label="Communication funnel">
		<h3>Communication funnel</h3>
		<table class="table">
			<thead>
				<tr>
					<th scope="col">Stage</th>
					<th scope="col">Value</th>
					<th scope="col">Availability</th>
				</tr>
			</thead>
			<tbody>
				{#each vm.funnel as stage (stage.id)}
					<tr data-testid={`funnel-stage-${stage.id}`}>
						<td>{stage.label}</td>
						<td>
							{stage.value === null ? '—' : stage.value}
							{#if stage.note}
								<span class="muted"> · {stage.note}</span>
							{/if}
						</td>
						<td>{stage.availability}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="block" data-testid="population-lexicon-matrix" aria-label="Population lexicons">
		<h3>Population lexicons</h3>
		{#if filterCreatureId}
			<p class="hint">Filtered to {filterCreatureId}</p>
		{/if}
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th scope="col">Creature</th>
						<th scope="col">Food</th>
						<th scope="col">Water</th>
						<th scope="col">Evidence</th>
					</tr>
				</thead>
				<tbody>
					{#each matrixRows as row (row.creatureId)}
						<tr>
							<td>
								<button
									type="button"
									class="linkish"
									data-testid={`lexicon-matrix-${row.creatureId}`}
									onclick={() => onNavigate({ kind: 'creatures', creatureId: row.creatureId })}
								>
									{row.creatureId}
								</button>
							</td>
							<td>
								{#if row.foodSymbolId}
									<SymbolGlyph symbolId={row.foodSymbolId} showId={false} />
								{:else}
									—
								{/if}
							</td>
							<td>
								{#if row.waterSymbolId}
									<SymbolGlyph symbolId={row.waterSymbolId} showId={false} />
								{:else}
									—
								{/if}
							</td>
							<td>{row.evidenceCount}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	{#each [vm.population.food, vm.population.water] as ctx (ctx.context)}
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
						{ctx.creaturesUnassigned}/{vm.population.creatureCount}
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
	{/each}

	<section
		class="block"
		data-testid="announcement-memory-summary"
		aria-label="Announcement memory and execution"
	>
		<h3>Announcement memory</h3>
		<p class="hint">
			Execution-local announcement state and retained announcement memories (not a full causal
			audit).
		</p>
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th scope="col">Creature</th>
						<th scope="col">Ann. memories</th>
						<th scope="col">Active trigger</th>
						<th scope="col">Active state</th>
					</tr>
				</thead>
				<tbody>
					{#each vm.announcementMemorySummaries as row (row.creatureId)}
						<tr data-testid={`announcement-memory-row-${row.creatureId}`}>
							<td>
								<button
									type="button"
									class="linkish"
									onclick={() => onNavigate({ kind: 'creatures', creatureId: row.creatureId })}
								>
									{row.creatureId}
								</button>
							</td>
							<td>{row.announcementMemoryCount}</td>
							<td>{row.activeTriggerFeatureId ?? '—'}</td>
							<td>{row.activeState ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="block" data-testid="live-communication-feed" aria-label="Live communication">
		<h3>Live communication</h3>
		{#if vm.liveFeed.length === 0}
			<p class="empty">No recent communication activity in bounded histories.</p>
		{:else}
			<ul class="feed">
				{#each vm.liveFeed as item (item.id)}
					<li>
						<span class="time">{item.timeSeconds.toFixed(2)}s</span>
						{item.summary}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="block" data-testid="heard-signal-memories" aria-label="Heard signal memories">
		<h3>Heard-signal memories</h3>
		<p class="hint">
			Retained heard signals eligible for investigation via intention arbitration. Selected =
			currently investigating that emission.
		</p>
		{#if vm.heardSignalMemories.length === 0}
			<p class="empty">No heard-signal memories retained.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th scope="col">Listener</th>
							<th scope="col">Symbol</th>
							<th scope="col">Remembered</th>
							<th scope="col">Origin</th>
							<th scope="col">Selected</th>
						</tr>
					</thead>
					<tbody>
						{#each vm.heardSignalMemories as row (row.listenerId + row.emissionId)}
							<tr data-testid={`heard-signal-row-${row.listenerId}-${row.emissionId}`}>
								<td>
									<button
										type="button"
										class="linkish"
										onclick={() => onNavigate({ kind: 'creatures', creatureId: row.listenerId })}
									>
										{row.listenerId}
									</button>
								</td>
								<td><SymbolGlyph symbolId={row.symbolId} /></td>
								<td>{row.rememberedAt.toFixed(2)}s</td>
								<td>({row.originX.toFixed(1)}, {row.originY.toFixed(1)})</td>
								<td>{row.selected ? 'yes' : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="block" data-testid="active-investigations" aria-label="Investigations">
		<h3>Active investigations</h3>
		{#if vm.activeInvestigations.length === 0}
			<p class="empty">None active.</p>
		{:else}
			<table class="table">
				<thead>
					<tr>
						<th scope="col">Listener</th>
						<th scope="col">Symbol</th>
						<th scope="col">Origin</th>
						<th scope="col">Started</th>
					</tr>
				</thead>
				<tbody>
					{#each vm.activeInvestigations as inv (inv.emissionId + inv.listenerId)}
						<tr>
							<td>{inv.listenerId}</td>
							<td><SymbolGlyph symbolId={inv.symbolId} /></td>
							<td>({inv.originX.toFixed(2)}, {inv.originY.toFixed(2)})</td>
							<td>{inv.startedAt.toFixed(2)}s</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		<p class="hint">
			Completed outcomes (recent history): food={vm.completedOutcomes.food_evidence}, water={vm
				.completedOutcomes.water_evidence}, mixed={vm.completedOutcomes.mixed_evidence}, none={vm
				.completedOutcomes.no_evidence}, interrupted={vm.completedOutcomes.interrupted}
		</p>
	</section>
</div>

<style>
	.communication {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.block h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.hint,
	.empty {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}

	.summary {
		margin: 0.35rem 0 0;
		font-size: 0.78rem;
		color: #d1d5db;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem 0.75rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #0f172a;
		font-size: 0.75rem;
	}

	.legend-title {
		color: #94a3b8;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		font-size: 0.65rem;
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

	.muted {
		color: #64748b;
		font-size: 0.68rem;
	}

	.linkish {
		padding: 0;
		border: none;
		background: none;
		color: #93c5fd;
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}

	.feed {
		margin: 0;
		padding-left: 1rem;
		font-size: 0.72rem;
		color: #cbd5e1;
		line-height: 1.4;
		max-height: 12rem;
		overflow: auto;
	}

	.time {
		color: #94a3b8;
		margin-right: 0.35rem;
		font-variant-numeric: tabular-nums;
	}
</style>
