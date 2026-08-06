<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Creature Simulator</title>
</svelte:head>

<div class="app">
	{@render children()}
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		background: #0b1220;
		color: #e5e7eb;
		font-family:
			system-ui,
			-apple-system,
			Segoe UI,
			sans-serif;
	}

	.app {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 100vh;
	}
</style>
