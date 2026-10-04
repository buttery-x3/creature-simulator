<script lang="ts">
	import { onMount } from 'svelte';
	import ThreeViewport from '$lib/ThreeViewport.svelte';
	import { WorkbenchShell, type WorkbenchTabId } from '$lib/workbench';
	import type { Habitat } from '$lib/habitat';
	import {
		advanceSimulation,
		stepSimulation,
		daylightAt,
		createSimulation,
		scenarioSimulationConfig,
		type SimulationScenarioId,
		type SimulationState
	} from '$lib/simulation';

	/** UI-only random seed; not used on the generation path. */
	function randomSeed(): string {
		const bytes = new Uint32Array(2);
		crypto.getRandomValues(bytes);
		return `seed-${bytes[0]!.toString(36)}-${bytes[1]!.toString(36)}`;
	}

	const initialConfig = scenarioSimulationConfig('demo', 'baseline');
	let activeConfig = $state(initialConfig);
	let simulation = $state(createSimulation(initialConfig));
	let seedInput = $state(initialConfig.seed);
	let scenarioInput = $state<SimulationScenarioId>('baseline');
	let activeScenario = $state<SimulationScenarioId>('baseline');
	let errorMessage = $state<string | null>(null);
	let paused = $state(false);
	let speed = $state(1);
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

	function replaceRun(seed: string, scenario: SimulationScenarioId): void {
		const trimmedSeed = seed.trim();
		if (!trimmedSeed) {
			errorMessage = 'Seed must be a non-empty string.';
			return;
		}
		try {
			// Prepare both values before publishing either; failures preserve the current run.
			const nextConfig = scenarioSimulationConfig(trimmedSeed, scenario);
			const nextSimulation = createSimulation(nextConfig);
			activeConfig = nextConfig;
			simulation = nextSimulation;
			activeScenario = scenario;
			scenarioInput = scenario;
			seedInput = nextSimulation.seed;
			errorMessage = null;
			accumulator = 0;
			lastFrameMs = null;
			clearStaleSelection(nextSimulation);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Simulation creation failed';
		}
	}
	function regenerate(): void {
		replaceRun(seedInput, scenarioInput);
	}
	function useRandomSeed(): void {
		replaceRun(randomSeed(), scenarioInput);
	}
	function resetSimulation(): void {
		replaceRun(simulation.seed, activeScenario);
	}

	function togglePause(): void {
		paused = !paused;
		lastFrameMs = null;
	}

	function stepOnce(): void {
		if (!paused) return;
		simulation = stepSimulation(simulation, activeConfig);
		accumulator = 0;
		clearStaleSelection(simulation);
	}

	function selectCreature(creatureId: string | null): void {
		// Selection must not mutate simulation state — only presentation id/tab.
		selectedCreatureId = creatureId;
		if (creatureId !== null) {
			activeWorkbenchTab = 'creatures';
		}
	}

	onMount(() => {
		function frame(nowMs: number): void {
			if (lastFrameMs === null) {
				lastFrameMs = nowMs;
			} else if (!paused) {
				const elapsed = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
				lastFrameMs = nowMs;
				const result = advanceSimulation(simulation, elapsed * speed, accumulator, activeConfig);
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
			Observe creatures learning, foraging and encountering wildlife through a changing day. Select
			a creature to inspect its local knowledge and the evidence behind its decisions.
		</p>
	</header>

	<div class="workspace">
		<section class="stage" aria-label="Presentation stage">
			<ThreeViewport
				{habitat}
				{creatures}
				wildlife={simulation.wildlife}
				daylight={daylightAt(simulation.timeSeconds, activeConfig.ecology)}
				activeEmissions={simulation.activeEmissions}
				timeSeconds={simulation.timeSeconds}
				weather={simulation.environment.weather}
				{selectedCreatureId}
				sensingRadius={activeConfig.sensingRadius}
				hearingRadius={activeConfig.hearingRadius}
				investigationDistanceScale={activeConfig.investigationDistanceScale}
				onSelectCreature={selectCreature}
			/>
		</section>
		<WorkbenchShell
			{simulation}
			{seedInput}
			{scenarioInput}
			{activeScenario}
			onScenarioInput={(value) => {
				scenarioInput = value;
			}}
			{errorMessage}
			config={activeConfig}
			{paused}
			{speed}
			onSpeedChange={(value) => {
				speed = value;
			}}
			onStep={stepOnce}
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
