<script lang="ts">
	import { onMount } from 'svelte';
	import ThreeViewport from '$lib/ThreeViewport.svelte';
	import { WorkbenchShell, type WorkbenchTabId } from '$lib/workbench';
	import { HabitatGenerationError, type Habitat } from '$lib/habitat';
	import {
		advanceSimulation,
		createSimulation,
		defaultSimulationConfig,
		SimulationCreationError,
		type SimulationConfig,
		type SimulationState
	} from '$lib/simulation';

	// Independent copy so UI mutations never share nested size-range objects.
	const simulationConfigBase = defaultSimulationConfig('demo');

	function configForSeed(seed: string): SimulationConfig {
		return {
			...simulationConfigBase,
			seed,
			habitat: {
				...simulationConfigBase.habitat,
				homeSize: { ...simulationConfigBase.habitat.homeSize },
				foodSize: { ...simulationConfigBase.habitat.foodSize },
				waterSize: { ...simulationConfigBase.habitat.waterSize }
			},
			movementSpeed: { ...simulationConfigBase.movementSpeed }
		};
	}

	function tryCreateSimulation(seed: string): {
		simulation: SimulationState;
		error: string | null;
	} {
		try {
			return {
				simulation: createSimulation(configForSeed(seed)),
				error: null
			};
		} catch (error) {
			const message =
				error instanceof SimulationCreationError || error instanceof HabitatGenerationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Simulation creation failed';
			return {
				simulation: createSimulation(configForSeed('demo')),
				error: message
			};
		}
	}

	/** UI-only random seed; not used on the generation path. */
	function randomSeed(): string {
		const bytes = new Uint32Array(2);
		crypto.getRandomValues(bytes);
		return `seed-${bytes[0]!.toString(36)}-${bytes[1]!.toString(36)}`;
	}

	const initial = tryCreateSimulation('demo');
	let simulation = $state(initial.simulation);
	let seedInput = $state(initial.simulation.seed);
	let errorMessage = $state<string | null>(initial.error);
	let paused = $state(false);
	/** Presentation-only selection; never written into simulation state. */
	let selectedCreatureId = $state<string | null>(null);
	/** Presentation-only workbench tab; never written into simulation state. */
	let activeWorkbenchTab = $state<WorkbenchTabId>('overview');

	// Accumulator lives outside reactive state so rAF ticks do not thrash Svelte.
	let accumulator = 0;
	let lastFrameMs: number | null = null;
	let rafId = 0;

	function clearStaleSelection(next: SimulationState): void {
		if (
			selectedCreatureId !== null &&
			!next.creatures.some((creature) => creature.id === selectedCreatureId)
		) {
			selectedCreatureId = null;
		}
	}

	function regenerate(): void {
		const seed = seedInput.trim();
		if (seed.length === 0) {
			errorMessage = 'Seed must be a non-empty string.';
			return;
		}

		try {
			simulation = createSimulation(configForSeed(seed));
			seedInput = simulation.seed;
			errorMessage = null;
			accumulator = 0;
			lastFrameMs = null;
			clearStaleSelection(simulation);
		} catch (error) {
			errorMessage =
				error instanceof SimulationCreationError || error instanceof HabitatGenerationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Simulation creation failed';
		}
	}

	function useRandomSeed(): void {
		seedInput = randomSeed();
		regenerate();
	}

	function resetSimulation(): void {
		const seed = simulation.seed;
		seedInput = seed;
		try {
			simulation = createSimulation(configForSeed(seed));
			errorMessage = null;
			accumulator = 0;
			lastFrameMs = null;
			clearStaleSelection(simulation);
		} catch (error) {
			errorMessage =
				error instanceof SimulationCreationError || error instanceof HabitatGenerationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Simulation reset failed';
		}
	}

	function togglePause(): void {
		paused = !paused;
		lastFrameMs = null;
	}

	function selectCreature(creatureId: string | null): void {
		// Selection must not mutate simulation state — only presentation id/tab.
		selectedCreatureId = creatureId;
		if (creatureId !== null) {
			activeWorkbenchTab = 'creatures';
		}
	}

	onMount(() => {
		const config = simulationConfigBase;

		function frame(nowMs: number): void {
			if (lastFrameMs === null) {
				lastFrameMs = nowMs;
			} else if (!paused) {
				const elapsed = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
				lastFrameMs = nowMs;
				const result = advanceSimulation(simulation, elapsed, accumulator, config);
				accumulator = result.accumulator;
				if (result.stepsTaken > 0) {
					// Always adopt the stepped state, including habitat resource amounts.
					// Habitat presentation reconciles by layout/feature id (no freeze needed).
					simulation = result.state;
					clearStaleSelection(simulation);
				}
			} else {
				lastFrameMs = nowMs;
			}

			rafId = requestAnimationFrame(frame);
		}

		rafId = requestAnimationFrame(frame);
		return () => {
			cancelAnimationFrame(rafId);
		};
	});

	const habitat: Habitat = $derived(simulation.habitat);
	const creatures = $derived(simulation.creatures);
</script>

<main class="page">
	<header class="header">
		<h1>Creature Simulator</h1>
		<p>
			Creatures have inspectable needs and resource-driven goals. Simulation state is plain data;
			Three.js is presentation only. Selection does not alter behaviour.
		</p>
	</header>

	<div class="workspace">
		<section class="stage" aria-label="Presentation stage">
			<ThreeViewport
				{habitat}
				{creatures}
				activeEmissions={simulation.activeEmissions}
				timeSeconds={simulation.timeSeconds}
				weather={simulation.environment.weather}
				{selectedCreatureId}
				sensingRadius={simulationConfigBase.sensingRadius}
				hearingRadius={simulationConfigBase.hearingRadius}
				investigationDistanceScale={simulationConfigBase.investigationDistanceScale}
				triggerFeatureCueFadeSeconds={simulationConfigBase.triggerFeatureCueFadeSeconds}
				onSelectCreature={selectCreature}
			/>
		</section>
		<WorkbenchShell
			{simulation}
			{seedInput}
			{errorMessage}
			config={configForSeed(simulation.seed)}
			{paused}
			{selectedCreatureId}
			activeTab={activeWorkbenchTab}
			onActiveTabChange={(tab) => {
				activeWorkbenchTab = tab;
			}}
			onSeedInput={(value) => {
				seedInput = value;
			}}
			onRegenerate={regenerate}
			onRandomSeed={useRandomSeed}
			onTogglePause={togglePause}
			onReset={resetSimulation}
			onSelectCreature={selectCreature}
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
