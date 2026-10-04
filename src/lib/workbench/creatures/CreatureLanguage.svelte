<script lang="ts">
	import SymbolGlyph from '$lib/SymbolGlyph.svelte';
	import { LEXICON_MEANINGS, type Creature, type SimulationConfig } from '$lib/simulation';
	import {
		lastEmittedSymbolId,
		lastHeardSymbolId,
		lastLearningSummary,
		type InvestigationSummary
	} from '../view-models/creature-detail-view-model';
	import type { WorkbenchNavigate } from '../workbench-types';
	let {
		selectedCreature,
		config,
		investigation,
		onNavigate
	}: {
		selectedCreature: Creature;
		config: SimulationConfig;
		investigation: InvestigationSummary;
		onNavigate: (intent: WorkbenchNavigate) => void;
	} = $props();
</script>

<section class="block" data-testid="creature-language-summary" aria-label="Language summary">
	<h3>Language summary</h3>
	<dl class="meta">
		{#each LEXICON_MEANINGS as meaning (meaning)}
			<div>
				<dt>{meaning[0].toUpperCase() + meaning.slice(1)} assignment</dt>
				<dd data-testid={`inspector-lexicon-${meaning}`}>
					{#if selectedCreature.lexicon[meaning]}<SymbolGlyph
							symbolId={selectedCreature.lexicon[meaning]!}
						/>{:else}unassigned{/if}
				</dd>
			</div>
		{/each}
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
			<dt>Heard-signal memories</dt>
			<dd data-testid="inspector-pending-signals">
				{investigation?.heardSignalMemoryCount ?? 0}
			</dd>
		</div>
		<div>
			<dt>Active investigation</dt>
			<dd data-testid="inspector-active-investigation">
				{#if selectedCreature.activeInvestigation}
					<SymbolGlyph symbolId={selectedCreature.activeInvestigation.symbolId} />
					@ ({selectedCreature.activeInvestigation.origin.x.toFixed(1)}, {selectedCreature.activeInvestigation.origin.y.toFixed(
						1
					)})
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
					{@const last = selectedCreature.recentEmitted[selectedCreature.recentEmitted.length - 1]!}
					Sender context (observer only)={last.selectionEvidence.emissionContext}
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
					<SymbolGlyph symbolId={assoc.symbolId} />:
					{#each LEXICON_MEANINGS as meaning, index (meaning)}{index
							? ', '
							: ''}{meaning}={assoc.evidence[meaning].strength.toFixed(3)} (n={assoc.evidence[
							meaning
						].count}){/each}
				</li>
			{/each}
		</ul>
	</div>

	<section
		class="movement"
		data-testid="inspector-movement-learning"
		aria-label="Movement sequence learning"
	>
		<h3>Observed movement sequences</h3>
		<p class="hint">
			Approach predicts locally observed closing and comfortable contact. It is a learned
			prediction, not a command. Peer identity is bound only when a visible location has one
			unambiguous match.
		</p>
		<dl class="meta">
			<div>
				<dt>Latest local binding</dt>
				<dd data-testid="movement-source-binding">
					{#if selectedCreature.movementLearning.lastBinding}{@const binding =
							selectedCreature.movementLearning.lastBinding}<SymbolGlyph
							symbolId={binding.symbolId}
						/> · {binding.status}{#if binding.peerId}
							· {binding.peerId}{/if} · heard {binding.heardAt.toFixed(2)}s{:else}none{/if}
				</dd>
			</div>
			<div>
				<dt>Response opportunity</dt>
				<dd>
					{#if selectedCreature.movementLearning.response}{@const response =
							selectedCreature.movementLearning.response}<SymbolGlyph
							symbolId={response.symbolId}
						/> · {response.peerId} · expires {response.expiresAt.toFixed(2)}s{:else}none{/if}
				</dd>
			</div>
		</dl>
		<p class="hint">
			Pending awaits evidence; confirmed records closing/contact; contradicted records observed
			failure; unobserved means evidence was unavailable.
		</p>
		{#if selectedCreature.movementLearning.encounters.some((encounter) => encounter.trace)}
			<ul class="sequences">
				{#each selectedCreature.movementLearning.encounters as encounter (encounter.peerId)}
					{#if encounter.trace}{@const trace = encounter.trace}
						<li>
							<details data-testid={`movement-sequence-${encounter.peerId}`}>
								<summary
									><SymbolGlyph symbolId={trace.symbolId} /> · {encounter.peerId} · {trace.status}</summary
								>
								<dl class="meta">
									<div>
										<dt>Signal</dt>
										<dd>
											{trace.emissionId} · heard {trace.heardAt.toFixed(2)}s · deadline {trace.expiresAt.toFixed(
												2
											)}s
										</dd>
									</div>
									<div>
										<dt>Peer travel toward listener</dt>
										<dd>{trace.peerTowardDistance.toFixed(3)}</dd>
									</div>
									<div>
										<dt>Closest distance</dt>
										<dd>{trace.closestDistance.toFixed(3)}</dd>
									</div>
									<div>
										<dt>Comfortable contact</dt>
										<dd>{trace.comfortableContactSeconds.toFixed(2)}s</dd>
									</div>
									<div>
										<dt>Last observed</dt>
										<dd>{trace.lastObservedAt.toFixed(2)}s</dd>
									</div>
									<div>
										<dt>Reason</dt>
										<dd>{trace.reason}</dd>
									</div>
								</dl>
							</details>
						</li>
					{/if}
				{/each}
			</ul>
		{:else}<p class="hint">No retained movement sequences.</p>{/if}
	</section>

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

<style>
	.movement {
		margin: 0.8rem 0;
	}
	.movement .hint {
		margin: 0.5rem 0;
	}
	.sequences {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
		color: #cbd5e1;
		font-size: 0.75rem;
	}
	.sequences li {
		margin: 0.5rem 0;
		border-top: 1px solid #1e293b;
		padding-top: 0.4rem;
	}
	summary {
		cursor: pointer;
		margin-bottom: 0.35rem;
	}

	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		color: #9ca3af;
	}
	.hint {
		margin: 0 0 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
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
	dt {
		margin: 0;
		color: #94a3b8;
	}
	dd {
		margin: 0;
		color: #e2e8f0;
		word-break: break-word;
	}
	.nav-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	button {
		padding: 0.4rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	button:hover {
		background: #334155;
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
