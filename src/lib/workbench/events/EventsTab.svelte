<script lang="ts">
	import type { SimulationState } from '$lib/simulation';
	import { buildEventRows, filterEventRows, type EventRow } from '../view-models/events-view-model';
	import {
		DEFAULT_EVENT_FILTER,
		type EventCategory,
		type EventFilterState,
		type WorkbenchNavigate
	} from '../workbench-types';

	type Props = {
		simulation: SimulationState;
		filter: EventFilterState;
		onFilterChange: (filter: EventFilterState) => void;
		onNavigate: (intent: WorkbenchNavigate) => void;
	};

	let { simulation, filter, onFilterChange, onNavigate }: Props = $props();

	const allRows = $derived(buildEventRows(simulation));
	const rows = $derived(filterEventRows(allRows, filter, simulation.timeSeconds));
	let expandedId = $state<string | null>(null);

	const categories: Array<EventCategory | 'all'> = [
		'all',
		'Behaviour',
		'Perception',
		'Communication',
		'Investigation',
		'Learning',
		'Lexicon',
		'World'
	];

	const creatureOptions = $derived(['all', ...simulation.creatures.map((c) => c.id)]);

	function patch(partial: Partial<EventFilterState>) {
		onFilterChange({ ...filter, ...partial });
	}

	function onRowActivate(row: EventRow) {
		expandedId = expandedId === row.id ? null : row.id;
	}
</script>

<div class="events" data-testid="events-tab">
	<section class="filters" data-testid="event-filters" aria-label="Event filters">
		<label>
			<span>Category</span>
			<select
				data-testid="event-filter-category"
				value={filter.category}
				onchange={(e) => patch({ category: e.currentTarget.value as EventFilterState['category'] })}
			>
				{#each categories as cat (cat)}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Creature</span>
			<select
				data-testid="event-filter-creature"
				value={filter.creatureId}
				onchange={(e) => patch({ creatureId: e.currentTarget.value })}
			>
				{#each creatureOptions as id (id)}
					<option value={id}>{id}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Window (s)</span>
			<input
				data-testid="event-filter-window"
				type="number"
				min="0"
				step="1"
				placeholder="all"
				value={filter.windowSeconds ?? ''}
				oninput={(e) => {
					const raw = e.currentTarget.value;
					patch({ windowSeconds: raw === '' ? null : Number(raw) });
				}}
			/>
		</label>
		<button
			type="button"
			data-testid="event-filter-reset"
			onclick={() => onFilterChange({ ...DEFAULT_EVENT_FILTER })}
		>
			Reset filters
		</button>
	</section>

	<div class="table-wrap">
		<table class="table" data-testid="events-table">
			<thead>
				<tr>
					<th scope="col">Time</th>
					<th scope="col">Category</th>
					<th scope="col">Creature</th>
					<th scope="col">Event</th>
					<th scope="col">Subject</th>
					<th scope="col">Result</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr
						class:expanded={expandedId === row.id}
						data-testid={`event-row-${row.id}`}
						onclick={() => onRowActivate(row)}
					>
						<td>{row.timeSeconds.toFixed(2)}</td>
						<td>{row.category}</td>
						<td>
							{#if row.creatureId}
								<button
									type="button"
									class="linkish"
									onclick={(e) => {
										e.stopPropagation();
										onNavigate({ kind: 'creatures', creatureId: row.creatureId });
									}}
								>
									{row.creatureId}
								</button>
							{:else}
								—
							{/if}
						</td>
						<td>{row.event}</td>
						<td>
							{#if row.symbolId}
								<button
									type="button"
									class="linkish"
									onclick={(e) => {
										e.stopPropagation();
										onNavigate({ kind: 'communication' });
									}}
								>
									{row.subject}
								</button>
							{:else if row.featureId}
								<button
									type="button"
									class="linkish"
									onclick={(e) => {
										e.stopPropagation();
										onNavigate({ kind: 'world', featureId: row.featureId });
									}}
								>
									{row.subject}
								</button>
							{:else}
								{row.subject}
							{/if}
						</td>
						<td>{row.result}</td>
					</tr>
					{#if expandedId === row.id}
						<tr class="detail" data-testid={`event-detail-${row.id}`}>
							<td colspan="6">
								<pre>{JSON.stringify(row.detail, null, 2)}</pre>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="6" class="empty">No events match the current filters.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="hint">
		Built from bounded creature histories and active emissions — not a full authoritative audit log.
	</p>
</div>

<style>
	.events {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		align-items: end;
	}

	.filters label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.filters select,
	.filters input {
		padding: 0.3rem 0.4rem;
		border: 1px solid #334155;
		border-radius: 0.3rem;
		background: #111827;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.75rem;
		min-width: 6rem;
	}

	.filters button {
		padding: 0.35rem 0.5rem;
		border: 1px solid #334155;
		border-radius: 0.3rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.table-wrap {
		overflow: auto;
		max-height: none;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
		color: #e2e8f0;
	}

	.table th,
	.table td {
		padding: 0.28rem 0.3rem;
		border-bottom: 1px solid #1e293b;
		text-align: left;
		vertical-align: top;
	}

	.table th {
		color: #94a3b8;
		font-weight: 600;
		position: sticky;
		top: 0;
		background: #0b1220;
	}

	.table tbody tr {
		cursor: pointer;
	}

	.table tbody tr:hover {
		background: #111827;
	}

	.table tbody tr.expanded {
		background: #1e293b;
	}

	.detail pre {
		margin: 0;
		padding: 0.4rem;
		background: #020617;
		border-radius: 0.3rem;
		color: #94a3b8;
		font-size: 0.68rem;
		white-space: pre-wrap;
		word-break: break-word;
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

	.empty {
		color: #94a3b8;
		text-align: center;
	}

	.hint {
		margin: 0;
		font-size: 0.7rem;
		color: #64748b;
	}
</style>
