<script lang="ts">
	import { formatHabitatDiagnostics, type Habitat } from '$lib/habitat';
	import {
		formatSimulationDiagnostics,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';
	import CreatureInspector from './CreatureInspector.svelte';
	import PopulationCommunicationPanel from './PopulationCommunicationPanel.svelte';

	type Props = {
		simulation: SimulationState;
		seedInput: string;
		errorMessage: string | null;
		config: SimulationConfig;
		paused: boolean;
		selectedCreatureId: string | null;
		onSeedInput: (value: string) => void;
		onRegenerate: () => void;
		onRandomSeed: () => void;
		onTogglePause: () => void;
		onReset: () => void;
		onSelectCreature: (creatureId: string | null) => void;
	};

	let {
		simulation,
		seedInput,
		errorMessage,
		config,
		paused,
		selectedCreatureId,
		onSeedInput,
		onRegenerate,
		onRandomSeed,
		onTogglePause,
		onReset,
		onSelectCreature
	}: Props = $props();

	const habitat: Habitat = $derived(simulation.habitat);
	const habitatDiagnostics = $derived(formatHabitatDiagnostics(habitat));
	const simulationDiagnostics = $derived(
		formatSimulationDiagnostics(simulation, {
			paused,
			config: {
				symbolInventory: config.symbolInventory,
				recentEmissionDiagnosticsWindowSeconds: config.recentEmissionDiagnosticsWindowSeconds
			}
		})
	);
</script>

<aside class="workbench" data-testid="habitat-workbench" aria-label="Simulation controls">
	<section class="panel">
		<h2>Simulation</h2>
		<p class="summary" data-testid="simulation-summary">
			{paused ? 'Paused' : 'Running'} · t={simulation.timeSeconds.toFixed(2)}s · creatures
			{simulation.creatures.length} · signals {simulation.activeEmissions.length}
		</p>

		<label class="field" for="habitat-seed">
			<span>Seed</span>
			<input
				id="habitat-seed"
				data-testid="habitat-seed-input"
				type="text"
				value={seedInput}
				oninput={(event) => onSeedInput(event.currentTarget.value)}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						onRegenerate();
					}
				}}
			/>
		</label>

		<div class="actions">
			<button type="button" data-testid="simulation-pause-resume" onclick={onTogglePause}>
				{paused ? 'Resume' : 'Pause'}
			</button>
			<button type="button" data-testid="simulation-reset" onclick={onReset}>Reset</button>
		</div>

		<div class="actions">
			<button type="button" data-testid="habitat-regenerate" onclick={onRegenerate}>
				Regenerate
			</button>
			<button type="button" data-testid="habitat-random-seed" onclick={onRandomSeed}>
				New random seed
			</button>
		</div>

		{#if errorMessage}
			<p class="error" data-testid="habitat-error" role="alert">{errorMessage}</p>
		{/if}

		<dl class="meta" data-testid="simulation-meta">
			<div>
				<dt>Active seed</dt>
				<dd data-testid="habitat-active-seed">{simulation.seed}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd data-testid="simulation-status">{paused ? 'paused' : 'running'}</dd>
			</div>
			<div>
				<dt>Sim time</dt>
				<dd data-testid="simulation-time">{simulation.timeSeconds.toFixed(3)} s</dd>
			</div>
			<div>
				<dt>Creatures</dt>
				<dd data-testid="simulation-creature-count">{simulation.creatures.length}</dd>
			</div>
			<div>
				<dt>World</dt>
				<dd>{config.habitat.worldWidth} × {config.habitat.worldHeight}</dd>
			</div>
			<div>
				<dt>Food / water</dt>
				<dd>{habitat.food.length} / {habitat.water.length}</dd>
			</div>
		</dl>
	</section>

	<CreatureInspector {simulation} {config} {selectedCreatureId} {onSelectCreature} />

	<PopulationCommunicationPanel {simulation} {config} />

	<section class="panel diagnostics">
		<h2>Creatures</h2>
		<pre data-testid="simulation-diagnostics">{simulationDiagnostics}</pre>
	</section>

	<section class="panel diagnostics">
		<h2>Habitat</h2>
		<pre data-testid="habitat-diagnostics">{habitatDiagnostics}</pre>
	</section>
</aside>

<style>
	.workbench {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 20rem;
		flex: 0 0 auto;
		min-height: 0;
		padding: 0.75rem;
		border-left: 1px solid #1f2937;
		background: #0b1220;
		overflow: auto;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.panel h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.summary {
		margin: 0;
		font-size: 0.85rem;
		color: #d1d5db;
		line-height: 1.4;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: #cbd5e1;
	}

	.field input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #111827;
		color: #e5e7eb;
		font: inherit;
	}

	.field input:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.actions button {
		flex: 1 1 auto;
		padding: 0.45rem 0.6rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.actions button:hover {
		background: #334155;
	}

	.error {
		margin: 0;
		padding: 0.45rem 0.55rem;
		border-radius: 0.35rem;
		background: #450a0a;
		color: #fecaca;
		font-size: 0.8rem;
		line-height: 1.35;
	}

	.meta {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.8rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 0.4rem;
	}

	.meta dt {
		margin: 0;
		color: #94a3b8;
	}

	.meta dd {
		margin: 0;
		color: #e2e8f0;
		word-break: break-word;
	}

	.diagnostics pre {
		margin: 0;
		padding: 0.55rem;
		border-radius: 0.35rem;
		background: #020617;
		border: 1px solid #1e293b;
		color: #94a3b8;
		font-size: 0.7rem;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 14rem;
		overflow: auto;
	}
</style>
