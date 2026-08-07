<script lang="ts">
	import type { SimulationConfig, SimulationState } from '$lib/simulation';
	import CommunicationTab from './communication/CommunicationTab.svelte';
	import CreaturesTab from './creatures/CreaturesTab.svelte';
	import DebugTab from './debug/DebugTab.svelte';
	import EventsTab from './events/EventsTab.svelte';
	import OverviewTab from './overview/OverviewTab.svelte';
	import WorkbenchTabs from './WorkbenchTabs.svelte';
	import WorldTab from './world/WorldTab.svelte';
	import {
		DEFAULT_EVENT_FILTER,
		type EventFilterState,
		type WorkbenchNavigate,
		type WorkbenchTabId
	} from './workbench-types';

	type Props = {
		simulation: SimulationState;
		seedInput: string;
		errorMessage: string | null;
		config: SimulationConfig;
		paused: boolean;
		selectedCreatureId: string | null;
		activeTab: WorkbenchTabId;
		onActiveTabChange: (tab: WorkbenchTabId) => void;
		onSeedInput: (value: string) => void;
		onRegenerate: () => void;
		onRandomSeed: () => void;
		onTogglePause: () => void;
		onReset: () => void;
		onSelectCreature: (creatureId: string | null) => void;
	};

	let {
		simulation,
		seedInput,
		errorMessage,
		config,
		paused,
		selectedCreatureId,
		activeTab,
		onActiveTabChange,
		onSeedInput,
		onRegenerate,
		onRandomSeed,
		onTogglePause,
		onReset,
		onSelectCreature
	}: Props = $props();

	let eventFilter = $state<EventFilterState>({ ...DEFAULT_EVENT_FILTER });
	let communicationCreatureFilter = $state<string | null>(null);
	let worldFeatureFocus = $state<string | null>(null);

	function handleNavigate(intent: WorkbenchNavigate) {
		switch (intent.kind) {
			case 'creatures':
				onSelectCreature(intent.creatureId);
				onActiveTabChange('creatures');
				break;
			case 'communication':
				communicationCreatureFilter = intent.creatureId ?? null;
				onActiveTabChange('communication');
				break;
			case 'events':
				eventFilter = { ...DEFAULT_EVENT_FILTER, ...intent.filter };
				onActiveTabChange('events');
				break;
			case 'world':
				worldFeatureFocus = intent.featureId ?? null;
				onActiveTabChange('world');
				break;
			case 'debug':
				onActiveTabChange('debug');
				break;
		}
	}
</script>

<aside class="workbench" data-testid="habitat-workbench" aria-label="Simulation workbench">
	<!-- Compact read-only status (not full run controls — those stay on Overview). -->
	<div class="status-strip" data-testid="workbench-status-strip" aria-label="Simulation status">
		<span data-testid="simulation-status">{paused ? 'paused' : 'running'}</span>
		<span data-testid="simulation-time">{simulation.timeSeconds.toFixed(3)} s</span>
		<span data-testid="habitat-active-seed">{simulation.seed}</span>
		<span data-testid="simulation-creature-count">{simulation.creatures.length}</span>
	</div>
	<WorkbenchTabs {activeTab} onSelectTab={onActiveTabChange} />

	<div
		class="panel"
		role="tabpanel"
		id={`workbench-panel-${activeTab}`}
		aria-labelledby={`workbench-tab-${activeTab}`}
		data-testid={`workbench-panel-${activeTab}`}
		tabindex="0"
	>
		{#if activeTab === 'overview'}
			<OverviewTab
				{simulation}
				{seedInput}
				{errorMessage}
				{paused}
				{onSeedInput}
				{onRegenerate}
				{onRandomSeed}
				{onTogglePause}
				{onReset}
			/>
		{:else if activeTab === 'creatures'}
			<CreaturesTab
				{simulation}
				{config}
				{selectedCreatureId}
				{onSelectCreature}
				onNavigate={handleNavigate}
			/>
		{:else if activeTab === 'communication'}
			<CommunicationTab
				{simulation}
				{config}
				filterCreatureId={communicationCreatureFilter}
				onNavigate={handleNavigate}
			/>
		{:else if activeTab === 'world'}
			<WorldTab {simulation} {config} focusedFeatureId={worldFeatureFocus} />
		{:else if activeTab === 'events'}
			<EventsTab
				{simulation}
				filter={eventFilter}
				onFilterChange={(next) => {
					eventFilter = next;
				}}
				onNavigate={handleNavigate}
			/>
		{:else}
			<DebugTab {simulation} {config} {paused} {selectedCreatureId} />
		{/if}
	</div>
</aside>

<style>
	.workbench {
		display: flex;
		flex-direction: column;
		width: clamp(34rem, 36vw, 44rem);
		flex: 0 0 auto;
		min-height: 0;
		height: 100%;
		border-left: 1px solid #1f2937;
		background: #0b1220;
	}

	.status-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		flex: 0 0 auto;
		padding: 0.4rem 0.65rem;
		border-bottom: 1px solid #1f2937;
		font-size: 0.72rem;
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}

	.status-strip span::before {
		color: #64748b;
		margin-right: 0.25rem;
	}

	.status-strip [data-testid='simulation-status']::before {
		content: 'status ';
	}

	.status-strip [data-testid='simulation-time']::before {
		content: 't ';
	}

	.status-strip [data-testid='habitat-active-seed']::before {
		content: 'seed ';
	}

	.status-strip [data-testid='simulation-creature-count']::before {
		content: 'n ';
	}

	.panel {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
	}
</style>
