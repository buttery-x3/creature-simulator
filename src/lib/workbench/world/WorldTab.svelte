<script lang="ts">
	import type { ResourceFeature } from '$lib/habitat';
	import { isResourceFeature } from '$lib/habitat';
	import type { SimulationConfig, SimulationState } from '$lib/simulation';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		focusedFeatureId?: string | null;
	};

	let { simulation, config, focusedFeatureId = null }: Props = $props();

	const habitat = $derived(simulation.habitat);
	const environment = $derived(simulation.environment);

	function resourceRows(features: readonly ResourceFeature[]) {
		return features.map((f) => ({
			id: f.id,
			kind: f.kind,
			x: f.position.x,
			y: f.position.y,
			width: f.size.width,
			height: f.size.height,
			amount: f.amount,
			capacity: f.capacity,
			available: f.amount > 0
		}));
	}

	const home = $derived([
		{
			id: habitat.home.id,
			kind: habitat.home.kind,
			x: habitat.home.position.x,
			y: habitat.home.position.y,
			width: habitat.home.size.width,
			height: habitat.home.size.height
		}
	]);
	const food = $derived(resourceRows(habitat.food.filter(isResourceFeature)));
	const water = $derived(resourceRows(habitat.water.filter(isResourceFeature)));
	const availableFoodCount = $derived(food.filter((f) => f.available).length);
	const availableWaterCount = $derived(water.filter((w) => w.available).length);
</script>

<div class="world" data-testid="world-tab">
	<section class="block" data-testid="world-habitat-summary">
		<h3>Habitat</h3>
		<dl class="meta">
			<div>
				<dt>Seed</dt>
				<dd data-testid="world-seed">{habitat.seed}</dd>
			</div>
			<div>
				<dt>World dimensions</dt>
				<dd data-testid="world-dimensions">
					{habitat.bounds.width} × {habitat.bounds.height}
				</dd>
			</div>
			<div>
				<dt>Sensing radius</dt>
				<dd>{config.sensingRadius.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Hearing radius</dt>
				<dd>{config.hearingRadius.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Active food</dt>
				<dd data-testid="world-active-food-count">{habitat.food.length}</dd>
			</div>
			<div>
				<dt>Available food</dt>
				<dd data-testid="world-available-food-count">{availableFoodCount}</dd>
			</div>
			<div>
				<dt>Water basins</dt>
				<dd data-testid="world-water-count">{habitat.water.length}</dd>
			</div>
			<div>
				<dt>Available water</dt>
				<dd data-testid="world-available-water-count">{availableWaterCount}</dd>
			</div>
		</dl>
	</section>

	<section class="block" data-testid="world-environment">
		<h3>Environment</h3>
		<dl class="meta">
			<div>
				<dt>Weather</dt>
				<dd data-testid="world-weather">{environment.weather}</dd>
			</div>
			<div>
				<dt>Next rain at</dt>
				<dd data-testid="world-next-rain-at">{environment.nextRainAt.toFixed(3)}s</dd>
			</div>
			<div>
				<dt>Rain ends at</dt>
				<dd data-testid="world-rain-ends-at">
					{environment.weather === 'rain' ? `${environment.weatherPhaseEndsAt.toFixed(3)}s` : '—'}
				</dd>
			</div>
			<div>
				<dt>Next food spawn</dt>
				<dd data-testid="world-next-food-spawn">{environment.nextFoodSpawnAt.toFixed(3)}s</dd>
			</div>
			<div>
				<dt>Last food spawn</dt>
				<dd data-testid="world-last-food-spawn">
					{environment.lastFoodSpawnOutcome ?? '—'}
					{#if environment.lastFoodSpawnAt !== null}
						@ {environment.lastFoodSpawnAt.toFixed(3)}s
					{/if}
				</dd>
			</div>
			<div>
				<dt>Max active food</dt>
				<dd>{config.maxActiveFoodSources}</dd>
			</div>
		</dl>
	</section>

	<section class="block">
		<h3>Home region</h3>
		<div class="table-wrap">
			<table class="table" data-testid="world-home-table">
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">Kind</th>
						<th scope="col">X</th>
						<th scope="col">Y</th>
						<th scope="col">Width</th>
						<th scope="col">Height</th>
					</tr>
				</thead>
				<tbody>
					{#each home as row (row.id)}
						<tr class:focused={focusedFeatureId === row.id} data-testid={`world-feature-${row.id}`}>
							<td>{row.id}</td>
							<td>{row.kind}</td>
							<td>{row.x.toFixed(3)}</td>
							<td>{row.y.toFixed(3)}</td>
							<td>{row.width.toFixed(3)}</td>
							<td>{row.height.toFixed(3)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="block">
		<h3>Food features</h3>
		<div class="table-wrap">
			<table class="table" data-testid="world-food-table">
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">X</th>
						<th scope="col">Y</th>
						<th scope="col">Amount</th>
						<th scope="col">Capacity</th>
						<th scope="col">Available</th>
					</tr>
				</thead>
				<tbody>
					{#each food as row (row.id)}
						<tr class:focused={focusedFeatureId === row.id} data-testid={`world-feature-${row.id}`}>
							<td>{row.id}</td>
							<td>{row.x.toFixed(3)}</td>
							<td>{row.y.toFixed(3)}</td>
							<td>{row.amount.toFixed(3)}</td>
							<td>{row.capacity.toFixed(3)}</td>
							<td>{row.available ? 'yes' : 'no'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="block">
		<h3>Water features</h3>
		<div class="table-wrap">
			<table class="table" data-testid="world-water-table">
				<thead>
					<tr>
						<th scope="col">ID</th>
						<th scope="col">X</th>
						<th scope="col">Y</th>
						<th scope="col">Amount</th>
						<th scope="col">Capacity</th>
						<th scope="col">Available</th>
					</tr>
				</thead>
				<tbody>
					{#each water as row (row.id)}
						<tr class:focused={focusedFeatureId === row.id} data-testid={`world-feature-${row.id}`}>
							<td>{row.id}</td>
							<td>{row.x.toFixed(3)}</td>
							<td>{row.y.toFixed(3)}</td>
							<td>{row.amount.toFixed(3)}</td>
							<td>{row.capacity.toFixed(3)}</td>
							<td>{row.available ? 'yes' : 'empty'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.world {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.25rem 0.15rem 1rem;
	}

	.block h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.45rem 0.75rem;
		margin: 0;
	}

	.meta div {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.meta dt {
		font-size: 0.68rem;
		color: #64748b;
	}

	.meta dd {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
		color: #e2e8f0;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.table th,
	.table td {
		padding: 0.28rem 0.4rem;
		text-align: left;
		border-bottom: 1px solid #1e293b;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		color: #cbd5e1;
	}

	.table th {
		font-weight: 600;
		color: #94a3b8;
		font-family: inherit;
	}

	.table tr.focused td {
		background: rgba(56, 189, 248, 0.08);
	}
</style>
