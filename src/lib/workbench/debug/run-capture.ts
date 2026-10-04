/** Observer export only: no replay, import or source-build identity contract. */
import type { SimulationConfig, SimulationState } from '$lib/simulation';

export type RunCaptureMetadata = { capturedAt: string; browserUserAgent: string };
export type RunCaptureBundle = {
	format: 'creature-simulator-debug';
	version: 1;
	capturedAt: string;
	runtime: { kind: 'browser'; userAgent: string };
	config: SimulationConfig;
	state: SimulationState;
};
/** Only the serialized value is retained, so subsequent live state changes cannot alter it. */
export type CapturedRun = {
	readonly json: string;
	readonly filename: string;
	readonly seed: string;
	readonly timeSeconds: number;
	readonly capturedAt: string;
};

export function captureRun(
	state: SimulationState,
	config: SimulationConfig,
	metadata: RunCaptureMetadata
): CapturedRun {
	const bundle: RunCaptureBundle = {
		format: 'creature-simulator-debug',
		version: 1,
		capturedAt: metadata.capturedAt,
		runtime: { kind: 'browser', userAgent: metadata.browserUserAgent },
		config,
		state
	};
	const json = JSON.stringify(bundle);
	const safeSeed = state.seed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'run';
	return {
		json,
		filename: 'creature-simulator-' + safeSeed + '-' + state.timeSeconds.toFixed(3) + 's.json',
		seed: state.seed,
		timeSeconds: state.timeSeconds,
		capturedAt: metadata.capturedAt
	};
}
