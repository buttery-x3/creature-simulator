<script lang="ts">
	import { formatHabitatDiagnostics, type Habitat } from '$lib/habitat';
	import {
		formatCreatureInspection,
		formatSimulationDiagnostics,
		type Creature,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';

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
	const simulationDiagnostics = $derived(formatSimulationDiagnostics(simulation, { paused }));
	const selectedCreature: Creature | null = $derived(
		simulation.creatures.find((c) => c.id === selectedCreatureId) ?? null
	);
	const inspectionText = $derived(
		selectedCreature
			? formatCreatureInspection(selectedCreature, simulation.timeSeconds, {
					sensingRadius: config.sensingRadius,
					trackedObservationDurationSeconds: config.trackedObservationDurationSeconds
				})
			: null
	);

	function formatTargetLabel(creature: Creature): string {
		const t = creature.target;
		if (!t) {
			return 'none';
		}
		if (t.kind === 'point') {
			return `point (${t.position.x.toFixed(2)}, ${t.position.y.toFixed(2)})`;
		}
		return `${t.featureKind}:${t.featureId}`;
	}
</script>

<aside class="workbench" data-testid="habitat-workbench" aria-label="Simulation controls">
	<section class="panel">
		<h2>Simulation</h2>
		<p class="summary" data-testid="simulation-summary">
			{paused ? 'Paused' : 'Running'} · t={simulation.timeSeconds.toFixed(2)}s · creatures
			{simulation.creatures.length}
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

	<section class="panel" data-testid="creature-inspector">
		<h2>Inspector</h2>
		<p class="hint">Click a creature in the viewport or choose an id below.</p>

		<div class="creature-list" data-testid="creature-select-list">
			{#each simulation.creatures as creature (creature.id)}
				<button
					type="button"
					class="creature-chip"
					class:selected={selectedCreatureId === creature.id}
					data-testid={`creature-select-${creature.id}`}
					aria-pressed={selectedCreatureId === creature.id}
					onclick={() => onSelectCreature(creature.id)}
				>
					{creature.id}
				</button>
			{/each}
		</div>

		{#if selectedCreatureId && !selectedCreature}
			<p class="empty" data-testid="creature-inspector-empty">
				Selected creature is no longer present. Clear selection or pick another.
			</p>
			<button
				type="button"
				data-testid="creature-clear-selection"
				onclick={() => onSelectCreature(null)}
			>
				Clear selection
			</button>
		{:else if !selectedCreature}
			<p class="empty" data-testid="creature-inspector-empty">No creature selected.</p>
		{:else}
			<div class="actions">
				<button
					type="button"
					data-testid="creature-clear-selection"
					onclick={() => onSelectCreature(null)}
				>
					Clear selection
				</button>
			</div>

			<dl class="meta inspector-meta" data-testid="creature-inspector-fields">
				<div>
					<dt>ID</dt>
					<dd data-testid="inspector-id">{selectedCreature.id}</dd>
				</div>
				<div>
					<dt>Position</dt>
					<dd data-testid="inspector-position">
						({selectedCreature.position.x.toFixed(3)}, {selectedCreature.position.y.toFixed(3)})
					</dd>
				</div>
				<div>
					<dt>Facing</dt>
					<dd data-testid="inspector-facing">{selectedCreature.facing.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Hunger</dt>
					<dd data-testid="inspector-hunger">{selectedCreature.hunger.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Thirst</dt>
					<dd data-testid="inspector-thirst">{selectedCreature.thirst.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Energy</dt>
					<dd data-testid="inspector-energy">{selectedCreature.energy.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Goal</dt>
					<dd data-testid="inspector-goal">{selectedCreature.goal}</dd>
				</div>
				<div>
					<dt>Action</dt>
					<dd data-testid="inspector-action">{selectedCreature.action}</dd>
				</div>
				<div>
					<dt>Target</dt>
					<dd data-testid="inspector-target">{formatTargetLabel(selectedCreature)}</dd>
				</div>
				<div>
					<dt>Goal start</dt>
					<dd data-testid="inspector-goal-started">
						{selectedCreature.goalStartedAt.toFixed(3)} s
					</dd>
				</div>
				<div>
					<dt>Action start</dt>
					<dd data-testid="inspector-action-started">
						{selectedCreature.actionStartedAt.toFixed(3)} s
					</dd>
				</div>
				<div>
					<dt>Next reconsider</dt>
					<dd data-testid="inspector-next-reconsider">
						{selectedCreature.nextReconsiderAt.toFixed(3)} s
					</dd>
				</div>
				<div>
					<dt>Decision reason</dt>
					<dd data-testid="inspector-decision-reason">
						{selectedCreature.lastDecision?.selectionReason ?? '—'}
					</dd>
				</div>
				<div>
					<dt>Sensing radius</dt>
					<dd data-testid="inspector-sensing-radius">{config.sensingRadius.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Perception update</dt>
					<dd data-testid="inspector-perception-updated">
						{selectedCreature.perception.lastUpdatedAt >= 0
							? `${selectedCreature.perception.lastUpdatedAt.toFixed(3)} s`
							: 'never'}
					</dd>
				</div>
				<div>
					<dt>Perceived food</dt>
					<dd data-testid="inspector-perceived-food">
						{selectedCreature.perception.perceivedFoodIds.length > 0
							? selectedCreature.perception.perceivedFoodIds.join(', ')
							: '—'}
					</dd>
				</div>
				<div>
					<dt>Perceived water</dt>
					<dd data-testid="inspector-perceived-water">
						{selectedCreature.perception.perceivedWaterIds.length > 0
							? selectedCreature.perception.perceivedWaterIds.join(', ')
							: '—'}
					</dd>
				</div>
				<div>
					<dt>Tracked</dt>
					<dd data-testid="inspector-tracked">
						{#if selectedCreature.perception.tracked}
							{selectedCreature.perception.tracked.featureKind}:{selectedCreature.perception.tracked
								.featureId}
							(age {(
								simulation.timeSeconds - selectedCreature.perception.tracked.observedAt
							).toFixed(2)}s)
						{:else}
							—
						{/if}
					</dd>
				</div>
				{#if selectedCreature.action === 'search'}
					<div>
						<dt>Search destination</dt>
						<dd data-testid="inspector-search-destination">
							({selectedCreature.searchTarget.x.toFixed(3)}, {selectedCreature.searchTarget.y.toFixed(
								3
							)})
						</dd>
					</div>
				{/if}
			</dl>

			<h3 class="subhead">Candidates</h3>
			<ul class="candidates" data-testid="inspector-candidates">
				{#each selectedCreature.lastCandidates as candidate (candidate.goal)}
					<li data-testid={`inspector-candidate-${candidate.goal}`}>
						<strong>{candidate.goal}</strong>
						score={candidate.score.toFixed(3)}
						{candidate.valid ? 'valid' : 'invalid'}
						— {candidate.reason}
						{#if candidate.rejectionReason}
							<span class="reject">({candidate.rejectionReason})</span>
						{/if}
					</li>
				{:else}
					<li data-testid="inspector-candidates-empty">No candidate snapshot yet.</li>
				{/each}
			</ul>

			<pre class="inspection-pre" data-testid="creature-inspection-text">{inspectionText}</pre>
		{/if}
	</section>

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

	.subhead {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.summary {
		margin: 0;
		font-size: 0.85rem;
		color: #d1d5db;
		line-height: 1.4;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}

	.empty {
		margin: 0;
		padding: 0.55rem;
		border-radius: 0.35rem;
		border: 1px dashed #334155;
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.creature-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.creature-chip {
		padding: 0.25rem 0.45rem;
		border: 1px solid #334155;
		border-radius: 999px;
		background: #111827;
		color: #cbd5e1;
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}

	.creature-chip.selected {
		border-color: #3b82f6;
		background: #1e3a5f;
		color: #e2e8f0;
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

	.inspector-meta div {
		grid-template-columns: 7rem 1fr;
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

	.candidates {
		margin: 0;
		padding-left: 1rem;
		color: #cbd5e1;
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.candidates .reject {
		color: #fca5a5;
	}

	.inspection-pre,
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
