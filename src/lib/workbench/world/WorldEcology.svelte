<script lang="ts">
	import { daylightAt, type SimulationConfig, type SimulationState } from '$lib/simulation';
	let { simulation, config }: { simulation: SimulationState; config: SimulationConfig } = $props();
	const daylight = $derived(daylightAt(simulation.timeSeconds, config.ecology));
</script>

<section data-testid="world-ecology" aria-label="Physical ecology">
	<h3>Physical ecology</h3>
	<dl>
		<div>
			<dt>Daylight</dt>
			<dd data-testid="world-daylight">{(daylight * 100).toFixed(0)}%</dd>
		</div>
		<div>
			<dt>Day length</dt>
			<dd>{config.ecology.dayLengthSeconds}s</dd>
		</div>
		<div>
			<dt>Living wildlife</dt>
			<dd>{simulation.wildlife.filter((animal) => animal.health > 0).length}</dd>
		</div>
		<div>
			<dt>Carcasses</dt>
			<dd>
				{simulation.wildlife.filter((animal) => animal.health <= 0 && animal.foodAmount > 0).length}
			</dd>
		</div>
	</dl>
	<p>
		Wildlife can be food or danger depending on relative ability and condition. These are
		observer-level world values; creatures use local sensing.
	</p>
	<div class="table-wrap">
		<table data-testid="world-wildlife-table">
			<thead
				><tr
					><th>ID</th><th>Mode</th><th>Size</th><th>Physicality</th><th>Health</th><th>Energy</th
					><th>Food</th></tr
				></thead
			>
			<tbody
				>{#each simulation.wildlife as animal (animal.id)}<tr>
						<td>{animal.id}</td><td>{animal.mode}</td><td>{animal.size.toFixed(2)}</td><td
							>{animal.physicality.toFixed(2)}</td
						>
						<td>{(animal.health * 100).toFixed(0)}%</td><td>{animal.energy.toFixed(2)}</td><td
							>{animal.foodAmount.toFixed(2)}</td
						>
					</tr>{/each}</tbody
			>
		</table>
	</div>
</section>
<section aria-label="Recent encounters">
	<h3>Recent encounters</h3>
	<p>Bounded history; ability is captured at the encounter, not inferred from current needs.</p>
	{#if simulation.recentEncounters.length === 0}<p>No encounters yet.</p>{:else}
		<div class="table-wrap">
			<table data-testid="world-encounters">
				<thead
					><tr
						><th>Time</th><th>Creature / animal</th><th>Event</th><th>Amount</th><th>Abilities</th
						></tr
					></thead
				>
				<tbody
					>{#each simulation.recentEncounters.slice().reverse() as event (event)}<tr>
							<td>{event.time.toFixed(1)}s</td><td>{event.creatureId} / {event.wildlifeId}</td><td
								>{event.kind.replaceAll('_', ' ')}</td
							>
							<td>{event.amount.toFixed(3)}</td><td
								>{event.creatureAbility.toFixed(2)} / {event.wildlifeAbility.toFixed(2)}</td
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
