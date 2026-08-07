/**
 * Presentation-only workbench navigation and filter vocabulary.
 * Must never be written into authoritative SimulationState.
 */

export const WORKBENCH_TABS = [
	'overview',
	'creatures',
	'communication',
	'world',
	'events',
	'debug'
] as const;

export type WorkbenchTabId = (typeof WORKBENCH_TABS)[number];

export const WORKBENCH_TAB_LABELS: Record<WorkbenchTabId, string> = {
	overview: 'Overview',
	creatures: 'Creatures',
	communication: 'Communication',
	world: 'World',
	events: 'Events',
	debug: 'Debug'
};

export type EventCategory =
	'Behaviour' | 'Perception' | 'Communication' | 'Investigation' | 'Learning' | 'Lexicon' | 'World';

export type EventFilterState = {
	category: EventCategory | 'all';
	creatureId: string | 'all';
	symbolId: string | 'all';
	/** When set, only rows with timeSeconds >= (now - windowSeconds). Null = no window. */
	windowSeconds: number | null;
};

export const DEFAULT_EVENT_FILTER: EventFilterState = {
	category: 'all',
	creatureId: 'all',
	symbolId: 'all',
	windowSeconds: null
};

/** Cross-tab navigation intents (presentation only). */
export type WorkbenchNavigate =
	| { kind: 'creatures'; creatureId: string | null }
	| { kind: 'communication'; creatureId?: string | null }
	| { kind: 'events'; filter?: Partial<EventFilterState> }
	| { kind: 'world'; featureId?: string | null }
	| { kind: 'debug' };
