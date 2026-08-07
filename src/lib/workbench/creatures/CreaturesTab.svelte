<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import type { Creature, SimulationConfig, SimulationState } from '$lib/simulation';
	import {
		buildCandidateViews,
		buildInvestigationOpportunitySummary,
		buildRosterRows,
		formatTargetLabel,
		lastEmittedSymbolId,
		lastHeardSymbolId,
		lastLearningSummary
	} from '../view-models/creature-detail-view-model';
	import type { WorkbenchNavigate } from '../workbench-types';
	import CreatureRoster from './CreatureRoster.svelte';

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
		selectedCreature
			? buildInvestigationOpportunitySummary(selectedCreature, simulation.timeSeconds)
			: null
	);
	const candidates = $derived(
		selectedCreature ? buildCandidateViews(selectedCreature, investigation) : []
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
					<dt>Goal</dt>
					<dd data-testid="inspector-goal">{selectedCreature.goal}</dd>
				</div>
				<div>
					<dt>Action</dt>
					<dd data-testid="inspector-action">{selectedCreature.action}</dd>
				</div>
				<div>
					<dt>Target</dt>
					<dd data-testid="inspector-target">{formatTargetLabel(selectedCreature.target)}</dd>
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

		<section class="block" data-testid="creature-traits" aria-label="Traits">
			<h3>Traits</h3>
			<dl class="meta">
				<div>
					<dt>Curiosity</dt>
					<dd data-testid="inspector-curiosity">{selectedCreature.curiosity.toFixed(3)}</dd>
				</div>
			</dl>
		</section>

		<section class="block" data-testid="creature-behaviour" aria-label="Current behaviour">
			<h3>Current behaviour</h3>
			<dl class="meta">
				<div>
					<dt>Trigger</dt>
					<dd data-testid="inspector-decision-trigger">
						{selectedCreature.lastDecision?.trigger ?? '—'}
					</dd>
				</div>
				<div>
					<dt>Selected goal</dt>
					<dd>{selectedCreature.lastDecision?.selectedGoal ?? selectedCreature.goal}</dd>
				</div>
				<div>
					<dt>Selected target</dt>
					<dd>
						{formatTargetLabel(
							selectedCreature.lastDecision?.selectedTarget ?? selectedCreature.target
						)}
					</dd>
				</div>
				<div>
					<dt>Decision reason</dt>
					<dd data-testid="inspector-decision-reason">
						{selectedCreature.lastDecision?.selectionReason ?? '—'}
					</dd>
				</div>
			</dl>

			{#if investigation}
				<div class="score-box" data-testid="investigation-opportunity-summary">
					<h4>Investigation opportunities</h4>
					<dl class="meta">
						<div>
							<dt>Curiosity</dt>
							<dd data-testid="investigation-summary-curiosity">
								{investigation.curiosity.toFixed(3)}
							</dd>
						</div>
						<div>
							<dt>Accepted pending</dt>
							<dd data-testid="investigation-summary-accepted-count">
								{investigation.acceptedPendingCount}
							</dd>
						</div>
						<div>
							<dt>Recent decision</dt>
							<dd data-testid="investigation-summary-recent-decision">
								{investigation.recentDecision ?? '—'}
								{#if investigation.recentSample !== null}
									<span class="muted">
										· sample={investigation.recentSample.toFixed(3)}
									</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt>Active</dt>
							<dd data-testid="investigation-summary-active">
								{#if investigation.activeSymbolId}
									<SymbolGlyph symbolId={investigation.activeSymbolId} />
									{investigation.activeEmissionId}
								{:else}
									—
								{/if}
							</dd>
						</div>
					</dl>
				</div>
			{/if}

			<h4 class="subhead">Candidates</h4>
			<ul class="candidates" data-testid="inspector-candidates">
				{#each candidates as candidate (candidate.goal)}
					<li
						data-testid={`inspector-candidate-${candidate.goal}`}
						class:selected={candidate.selected}
					>
						<strong>{candidate.goal}</strong>
						score={candidate.score.toFixed(3)}
						{candidate.valid ? 'valid' : 'invalid'}
						{#if candidate.scoreTerms}
							<ul class="terms">
								{#each candidate.scoreTerms as term (term.label)}
									<li>{term.label}: {term.value.toFixed(3)}</li>
								{/each}
							</ul>
						{:else}
							— {candidate.reason}
						{/if}
						{#if candidate.rejectionReason}
							<span class="reject">({candidate.rejectionReason})</span>
						{/if}
					</li>
				{:else}
					<li data-testid="inspector-candidates-empty">No candidate snapshot yet.</li>
				{/each}
			</ul>
		</section>

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
					<dt>Tracked</dt>
					<dd data-testid="inspector-tracked">
						{#if selectedCreature.perception.tracked}
							{selectedCreature.perception.tracked.featureKind}:{selectedCreature.perception.tracked
								.featureId}
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
		</section>

		<section class="block" data-testid="creature-language-summary" aria-label="Language summary">
			<h3>Language summary</h3>
			<dl class="meta">
				<div>
					<dt>Food assignment</dt>
					<dd data-testid="inspector-lexicon-food">
						{#if selectedCreature.lexicon.food}
							<SymbolGlyph symbolId={selectedCreature.lexicon.food} />
						{:else}
							unassigned
						{/if}
					</dd>
				</div>
				<div>
					<dt>Water assignment</dt>
					<dd data-testid="inspector-lexicon-water">
						{#if selectedCreature.lexicon.water}
							<SymbolGlyph symbolId={selectedCreature.lexicon.water} />
						{:else}
							unassigned
						{/if}
					</dd>
				</div>
				<div>
					<dt>Preferred symbol</dt>
					<dd data-testid="inspector-preferred-symbol">
						<SymbolGlyph symbolId={selectedCreature.preferredSymbolId} />
					</dd>
				</div>
				<div>
					<dt>Last emitted</dt>
					<dd data-testid="inspector-recent-emitted">
						{#if lastEmittedSymbolId(selectedCreature)}
							<SymbolGlyph symbolId={lastEmittedSymbolId(selectedCreature)!} />
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt>Last heard</dt>
					<dd data-testid="inspector-recent-heard">
						{#if lastHeardSymbolId(selectedCreature)}
							<SymbolGlyph symbolId={lastHeardSymbolId(selectedCreature)!} />
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt>Pending opportunities</dt>
					<dd data-testid="inspector-pending-signals">
						{selectedCreature.pendingSignals.length}
						{#if investigation}
							<span class="muted">
								· accepted={investigation.acceptedPendingCount}
							</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt>Active investigation</dt>
					<dd data-testid="inspector-active-investigation">
						{#if selectedCreature.activeInvestigation}
							<SymbolGlyph symbolId={selectedCreature.activeInvestigation.symbolId} />
							from {selectedCreature.activeInvestigation.senderId}
						{:else}
							—
						{/if}
					</dd>
				</div>
				<div>
					<dt>Last learning</dt>
					<dd data-testid="inspector-recent-learning">
						{lastLearningSummary(selectedCreature) ?? '—'}
					</dd>
				</div>
				<div>
					<dt>Hearing radius</dt>
					<dd data-testid="inspector-hearing-radius">{config.hearingRadius.toFixed(3)}</dd>
				</div>
			</dl>

			<div data-testid="inspector-lexicon-panel">
				<p class="hint">Exclusive lexicon (not a global dictionary)</p>
				<div data-testid="inspector-last-selection">
					<p data-testid="inspector-last-selection-detail">
						{#if selectedCreature.recentEmitted.length > 0}
							{@const last =
								selectedCreature.recentEmitted[selectedCreature.recentEmitted.length - 1]!}
							context={last.selectionEvidence.emissionContext}
							mode={last.selectionEvidence.mode}
							reason={last.selectionEvidence.reason}
						{:else}
							—
						{/if}
					</p>
				</div>
				<ul class="assoc" data-testid="inspector-symbol-associations">
					{#each selectedCreature.symbolAssociations as assoc (assoc.symbolId)}
						<li data-testid={`inspector-assoc-${assoc.symbolId}`}>
							<SymbolGlyph symbolId={assoc.symbolId} />: food={assoc.foodStrength.toFixed(3)} (n={assoc.foodEvidenceCount}),
							water={assoc.waterStrength.toFixed(3)} (n={assoc.waterEvidenceCount})
						</li>
					{/each}
				</ul>
			</div>

			<div class="nav-actions">
				<button
					type="button"
					data-testid="creature-open-events"
					onclick={() =>
						onNavigate({
							kind: 'events',
							filter: { creatureId: selectedCreature.id }
						})}
				>
					Open Events for creature
				</button>
				<button
					type="button"
					data-testid="creature-open-communication"
					onclick={() => onNavigate({ kind: 'communication', creatureId: selectedCreature.id })}
				>
					Open Communication
				</button>
			</div>
		</section>
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

	.subhead,
	.score-box h4 {
		margin: 0.45rem 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
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

	.actions,
	.nav-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.actions button,
	.nav-actions button {
		padding: 0.4rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.actions button:hover,
	.nav-actions button:hover {
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

	.muted {
		color: #94a3b8;
		font-size: 0.85em;
	}

	.score-box {
		margin-top: 0.45rem;
		padding: 0.45rem;
		border: 1px solid #1e293b;
		border-radius: 0.35rem;
		background: #0f172a;
	}

	.candidates {
		margin: 0;
		padding-left: 1rem;
		color: #cbd5e1;
		font-size: 0.72rem;
		line-height: 1.4;
	}

	.candidates .selected {
		color: #e2e8f0;
	}

	.candidates .reject {
		color: #fca5a5;
	}

	.terms {
		margin: 0.15rem 0 0.25rem;
		padding-left: 1rem;
		color: #94a3b8;
	}

	.assoc {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		font-size: 0.72rem;
		color: #cbd5e1;
		line-height: 1.35;
	}

	.assoc li {
		padding: 0.1rem 0;
	}
</style>
