<script lang="ts">
	import { buildEmissionWeights, type Creature, type SimulationConfig } from '$lib/simulation';

	type Props = {
		creature: Creature;
		config: SimulationConfig;
	};

	let { creature, config }: Props = $props();

	const weightConfig = $derived({
		emissionExplorationFloor: config.emissionExplorationFloor,
		emissionAssociationWeightMultiplier: config.emissionAssociationWeightMultiplier
	});

	const foodWeights = $derived(
		buildEmissionWeights(config.symbolInventory, creature.symbolAssociations, 'food', weightConfig)
	);
	const waterWeights = $derived(
		buildEmissionWeights(config.symbolInventory, creature.symbolAssociations, 'water', weightConfig)
	);

	const lastEmission = $derived(
		creature.recentEmitted.length > 0
			? creature.recentEmitted[creature.recentEmitted.length - 1]
			: null
	);
</script>

<div data-testid="inspector-emission-weights">
	<p class="label">
		Effective emission weights <span class="muted">(derived from associations)</span>
	</p>
	<ul class="signal-list">
		{#each foodWeights as food, i (food.symbolId)}
			{@const water = waterWeights[i]!}
			<li data-testid={`inspector-emit-weight-${food.symbolId}`}>
				{food.symbolId}: foodW={food.effectiveWeight.toFixed(3)} (str={food.learnedStrength.toFixed(
					3
				)}), waterW={water.effectiveWeight.toFixed(3)} (str={water.learnedStrength.toFixed(3)})
			</li>
		{/each}
	</ul>
</div>

<div data-testid="inspector-last-selection">
	<p class="label">Last selection evidence</p>
	{#if lastEmission}
		<p data-testid="inspector-last-selection-detail">
			context={lastEmission.selectionEvidence.emissionContext}
			symbol={lastEmission.selectionEvidence.selectedSymbolId}
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
