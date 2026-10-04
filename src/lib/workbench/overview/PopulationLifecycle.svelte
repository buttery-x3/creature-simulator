<script lang="ts">
	import type { LifeEvent } from '$lib/simulation';
	import type { PopulationLifecycle } from '../view-models/overview-view-model';
	let { population, events }: { population: PopulationLifecycle; events: readonly LifeEvent[] } =
		$props();
</script>

<section data-testid="overview-lifecycle" aria-label="Population lifecycle">
	<h3>Population lifecycle</h3>
	<dl>
		<div>
			<dt>Mean age</dt>
			<dd>
				{population.highestGeneration === null
					? '—'
					: population.averageAgeSeconds.toFixed(1) + 's'}
			</dd>
		</div>
		<div>
			<dt>Youngest / oldest</dt>
			<dd>
				{population.youngestAgeSeconds?.toFixed(1) ?? '—'} / {population.oldestAgeSeconds?.toFixed(
					1
				) ?? '—'}s
			</dd>
		</div>
		<div>
			<dt>Highest generation</dt>
			<dd>{population.highestGeneration ?? '—'}</dd>
		</div>
		<div>
			<dt>Recent births / deaths</dt>
			<dd data-testid="overview-life-counts">
				{population.recentBirthCount} / {population.recentDeathCount}
			</dd>
		</div>
		<div>
			<dt>Recent failed courtships</dt>
			<dd>{population.recentCourtshipFailureCount}</dd>
		</div>
	</dl>
	<p>
		Observer records from bounded history ({events.length} retained); counts are not all-time totals.
	</p>
	{#if events.length}
		<details>
			<summary>Recent lifecycle events</summary>
			<ul data-testid="overview-life-events">
				{#each [...events].reverse() as event (event)}
					<li>
						{event.time.toFixed(1)}s · {#if event.kind === 'birth'}birth {event.creatureId} · generation
							{event.generation} · parents {event.parentIds.join(
								', '
							)}{:else if event.kind === 'death'}death {event.creatureId} · {event.cause}{:else}courtship
							failed · {event.creatureIds.join(', ')} · {event.reason}{/if}
					</li>
				{/each}
			</ul>
		</details>
	{:else}<p>No lifecycle events retained.</p>{/if}
</section>

<style>
	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	dl {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 11rem 1fr;
		gap: 0.35rem;
	}
	dt {
		color: #94a3b8;
	}
	dd {
		margin: 0;
		color: #e2e8f0;
	}
	p,
	details {
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.4;
	}
	summary {
		cursor: pointer;
	}
	ul {
		padding-left: 1.1rem;
	}
	li {
		margin: 0.35rem 0;
		color: #cbd5e1;
	}
</style>
