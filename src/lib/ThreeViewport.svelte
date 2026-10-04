<script lang="ts">
	import { onMount } from 'svelte';
	import { createViewportScene, type ViewportSnapshot } from '$lib/viewport';
	type Props = Omit<ViewportSnapshot, 'followSelected'> & {
		onSelectCreature?: (id: string | null) => void;
	};
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
	let followSelected = $state(false);
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
			investigationDistanceScale,
			followSelected
		});
	});
</script>

<div
	class="viewport"
	bind:this={container}
	data-testid="three-viewport"
	aria-label="Habitat viewport"
>
	<label class="camera-control"
		><input
			type="checkbox"
			bind:checked={followSelected}
			disabled={!selectedCreatureId}
			data-testid="follow-creature"
		/> Follow selected creature</label
	>
</div>

<style>
	.viewport {
		position: relative;
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
	.camera-control {
		position: absolute;
		top: 0.6rem;
		left: 0.7rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.55rem;
		background: #0b1220dd;
		color: #cbd5e1;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		font-size: 0.75rem;
	}
</style>
