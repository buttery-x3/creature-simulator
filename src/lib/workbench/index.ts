/**
 * Domain-organised workbench UI (presentation only).
 * Does not own authoritative simulation state.
 */

export { default as WorkbenchShell } from './WorkbenchShell.svelte';
export {
	DEFAULT_EVENT_FILTER,
	WORKBENCH_TAB_LABELS,
	WORKBENCH_TABS,
	type EventCategory,
	type EventFilterState,
	type WorkbenchNavigate,
	type WorkbenchTabId
} from './workbench-types';
