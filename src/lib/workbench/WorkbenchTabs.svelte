<script lang="ts">
	import { WORKBENCH_TAB_LABELS, WORKBENCH_TABS, type WorkbenchTabId } from './workbench-types';

	type Props = {
		activeTab: WorkbenchTabId;
		onSelectTab: (tab: WorkbenchTabId) => void;
	};

	let { activeTab, onSelectTab }: Props = $props();

	function onKeydown(event: KeyboardEvent) {
		const index = WORKBENCH_TABS.indexOf(activeTab);
		if (index < 0) {
			return;
		}
		let next: number | null = null;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			next = (index + 1) % WORKBENCH_TABS.length;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			next = (index - 1 + WORKBENCH_TABS.length) % WORKBENCH_TABS.length;
		} else if (event.key === 'Home') {
			next = 0;
		} else if (event.key === 'End') {
			next = WORKBENCH_TABS.length - 1;
		}
		if (next === null) {
			return;
		}
		event.preventDefault();
		onSelectTab(WORKBENCH_TABS[next]!);
	}
</script>

<div
	class="tablist"
	role="tablist"
	tabindex="-1"
	aria-label="Workbench domains"
	data-testid="workbench-tablist"
	onkeydown={onKeydown}
>
	{#each WORKBENCH_TABS as tab (tab)}
		<button
			type="button"
			role="tab"
			id={`workbench-tab-${tab}`}
			class="tab"
			class:active={activeTab === tab}
			aria-selected={activeTab === tab}
			aria-controls={`workbench-panel-${tab}`}
			tabindex={activeTab === tab ? 0 : -1}
			data-testid={`workbench-tab-${tab}`}
			onclick={() => onSelectTab(tab)}
		>
			{WORKBENCH_TAB_LABELS[tab]}
		</button>
	{/each}
</div>

<style>
	.tablist {
		display: flex;
		flex: 0 0 auto;
		gap: 0.15rem;
		padding: 0.35rem 0.5rem 0;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid #1f2937;
		scrollbar-width: thin;
	}

	.tab {
		flex: 0 0 auto;
		padding: 0.4rem 0.65rem;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 0.35rem 0.35rem 0 0;
		background: transparent;
		color: #94a3b8;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		cursor: pointer;
		white-space: nowrap;
	}

	.tab:hover {
		color: #e2e8f0;
		background: #111827;
	}

	.tab.active {
		color: #f8fafc;
		background: #1e293b;
		border-color: #334155;
		box-shadow: inset 0 -2px 0 #3b82f6;
	}

	.tab:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}
</style>
