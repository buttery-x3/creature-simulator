<script lang="ts">
	import HabitatWorkbench from '$lib/HabitatWorkbench.svelte';
	import ThreeViewport from '$lib/ThreeViewport.svelte';
	import {
		DEFAULT_HABITAT_CONFIG,
		generateHabitat,
		HabitatGenerationError,
		type Habitat
	} from '$lib/habitat';

	const generationConfig = { ...DEFAULT_HABITAT_CONFIG };

	function createHabitat(seed: string): { habitat: Habitat; error: string | null } {
		try {
			return {
				habitat: generateHabitat({ ...generationConfig, seed }),
				error: null
			};
		} catch (error) {
			const message =
				error instanceof HabitatGenerationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Habitat generation failed';
			return {
				habitat: generateHabitat({ ...generationConfig, seed: 'demo' }),
				error: message
			};
		}
	}

	/** UI-only random seed; not used on the habitat generation path. */
	function randomSeed(): string {
		const bytes = new Uint32Array(2);
		crypto.getRandomValues(bytes);
		return `seed-${bytes[0]!.toString(36)}-${bytes[1]!.toString(36)}`;
	}

	const initial = createHabitat('demo');
	let habitat = $state(initial.habitat);
	let seedInput = $state(initial.habitat.seed);
	let errorMessage = $state<string | null>(initial.error);

	function regenerate(): void {
		const seed = seedInput.trim();
		if (seed.length === 0) {
			errorMessage = 'Seed must be a non-empty string.';
			return;
		}

		try {
			habitat = generateHabitat({ ...generationConfig, seed });
			seedInput = habitat.seed;
			errorMessage = null;
		} catch (error) {
			errorMessage =
				error instanceof HabitatGenerationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Habitat generation failed';
		}
	}

	function useRandomSeed(): void {
		seedInput = randomSeed();
		regenerate();
	}
</script>

<main class="page">
	<header class="header">
		<h1>Creature Simulator</h1>
		<p>Seeded bounded habitat. Simulation state is plain data; Three.js is presentation only.</p>
	</header>

	<div class="workspace">
		<section class="stage" aria-label="Presentation stage">
			<ThreeViewport {habitat} />
		</section>
		<HabitatWorkbench
			{habitat}
			{seedInput}
			{errorMessage}
			config={generationConfig}
			onSeedInput={(value) => {
				seedInput = value;
			}}
			onRegenerate={regenerate}
			onRandomSeed={useRandomSeed}
		/>
	</div>
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

	.workspace {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
	}

	.stage {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}
</style>
