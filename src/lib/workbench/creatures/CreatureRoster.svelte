<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import type { RosterRow } from '../view-models/creature-detail-view-model';

	type Props = {
		rows: RosterRow[];
		selectedCreatureId: string | null;
		onSelectCreature: (creatureId: string | null) => void;
	};

	let { rows, selectedCreatureId, onSelectCreature }: Props = $props();
</script>

<div class="roster-wrap" data-testid="creature-roster">
	<table class="roster">
		<thead>
			<tr>
				<th scope="col">Creature</th>
				<th scope="col">Hunger</th>
				<th scope="col">Thirst</th>
				<th scope="col">Energy</th>
				<th scope="col">Goal</th>
				<th scope="col">Food</th>
				<th scope="col">Water</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr
					class:selected={selectedCreatureId === row.id}
					data-testid={`creature-select-${row.id}`}
					aria-current={selectedCreatureId === row.id ? 'true' : undefined}
					onclick={() => onSelectCreature(row.id)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							onSelectCreature(row.id);
						}
					}}
					tabindex="0"
				>
					<td>{row.id}</td>
					<td>{row.hunger.toFixed(2)}</td>
					<td>{row.thirst.toFixed(2)}</td>
					<td>{row.energy.toFixed(2)}</td>
					<td>{row.goal}</td>
					<td>
						{#if row.foodSymbolId}
							<SymbolGlyph symbolId={row.foodSymbolId} showId={false} size={11} />
						{:else}
							—
						{/if}
					</td>
					<td>
						{#if row.waterSymbolId}
							<SymbolGlyph symbolId={row.waterSymbolId} showId={false} size={11} />
						{:else}
							—
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.roster-wrap {
		overflow-x: auto;
		border: 1px solid #1e293b;
		border-radius: 0.35rem;
	}

	.roster {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
		color: #e2e8f0;
	}

	.roster th,
	.roster td {
		padding: 0.28rem 0.35rem;
		border-bottom: 1px solid #1e293b;
		text-align: left;
		white-space: nowrap;
	}

	.roster th {
		color: #94a3b8;
		font-weight: 600;
		background: #0f172a;
		position: sticky;
		top: 0;
	}

	.roster tbody tr {
		cursor: pointer;
	}

	.roster tbody tr:hover {
		background: #111827;
	}

	.roster tbody tr.selected {
		background: #1e3a5f;
		outline: 1px solid #3b82f6;
	}

	.roster tbody tr:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}
</style>
