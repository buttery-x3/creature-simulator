<script lang="ts">
	import { onMount } from 'svelte';
	import { createViewportScene, type ViewportSnapshot } from '$lib/viewport';
	type Props = ViewportSnapshot & { onSelectCreature?: (id: string | null) => void };
	let {
		habitat,
		creatures,
		wildlife,
		activeEmissions,
		timeSeconds,
		weather,
		daylight,
		selectedCreatureId,
		sensingRadius,
		hearingRadius,
		investigationDistanceScale,
		onSelectCreature
	}: Props = $props();
	let container: HTMLDivElement | undefined = $state();
	let viewport: ReturnType<typeof createViewportScene> | undefined = $state();
	onMount(() => {
		if (!container) return;
		const scene = createViewportScene(container, (id) => onSelectCreature?.(id));
		viewport = scene;
		return () => {
			viewport = undefined;
			scene.dispose();
		};
	});
	$effect(() => {
		viewport?.update({
			habitat,
			creatures,
			wildlife,
			activeEmissions,
			timeSeconds,
			weather,
			daylight,
			selectedCreatureId,
			sensingRadius,
			hearingRadius,
			investigationDistanceScale
		});
	});
</script>

<div
	class="viewport"
	bind:this={container}
	data-testid="three-viewport"
	aria-label="Habitat viewport"
></div>

<style>
	.viewport {
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
