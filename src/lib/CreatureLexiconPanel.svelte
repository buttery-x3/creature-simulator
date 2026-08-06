<script lang="ts">
	import type { Creature } from '$lib/simulation';

	type Props = {
		creature: Creature;
	};

	let { creature }: Props = $props();

	const lastEmission = $derived(
		creature.recentEmitted.length > 0
			? creature.recentEmitted[creature.recentEmitted.length - 1]
			: null
	);

	function assignmentSupport(meaning: 'food' | 'water'): string {
		const symbolId = creature.lexicon[meaning];
		if (symbolId === null) {
			return 'unassigned';
		}
		const row = creature.symbolAssociations.find((a) => a.symbolId === symbolId);
		if (!row) {
			return `${symbolId} (no evidence row)`;
		}
		const strength = meaning === 'food' ? row.foodStrength : row.waterStrength;
		const count = meaning === 'food' ? row.foodEvidenceCount : row.waterEvidenceCount;
		return `${symbolId} (evidence ${strength.toFixed(3)}, n=${count})`;
	}
</script>

<div data-testid="inspector-lexicon-panel">
	<p class="label">Current lexicon <span class="muted">(exclusive; not a global dictionary)</span></p>
	<ul class="signal-list" data-testid="inspector-lexicon">
		<li data-testid="inspector-lexicon-food">food → {assignmentSupport('food')}</li>
		<li data-testid="inspector-lexicon-water">water → {assignmentSupport('water')}</li>
	</ul>

	{#if creature.recentLexiconChanges.length > 0}
		<p class="label">Recent lexicon changes</p>
		<ul class="signal-list" data-testid="inspector-lexicon-changes">
			{#each creature.recentLexiconChanges as change (change.timeSeconds + change.meaning + (change.newSymbolId ?? 'null'))}
				<li>
					t={change.timeSeconds.toFixed(2)}
					{change.meaning}: {change.previousSymbolId ?? 'null'}→{change.newSymbolId ?? 'null'}
					score={change.assignmentScore.toFixed(3)} — {change.reason}
				</li>
			{/each}
		</ul>
	{/if}

	<p class="label">Raw evidence <span class="muted">(may be ambiguous / overlapping)</span></p>
	<ul class="signal-list" data-testid="inspector-symbol-associations">
		{#each creature.symbolAssociations as assoc (assoc.symbolId)}
			<li data-testid={`inspector-assoc-${assoc.symbolId}`}>
				{assoc.symbolId}: food={assoc.foodStrength.toFixed(3)} (n={assoc.foodEvidenceCount}),
				water={assoc.waterStrength.toFixed(3)} (n={assoc.waterEvidenceCount}), bias={(
					assoc.foodStrength * creature.hunger +
					assoc.waterStrength * creature.thirst
				).toFixed(3)}
			</li>
		{/each}
	</ul>

	<div data-testid="inspector-last-selection">
		<p class="label">Last emission selection</p>
		{#if lastEmission}
			<p data-testid="inspector-last-selection-detail">
				context={lastEmission.selectionEvidence.emissionContext}
				symbol={lastEmission.selectionEvidence.selectedSymbolId}
				mode={lastEmission.selectionEvidence.mode}
				assigned={lastEmission.selectionEvidence.assignedSymbolId ?? 'null'}
				reason={lastEmission.selectionEvidence.reason}
				fallback={lastEmission.selectionEvidence.usedFallback ? 'yes' : 'no'}
				{#if lastEmission.selectionEvidence.sample !== null}
					sample={lastEmission.selectionEvidence.sample.toFixed(4)}
				{/if}
			</p>
		{:else}
			<p data-testid="inspector-last-selection-detail">—</p>
		{/if}
	</div>
</div>

<style>
	.label {
		margin: 0 0 0.2rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.muted {
		color: #64748b;
	}

	.signal-list {
		list-style: none;
		margin: 0 0 0.45rem;
		padding: 0;
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.35;
	}

	.signal-list li {
		padding: 0.1rem 0;
	}

	p {
		margin: 0 0 0.45rem;
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.35;
	}
</style>
