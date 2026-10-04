<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import type { Creature, SimulationConfig, SimulationState } from '$lib/simulation';
	import {
		buildExplorationSectionView,
		buildInvestigationSummary,
		buildMemorySectionView,
		buildRosterRows,
		formatOptionalNumber,
		formatTargetLabel
	} from '../view-models/creature-detail-view-model';
	import type { WorkbenchNavigate } from '../workbench-types';
	import CreatureRoster from './CreatureRoster.svelte';
	import CreatureBehaviour from './CreatureBehaviour.svelte';
	import CreatureEcology from './CreatureEcology.svelte';
	import CreatureSocial from './CreatureSocial.svelte';
	import CreatureLanguage from './CreatureLanguage.svelte';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		selectedCreatureId: string | null;
		onSelectCreature: (creatureId: string | null) => void;
		onNavigate: (intent: WorkbenchNavigate) => void;
	};

	let { simulation, config, selectedCreatureId, onSelectCreature, onNavigate }: Props = $props();

	const rows = $derived(buildRosterRows(simulation.creatures));
	const selectedCreature: Creature | null = $derived(
		simulation.creatures.find((c) => c.id === selectedCreatureId) ?? null
	);
	const investigation = $derived(
		selectedCreature ? buildInvestigationSummary(selectedCreature, simulation.timeSeconds) : null
	);
	const memorySection = $derived(
		selectedCreature ? buildMemorySectionView(selectedCreature) : null
	);
	const explorationSection = $derived(
		selectedCreature
			? buildExplorationSectionView(
					selectedCreature,
					simulation.timeSeconds,
					config,
					simulation.habitat.bounds
				)
			: null
	);
</script>

<div class="creatures" data-testid="creatures-tab">
	<section class="block">
		<h3>Roster</h3>
		<p class="hint">Click a creature in the viewport or select a row below.</p>
		<CreatureRoster {rows} {selectedCreatureId} {onSelectCreature} />
	</section>

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

		<section class="block" data-testid="creature-identity" aria-label="Identity and status">
			<h3>Identity & status</h3>
			<dl class="meta" data-testid="creature-inspector-fields">
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
					<dt>Verbosity</dt>
					<dd data-testid="inspector-verbosity">{selectedCreature.verbosity.toFixed(2)}</dd>
				</div>
				<div>
					<dt>Curiosity</dt>
					<dd data-testid="inspector-curiosity">{selectedCreature.curiosity.toFixed(2)}</dd>
				</div>
				<div>
					<dt>Intention</dt>
					<dd data-testid="inspector-intention">{selectedCreature.intention}</dd>
				</div>
				<div>
					<dt>Action</dt>
					<dd data-testid="inspector-action">{selectedCreature.action}</dd>
				</div>
				<div>
					<dt>Target</dt>
					<dd data-testid="inspector-target">{formatTargetLabel(selectedCreature.target)}</dd>
				</div>
				{#if explorationSection}
					<div>
						<dt>Explored cells</dt>
						<dd data-testid="inspector-explored-cells">
							{explorationSection.exploredCount} / {explorationSection.totalCells}
						</dd>
					</div>
					<div>
						<dt>Exploration target</dt>
						<dd data-testid="inspector-exploration-target">
							{explorationSection.activeCellIndex !== null
								? explorationSection.activeCellIndex
								: '(none)'}
						</dd>
					</div>
					<div>
						<dt>Target centre</dt>
						<dd data-testid="inspector-exploration-centre">
							{#if explorationSection.targetCentre}
								({explorationSection.targetCentre.x.toFixed(2)}, {explorationSection.targetCentre.y.toFixed(
									2
								)})
							{:else}
								(none)
							{/if}
						</dd>
					</div>
					<div>
						<dt>Distance factor</dt>
						<dd data-testid="inspector-exploration-distance-factor">
							{formatOptionalNumber(explorationSection.distanceFactor)}
						</dd>
					</div>
					<div>
						<dt>Staleness factor</dt>
						<dd data-testid="inspector-exploration-staleness-factor">
							{formatOptionalNumber(explorationSection.stalenessFactor)}
						</dd>
					</div>
					<div>
						<dt>Distance contribution</dt>
						<dd data-testid="inspector-exploration-distance-contrib">
							{formatOptionalNumber(explorationSection.distanceContribution)}
						</dd>
					</div>
					<div>
						<dt>Staleness contribution</dt>
						<dd data-testid="inspector-exploration-staleness-contrib">
							{formatOptionalNumber(explorationSection.stalenessContribution)}
						</dd>
					</div>
					<div>
						<dt>Final exploration score</dt>
						<dd data-testid="inspector-exploration-score">
							{formatOptionalNumber(explorationSection.finalScore)}
						</dd>
					</div>
				{/if}
				<div>
					<dt>Intention start</dt>
					<dd data-testid="inspector-intention-started">
						{selectedCreature.intentionStartedAt.toFixed(3)} s
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
			</dl>
		</section>

		<section class="block" data-testid="creature-needs" aria-label="Needs">
			<h3>Needs & health</h3>
			{#each [{ key: 'hunger', value: selectedCreature.hunger, testid: 'inspector-hunger', kind: 'pressure' }, { key: 'thirst', value: selectedCreature.thirst, testid: 'inspector-thirst', kind: 'pressure' }, { key: 'energy', value: selectedCreature.energy, testid: 'inspector-energy', kind: 'energy' }] as need (need.key)}
				<div class="need-row">
					<span class="need-label">{need.key}</span>
					<span class="need-value" data-testid={need.testid}>{need.value.toFixed(3)}</span>
					<div
						class="bar"
						role="meter"
						aria-label={`${need.key} ${need.value.toFixed(3)}`}
						aria-valuemin={0}
						aria-valuemax={1}
						aria-valuenow={need.value}
					>
						<span
							class="fill"
							class:pressure={need.kind === 'pressure'}
							class:energy={need.kind === 'energy'}
							style:width={`${need.value * 100}%`}
						></span>
					</div>
				</div>
			{/each}
		</section>

		{#if memorySection}
			<section class="block" data-testid="creature-memory" aria-label="Memory">
				<h3>Memory</h3>
				<dl class="meta">
					<div>
						<dt>Capacity</dt>
						<dd data-testid="inspector-memory-capacity">{memorySection.capacity}</dd>
					</div>
					<div>
						<dt>Used</dt>
						<dd data-testid="inspector-memory-used">
							{memorySection.used} / {memorySection.capacity}
						</dd>
					</div>
				</dl>
				<h4 class="subhead">Recent memories</h4>
				{#if memorySection.entries.length === 0}
					<p class="empty" data-testid="inspector-memory-empty">No retained memories.</p>
				{:else}
					<ul class="memory-list" data-testid="inspector-memory-list">
						{#each memorySection.entries as entry (entry.sequence)}
							<li data-testid="inspector-memory-entry">
								<span class="memory-kind">{entry.kind}</span>
								<span class="memory-sep">·</span>
								<span class="memory-subject">{entry.subjectId}</span>
								{#if entry.positionLabel}
									<span class="memory-sep">·</span>
									<span class="memory-position">{entry.positionLabel}</span>
								{/if}
								{#if entry.symbolId}
									<span class="memory-sep">·</span>
									<SymbolGlyph symbolId={entry.symbolId} />
								{/if}
								<span class="memory-sep">·</span>
								<span class="memory-time">t={entry.timeSeconds.toFixed(2)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<CreatureEcology creature={selectedCreature} timeSeconds={simulation.timeSeconds} />
		<CreatureSocial creature={selectedCreature} timeSeconds={simulation.timeSeconds} />

		<CreatureBehaviour creature={selectedCreature} {investigation} />

		<section class="block" data-testid="creature-perception" aria-label="Perception">
			<h3>Perception</h3>
			<dl class="meta">
				<div>
					<dt>Sensing radius</dt>
					<dd data-testid="inspector-sensing-radius">{config.sensingRadius.toFixed(3)}</dd>
				</div>
				<div>
					<dt>Last update</dt>
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
					<dt>Observations</dt>
					<dd data-testid="inspector-tracked">
						{selectedCreature.perception.observations.length > 0
							? selectedCreature.perception.observations
									.map((o) => `${o.featureKind}:${o.featureId}`)
									.join(', ')
							: '—'}
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
		</section>

		<CreatureLanguage {selectedCreature} {config} {investigation} {onNavigate} />
	{/if}
</div>

<style>
	.creatures {
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

	.subhead {
		margin: 0.45rem 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.memory-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.memory-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.78rem;
		color: #e5e7eb;
	}

	.memory-kind {
		color: #a5b4fc;
	}

	.memory-sep {
		color: #64748b;
	}

	.memory-time {
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
	}

	.hint {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.empty {
		margin: 0;
		padding: 0.55rem;
		border-radius: 0.35rem;
		border: 1px dashed #334155;
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.actions button {
		padding: 0.4rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.actions button:hover {
		background: #334155;
	}

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.35rem;
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

	.need-row {
		display: grid;
		grid-template-columns: 4.5rem 3.5rem 1fr;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 0.35rem;
		font-size: 0.78rem;
	}

	.need-label {
		color: #94a3b8;
		text-transform: capitalize;
	}

	.need-value {
		color: #e2e8f0;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 0.4rem;
		border-radius: 999px;
		background: #1e293b;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
	}

	.fill.pressure {
		background: #f59e0b;
	}

	.fill.energy {
		background: #22c55e;
	}
</style>
