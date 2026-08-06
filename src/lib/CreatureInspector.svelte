<script lang="ts">
	import {
		formatCreatureInspection,
		type Creature,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';
	import CreatureLexiconPanel from './CreatureLexiconPanel.svelte';

	type Props = {
		simulation: SimulationState;
		config: SimulationConfig;
		selectedCreatureId: string | null;
		onSelectCreature: (creatureId: string | null) => void;
	};

	let { simulation, config, selectedCreatureId, onSelectCreature }: Props = $props();

	const selectedCreature: Creature | null = $derived(
		simulation.creatures.find((c) => c.id === selectedCreatureId) ?? null
	);
	const inspectionText = $derived(
		selectedCreature
			? formatCreatureInspection(selectedCreature, simulation.timeSeconds, {
					sensingRadius: config.sensingRadius,
					trackedObservationDurationSeconds: config.trackedObservationDurationSeconds,
					hearingRadius: config.hearingRadius,
					symbolInventory: config.symbolInventory
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
				<dt>Curiosity</dt>
				<dd data-testid="inspector-curiosity">
					{selectedCreature.curiosity.toFixed(3)}
					<span class="muted">(individual trait)</span>
				</dd>
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
						(age {(simulation.timeSeconds - selectedCreature.perception.tracked.observedAt).toFixed(
							2
						)}s)
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
			<div>
				<dt>Preferred symbol</dt>
				<dd data-testid="inspector-preferred-symbol">
					{selectedCreature.preferredSymbolId}
					<span class="muted">(cold-start fallback)</span>
				</dd>
			</div>
			<div>
				<dt>Hearing radius</dt>
				<dd data-testid="inspector-hearing-radius">{config.hearingRadius.toFixed(3)}</dd>
			</div>
			<div>
				<dt>Active emissions</dt>
				<dd data-testid="inspector-active-emissions">{simulation.activeEmissions.length}</dd>
			</div>
			<div class="full-width">
				<dt class="sr-only">Lexicon and evidence</dt>
				<dd>
					<CreatureLexiconPanel creature={selectedCreature} />
				</dd>
			</div>
			<div>
				<dt>Recent emitted</dt>
				<dd data-testid="inspector-recent-emitted">
					{#if selectedCreature.recentEmitted.length === 0}
						—
					{:else}
						<ul class="signal-list">
							{#each selectedCreature.recentEmitted as emission (emission.id)}
								<li>
									{emission.symbolId} @ ({emission.origin.x.toFixed(2)}, {emission.origin.y.toFixed(
										2
									)}) t={emission.emittedAt.toFixed(2)}s · context {emission.context}/{emission.contextDetail}
									· {emission.symbolSelectionReason}
								</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Recent heard</dt>
				<dd data-testid="inspector-recent-heard">
					{#if selectedCreature.recentHeard.length === 0}
						—
					{:else}
						<ul class="signal-list">
							{#each selectedCreature.recentHeard as heard (heard.emissionId + heard.heardAt)}
								<li>
									{heard.symbolId} from {heard.senderId} @ ({heard.origin.x.toFixed(2)}, {heard.origin.y.toFixed(
										2
									)}) heard t={heard.heardAt.toFixed(2)}s
									<span class="muted">(listener-only; no emitter context)</span>
								</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Pending signals</dt>
				<dd data-testid="inspector-pending-signals">
					{#if selectedCreature.pendingSignals.length === 0}
						—
					{:else}
						<ul class="signal-list">
							{#each selectedCreature.pendingSignals as pending (pending.emissionId)}
								<li>
									{pending.symbolId} from {pending.senderId} @ ({pending.origin.x.toFixed(2)}, {pending.origin.y.toFixed(
										2
									)}) age={(simulation.timeSeconds - pending.heardAt).toFixed(2)}s expires@
									{pending.expiresAt.toFixed(2)}s
								</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
			<div>
				<dt>Active investigation</dt>
				<dd data-testid="inspector-active-investigation">
					{#if selectedCreature.activeInvestigation}
						{selectedCreature.activeInvestigation.symbolId} emission={selectedCreature
							.activeInvestigation.emissionId}
						@ ({selectedCreature.activeInvestigation.origin.x.toFixed(2)}, {selectedCreature.activeInvestigation.origin.y.toFixed(
							2
						)}) started@
						{selectedCreature.activeInvestigation.startedAt.toFixed(2)}s (no travel timeout)
					{:else}
						—
					{/if}
				</dd>
			</div>
			<div>
				<dt>Recent learning</dt>
				<dd data-testid="inspector-recent-learning">
					{#if selectedCreature.recentLearning.length === 0}
						—
					{:else}
						<ul class="signal-list">
							{#each selectedCreature.recentLearning as entry (entry.timeSeconds + entry.emissionId + entry.outcome)}
								<li>
									t={entry.timeSeconds.toFixed(2)}
									{entry.outcome}
									{entry.symbolId}: food {entry.foodStrengthBefore.toFixed(
										2
									)}→{entry.foodStrengthAfter.toFixed(2)} water {entry.waterStrengthBefore.toFixed(
										2
									)}→{entry.waterStrengthAfter.toFixed(2)} — {entry.reason}
								</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
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

<style>
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

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.35;
	}

	.muted {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.signal-list {
		margin: 0.15rem 0 0;
		padding-left: 1rem;
		font-size: 0.75rem;
		color: #d1d5db;
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

	.inspection-pre {
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
