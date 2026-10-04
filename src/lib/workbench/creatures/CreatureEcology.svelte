<script lang="ts">
	import type { Creature } from '$lib/simulation';
	let { creature, timeSeconds }: { creature: Creature; timeSeconds: number } = $props();
</script>

<section data-testid="creature-ecology" aria-label="Body and local wildlife">
	<h3>Body & local wildlife</h3>
	<dl>
		<div>
			<dt>Size</dt>
			<dd data-testid="inspector-body-size">{creature.body.size.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Physicality</dt>
			<dd data-testid="inspector-physicality">{creature.body.physicality.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Health</dt>
			<dd data-testid="inspector-health">{(creature.body.health * 100).toFixed(1)}%</dd>
		</div>
	</dl>
	<p>
		Only locally observed animals appear here. Knowledge can become stale between sensing updates.
	</p>
	{#if creature.perceivedWildlife.length === 0}<p>No wildlife currently observed.</p>{:else}
		<div class="table-wrap">
			<table data-testid="inspector-local-wildlife">
				<thead
					><tr
						><th>ID</th><th>Size</th><th>Physicality</th><th>Health</th><th>Food</th><th>Age</th
						></tr
					></thead
				>
				<tbody
					>{#each creature.perceivedWildlife as animal (animal.id)}<tr>
							<td>{animal.id}</td><td>{animal.size.toFixed(2)}</td><td
								>{animal.physicality.toFixed(2)}</td
							>
							<td>{(animal.health * 100).toFixed(0)}%</td><td>{animal.foodAmount.toFixed(2)}</td><td
								>{Math.max(0, timeSeconds - animal.observedAt).toFixed(1)}s</td
							>
						</tr>{/each}</tbody
				>
			</table>
		</div>{/if}
</section>

<style>
	section {
		margin-bottom: 1rem;
	}
	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	p {
		color: #94a3b8;
		font-size: 0.75rem;
	}
	dl {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		font-size: 0.78rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.35rem;
	}
	dt {
		color: #94a3b8;
	}
	dd {
		margin: 0;
		color: #e2e8f0;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.3rem;
		border-bottom: 1px solid #1e293b;
		color: #cbd5e1;
	}
	th {
		color: #94a3b8;
	}
</style>
