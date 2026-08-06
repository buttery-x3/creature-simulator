<script lang="ts">
	import ThreeViewport from '$lib/ThreeViewport.svelte';
</script>

<main class="page">
	<header class="header">
		<h1>Creature Simulator</h1>
		<p>
			SvelteKit and Three.js integration scaffold. Three.js is the presentation layer only; it must
			not own future simulation state or behaviour.
		</p>
	</header>

	<section class="stage" aria-label="Presentation stage">
		<ThreeViewport />
	</section>
</main>

<style>
	.page {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	.header {
		flex: 0 0 auto;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #1f2937;
	}

	.header h1 {
		margin: 0 0 0.35rem;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.header p {
		margin: 0;
		max-width: 48rem;
		color: #9ca3af;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.stage {
		flex: 1 1 auto;
		min-height: 0;
	}
</style>
