<script lang="ts">
	import type { HabitatFeature } from '$lib/habitat';
	import type { SimulationConfig, SimulationState } from '$lib/simulation';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		focusedFeatureId?: string | null;
	};

	let { simulation, config, focusedFeatureId = null }: Props = $props();

	const habitat = $derived(simulation.habitat);

	function featureRows(features: readonly HabitatFeature[]) {
		return features.map((f) => ({
			id: f.id,
			kind: f.kind,
			x: f.position.x,
			y: f.position.y,
			width: f.size.width,
			height: f.size.height
		}));
	}

	const home = $derived(featureRows([habitat.home]));
	const food = $derived(featureRows(habitat.food));
	const water = $derived(featureRows(habitat.water));
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
		</dl>
	</section>

	{#each [{ title: 'Home region', rows: home, testid: 'world-home-table' }, { title: 'Food features', rows: food, testid: 'world-food-table' }, { title: 'Water features', rows: water, testid: 'world-water-table' }] as group (group.testid)}
		<section class="block">
			<h3>{group.title}</h3>
			<div class="table-wrap">
				<table class="table" data-testid={group.testid}>
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
						{#each group.rows as row (row.id)}
							<tr
								class:focused={focusedFeatureId === row.id}
								data-testid={`world-feature-${row.id}`}
							>
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
	{/each}

	<p class="hint">
		Future ecology (depletion, shelter, weather, predators, hazards) belongs in this tab when those
		systems exist.
	</p>
</div>

<style>
	.world {
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

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
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
		white-space: nowrap;
	}

	.table th {
		color: #94a3b8;
		font-weight: 600;
	}

	.table tr.focused {
		background: #1e3a5f;
		outline: 1px solid #3b82f6;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: #64748b;
		line-height: 1.35;
	}
</style>
