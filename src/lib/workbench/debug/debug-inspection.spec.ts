import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createSimulation, defaultSimulationConfig } from '$lib/simulation';
import DebugTab from './DebugTab.svelte';
import RunCapture from './RunCapture.svelte';
import { captureRun } from './run-capture';

describe('on-demand debug inspection', () => {
	it('omits the full live snapshot while closed and keeps existing config diagnostics', () => {
		const config = defaultSimulationConfig('lazy-raw');
		const simulation = createSimulation(config);
		const { body } = render(DebugTab, {
			props: {
				simulation,
				config,
				paused: true,
				selectedCreatureId: null,
				capturedRun: null,
				onCapture: () => {}
			}
		});
		expect(body).toContain('debug-live-snapshot');
		expect(body).not.toContain('data-testid="debug-simulation-snapshot"');
		expect(body).toContain('debug-config-json');
		expect(body).toContain('No capture saved.');
	});
	it('labels the saved seed and time separately from the current run without rendering the closed capture preview', () => {
		const oldConfig = defaultSimulationConfig('old-run');
		const old = createSimulation(oldConfig);
		old.timeSeconds = 12.3456789;
		const captured = captureRun(old, oldConfig, {
			capturedAt: '2026-10-05T00:00:00.000Z',
			browserUserAgent: 'test'
		});
		const config = defaultSimulationConfig('new-run');
		const simulation = createSimulation(config);
		const { body } = render(RunCapture, {
			props: { simulation, config, captured, onCapture: () => {} }
		});
		expect(body).toContain('old-run');
		expect(body).toContain('12.346s');
		expect(body).toContain('2026-10-05T00:00:00.000Z');
		expect(body).not.toContain('data-testid="debug-captured-json"');
		expect(body).toContain('debug-download-capture');
	});
});
