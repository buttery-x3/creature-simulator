import { describe, expect, it } from 'vitest';
import { createSimulation, scenarioSimulationConfig } from '$lib/simulation';
import { captureRun } from './run-capture';
const metadata = { capturedAt: '2026-10-05T00:00:00.000Z', browserUserAgent: 'test-browser/1' };

describe('observer run capture', () => {
	it('round-trips complete state and active configuration without rounding numbers', () => {
		const config = scenarioSimulationConfig('capture-source', 'resource-rich');
		const state = createSimulation(config);
		state.timeSeconds = 0.12345678901234568;
		state.creatures[0].position.x = -3.1234567890123457;
		const before = JSON.stringify({ state, config });
		const captured = captureRun(state, config, metadata);
		const bundle = JSON.parse(captured.json);
		expect(bundle).toEqual({
			format: 'creature-simulator-debug',
			version: 1,
			capturedAt: metadata.capturedAt,
			runtime: { kind: 'browser', userAgent: metadata.browserUserAgent },
			config,
			state
		});
		expect(bundle.state.timeSeconds).toBe(state.timeSeconds);
		expect(bundle.state.creatures[0].position.x).toBe(state.creatures[0].position.x);
		expect(captured.timeSeconds).toBe(state.timeSeconds);
		expect(JSON.stringify({ state, config })).toBe(before);
	});
	it('retains an immutable value when nested source state, config or metadata subsequently changes', () => {
		const config = scenarioSimulationConfig('old-seed', 'resource-rich');
		const state = createSimulation(config);
		const sourceMetadata = { ...metadata };
		const captured = captureRun(state, config, sourceMetadata);
		const original = captured.json;
		state.timeSeconds = 99;
		state.creatures[0].position.x = 999;
		state.seed = 'new-seed';
		config.foodSpawnIntervalSeconds = 99;
		sourceMetadata.browserUserAgent = 'changed';
		expect(captured.json).toBe(original);
		const bundle = JSON.parse(captured.json);
		expect(bundle.state.seed).toBe('old-seed');
		expect(bundle.state.timeSeconds).toBe(0);
		expect(bundle.config.foodSpawnIntervalSeconds).toBe(8);
		expect(bundle.runtime.userAgent).toBe('test-browser/1');
	});
	it('uses a bounded filename while preserving the exact seed inside the capture', () => {
		const config = scenarioSimulationConfig('../odd:seed/' + 'z'.repeat(80));
		const state = createSimulation(config);
		const captured = captureRun(state, config, metadata);
		expect(captured.filename).toMatch(/^creature-simulator-[a-zA-Z0-9_-]+-0\.000s\.json$/);
		expect(captured.filename.length).toBeLessThan(90);
		expect(JSON.parse(captured.json).state.seed).toBe(config.seed);
	});
});
