<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import { LEXICON_MEANINGS } from '$lib/simulation';
	import type {
		LexiconMatrixRow,
		LivingGenerationLexicons
	} from '../view-models/population-lexicon-view-model';
	import type { WorkbenchNavigate } from '../workbench-types';
	let {
		rows,
		generations,
		filterCreatureId = null,
		onNavigate
	}: {
		rows: LexiconMatrixRow[];
		generations: LivingGenerationLexicons[];
		filterCreatureId?: string | null;
		onNavigate: (intent: WorkbenchNavigate) => void;
	} = $props();
	const matrixRows = $derived(
		filterCreatureId ? rows.filter((row) => row.creatureId === filterCreatureId) : rows
	);
</script>

<section
	class="block"
	data-testid="population-living-generations"
	aria-label="Living generations and personal meanings"
>
	<h3>Living generations</h3>
	<p class="hint">
		Current living creatures only. Glyph counts show personal assignments, not a shared translation
		or evidence of inheritance. Genealogy is observer information. Individual filtering below does
		not change these population counts.
	</p>
	{#each generations as cohort (cohort.generation)}
		<details open data-testid={`living-generation-${cohort.generation}`}>
			<summary>Generation {cohort.generation} · {cohort.creatureCount} alive</summary>
			<dl>
				{#each cohort.meanings as row (row.meaning)}
					<div data-testid={`generation-${cohort.generation}-${row.meaning}`}>
						<dt>{row.meaning}</dt>
						<dd>
							{#each row.assignments as assignment (assignment.symbolId)}<span class="assignment"
									><SymbolGlyph symbolId={assignment.symbolId} showId={false} /> × {assignment.count}</span
								>{/each}
							<span class="unassigned">unassigned {row.unassigned}</span>
						</dd>
					</div>
				{/each}
			</dl>
		</details>
	{:else}<p class="hint">No living creatures.</p>{/each}
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
					<th scope="col">Gen.</th>
					{#each LEXICON_MEANINGS as meaning (meaning)}<th scope="col"
							>{meaning[0].toUpperCase() + meaning.slice(1)}</th
						>{/each}
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
						<td data-testid={`lexicon-generation-${row.creatureId}`}>{row.generation}</td>
						{#each LEXICON_MEANINGS as meaning (meaning)}
							<td
								>{#if row.lexicon[meaning]}<SymbolGlyph
										symbolId={row.lexicon[meaning]!}
										showId={false}
									/>{:else}—{/if}</td
							>
						{/each}
						<td>{row.evidenceCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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
	.hint {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}
	details {
		margin: 0.45rem 0;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		padding: 0.4rem 0.5rem;
	}
	summary {
		font-size: 0.76rem;
		color: #e2e8f0;
		cursor: pointer;
	}
	dl {
		margin: 0.5rem 0 0;
		font-size: 0.74rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.35rem;
		margin: 0.25rem 0;
	}
	dt {
		color: #94a3b8;
	}
	dd {
		margin: 0;
		display: flex;
		gap: 0.35rem 0.65rem;
		flex-wrap: wrap;
		color: #e2e8f0;
	}
	.assignment {
		white-space: nowrap;
	}
	.unassigned {
		color: #94a3b8;
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
	.linkish {
		padding: 0;
		border: none;
		background: none;
		color: #93c5fd;
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}
</style>
