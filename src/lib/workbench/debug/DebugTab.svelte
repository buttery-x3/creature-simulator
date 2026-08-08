<script lang="ts">
	import { formatHabitatDiagnostics } from '$lib/habitat';
	import {
		formatCreatureInspection,
		formatSimulationDiagnostics,
		simulationSnapshot,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';
	import { formatCreatureMemoryJson } from '../view-models/creature-detail-view-model';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		paused: boolean;
		selectedCreatureId: string | null;
	};

	let { simulation, config, paused, selectedCreatureId }: Props = $props();

	const habitatDiagnostics = $derived(formatHabitatDiagnostics(simulation.habitat));
	const simulationDiagnostics = $derived(
		formatSimulationDiagnostics(simulation, {
			paused,
			config: {
				symbolInventory: config.symbolInventory,
				recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
			}
		})
	);

	const selectedCreature = $derived(
		simulation.creatures.find((c) => c.id === selectedCreatureId) ?? null
	);

	const creatureInspection = $derived(
		selectedCreature
			? formatCreatureInspection(selectedCreature, simulation.timeSeconds, {
					sensingRadius: config.sensingRadius,
					hearingRadius: config.hearingRadius,
					symbolInventory: config.symbolInventory,
					explorationDistanceWeight: config.explorationDistanceWeight,
					explorationStalenessWeight: config.explorationStalenessWeight,
					explorationStalenessScaleSeconds: config.explorationStalenessScaleSeconds,
					worldBounds: simulation.habitat.bounds
				})
			: null
	);

	const creatureMemoryJson = $derived(
		selectedCreature ? formatCreatureMemoryJson(selectedCreature.memory) : null
	);

	const configJson = $derived(JSON.stringify(config, null, 2));
	const snapshot = $derived(simulationSnapshot(simulation));
	const environmentJson = $derived(JSON.stringify(simulation.environment, null, 2));

	async function copyText(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard may be unavailable in some test environments; still expose text in pre.
			console.info(`Copy failed for ${label}`);
		}
	}
</script>

<div class="debug" data-testid="debug-tab">
	<section class="block">
		<div class="heading-row">
			<h3>Simulation diagnostics</h3>
			<button
				type="button"
				onclick={() => copyText(simulationDiagnostics, 'simulation')}
				data-testid="debug-copy-simulation"
			>
				Copy
			</button>
		</div>
		<pre data-testid="simulation-diagnostics">{simulationDiagnostics}</pre>
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Habitat diagnostics</h3>
			<button
				type="button"
				onclick={() => copyText(habitatDiagnostics, 'habitat')}
				data-testid="debug-copy-habitat"
			>
				Copy
			</button>
		</div>
		<pre data-testid="habitat-diagnostics">{habitatDiagnostics}</pre>
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Selected creature inspection</h3>
			{#if creatureInspection}
				<button
					type="button"
					onclick={() => copyText(creatureInspection, 'creature')}
					data-testid="debug-copy-creature"
				>
					Copy
				</button>
			{/if}
		</div>
		{#if creatureInspection}
			<pre data-testid="creature-inspection-text">{creatureInspection}</pre>
		{:else}
			<p class="empty">No creature selected.</p>
		{/if}
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Selected creature memory</h3>
			{#if creatureMemoryJson}
				<button
					type="button"
					onclick={() => copyText(creatureMemoryJson, 'memory')}
					data-testid="debug-copy-memory"
				>
					Copy
				</button>
			{/if}
		</div>
		{#if creatureMemoryJson}
			<pre data-testid="debug-creature-memory">{creatureMemoryJson}</pre>
		{:else}
			<p class="empty">No creature selected.</p>
		{/if}
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Environment / resources (raw)</h3>
			<button
				type="button"
				onclick={() => copyText(environmentJson, 'environment')}
				data-testid="debug-copy-environment"
			>
				Copy
			</button>
		</div>
		<pre data-testid="debug-environment-json">{environmentJson}</pre>
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Simulation configuration</h3>
			<button type="button" onclick={() => copyText(configJson, 'config')}>Copy</button>
		</div>
		<pre data-testid="debug-config-json">{configJson}</pre>
	</section>

	<section class="block">
		<div class="heading-row">
			<h3>Seed</h3>
		</div>
		<p class="seed" data-testid="debug-seed">{simulation.seed}</p>
	</section>

	<details class="block">
		<summary>Serialised simulation snapshot</summary>
		<div class="heading-row">
			<button type="button" onclick={() => copyText(snapshot, 'snapshot')}>Copy snapshot</button>
		</div>
		<pre data-testid="debug-simulation-snapshot">{snapshot}</pre>
	</details>
</div>

<style>
	.debug {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.block h3,
	summary {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.heading-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.heading-row button {
		padding: 0.25rem 0.45rem;
		border: 1px solid #334155;
		border-radius: 0.3rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}

	pre {
		margin: 0;
		padding: 0.55rem;
		border-radius: 0.35rem;
		background: #020617;
		border: 1px solid #1e293b;
		color: #94a3b8;
		font-size: 0.68rem;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 16rem;
		overflow: auto;
	}

	.empty {
		margin: 0;
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.seed {
		margin: 0;
		font-size: 0.85rem;
		color: #e2e8f0;
		font-family: ui-monospace, monospace;
	}

	details.block {
		border-top: 1px solid #1e293b;
		padding-top: 0.5rem;
	}

	summary {
		cursor: pointer;
		margin-bottom: 0.35rem;
	}
</style>
