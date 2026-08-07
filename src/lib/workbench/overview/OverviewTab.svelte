<script lang="ts">
	import type { SimulationState } from '$lib/simulation';
	import { buildOverviewViewModel } from '../view-models/overview-view-model';
	import RunControls from './RunControls.svelte';

	type Props = {
		simulation: SimulationState;
		seedInput: string;
		errorMessage: string | null;
		paused: boolean;
		onSeedInput: (value: string) => void;
		onRegenerate: () => void;
		onRandomSeed: () => void;
		onTogglePause: () => void;
		onReset: () => void;
	};

	let {
		simulation,
		seedInput,
		errorMessage,
		paused,
		onSeedInput,
		onRegenerate,
		onRandomSeed,
		onTogglePause,
		onReset
	}: Props = $props();

	const overview = $derived(buildOverviewViewModel(simulation));
	const w = $derived(overview.wellbeing);
	const b = $derived(overview.behaviour);
	const world = $derived(overview.world);
</script>

<div class="overview" data-testid="overview-tab">
	<RunControls
		{seedInput}
		activeSeed={simulation.seed}
		timeSeconds={simulation.timeSeconds}
		{paused}
		creatureCount={w.creatureCount}
		signalCount={simulation.activeEmissions.length}
		{errorMessage}
		{onSeedInput}
		{onRegenerate}
		{onRandomSeed}
		{onTogglePause}
		{onReset}
	/>

	<section class="block" data-testid="overview-wellbeing" aria-label="Population wellbeing">
		<h3>Population wellbeing</h3>
		<div class="cards">
			<div class="card">
				<span class="label">Creatures</span>
				<span class="value">{w.creatureCount}</span>
			</div>
			<div class="card">
				<span class="label">Avg hunger</span>
				<span class="value">{w.averageHunger.toFixed(3)}</span>
				<div
					class="bar"
					role="meter"
					aria-label={`Average hunger ${w.averageHunger.toFixed(3)}`}
					aria-valuemin={0}
					aria-valuemax={1}
					aria-valuenow={w.averageHunger}
				>
					<span class="fill pressure" style:width={`${w.averageHunger * 100}%`}></span>
				</div>
			</div>
			<div class="card">
				<span class="label">Avg thirst</span>
				<span class="value">{w.averageThirst.toFixed(3)}</span>
				<div
					class="bar"
					role="meter"
					aria-label={`Average thirst ${w.averageThirst.toFixed(3)}`}
					aria-valuemin={0}
					aria-valuemax={1}
					aria-valuenow={w.averageThirst}
				>
					<span class="fill pressure" style:width={`${w.averageThirst * 100}%`}></span>
				</div>
			</div>
			<div class="card">
				<span class="label">Avg energy</span>
				<span class="value">{w.averageEnergy.toFixed(3)}</span>
				<div
					class="bar"
					role="meter"
					aria-label={`Average energy ${w.averageEnergy.toFixed(3)}`}
					aria-valuemin={0}
					aria-valuemax={1}
					aria-valuenow={w.averageEnergy}
				>
					<span class="fill energy" style:width={`${w.averageEnergy * 100}%`}></span>
				</div>
			</div>
		</div>
		<ul class="extrema">
			{#if w.highestHunger}
				<li data-testid="overview-highest-hunger">
					Highest hunger: {w.highestHunger.value.toFixed(3)} ({w.highestHunger.creatureId})
				</li>
			{/if}
			{#if w.highestThirst}
				<li data-testid="overview-highest-thirst">
					Highest thirst: {w.highestThirst.value.toFixed(3)} ({w.highestThirst.creatureId})
				</li>
			{/if}
			{#if w.lowestEnergy}
				<li data-testid="overview-lowest-energy">
					Lowest energy: {w.lowestEnergy.value.toFixed(3)} ({w.lowestEnergy.creatureId})
				</li>
			{/if}
		</ul>
	</section>

	<section class="block" data-testid="overview-behaviour" aria-label="Behaviour snapshot">
		<h3>Behaviour snapshot</h3>
		<table class="table">
			<thead>
				<tr>
					<th scope="col">Intention</th>
					<th scope="col">Count</th>
				</tr>
			</thead>
			<tbody>
				{#each Object.entries(b.byIntention) as [intention, count] (intention)}
					<tr data-testid={`overview-goal-${intention}`}>
						<td>{intention}</td>
						<td>{count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="block" data-testid="overview-world" aria-label="World snapshot">
		<h3>World snapshot</h3>
		<dl class="meta">
			<div>
				<dt>Dimensions</dt>
				<dd>{world.worldWidth} × {world.worldHeight}</dd>
			</div>
			<div>
				<dt>Food</dt>
				<dd>{world.foodCount}</dd>
			</div>
			<div>
				<dt>Water</dt>
				<dd>{world.waterCount}</dd>
			</div>
			<div>
				<dt>Home regions</dt>
				<dd>{world.homeCount}</dd>
			</div>
			<div>
				<dt>Predators</dt>
				<dd>{world.predatorCount}</dd>
			</div>
			<div>
				<dt>Active announcements</dt>
				<dd>{world.activeAnnouncementCount}</dd>
			</div>
		</dl>
	</section>

	<section class="block" data-testid="overview-alerts" aria-label="Alerts">
		<h3>Alerts</h3>
		{#if overview.alerts.length === 0}
			<p class="empty">No current alerts.</p>
		{:else}
			<ul class="alerts">
				{#each overview.alerts as alert (alert.id)}
					<li class={alert.severity}>{alert.message}</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.overview {
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

	.cards {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.45rem 0.5rem;
		border: 1px solid #1e293b;
		border-radius: 0.35rem;
		background: #0f172a;
	}

	.label {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.value {
		font-size: 0.95rem;
		color: #e2e8f0;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 0.35rem;
		border-radius: 999px;
		background: #1e293b;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: inherit;
	}

	.fill.pressure {
		background: #f59e0b;
	}

	.fill.energy {
		background: #22c55e;
	}

	.extrema {
		margin: 0.45rem 0 0;
		padding-left: 1.1rem;
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
		color: #e2e8f0;
	}

	.table th,
	.table td {
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid #1e293b;
		text-align: left;
	}

	.table th {
		color: #94a3b8;
		font-weight: 600;
	}

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 0.35rem;
	}

	.meta dt {
		margin: 0;
		color: #94a3b8;
	}

	.meta dd {
		margin: 0;
		color: #e2e8f0;
	}

	.empty {
		margin: 0;
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.alerts {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.alerts .warning {
		color: #fbbf24;
	}

	.alerts .info {
		color: #93c5fd;
	}
</style>
