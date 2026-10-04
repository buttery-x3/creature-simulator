<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { SimulationConfig, SimulationState } from '$lib/simulation';
	import { captureRun, type CapturedRun } from './run-capture';
	let {
		simulation,
		config,
		captured,
		onCapture
	}: {
		simulation: SimulationState;
		config: SimulationConfig;
		captured: CapturedRun | null;
		onCapture: (value: CapturedRun) => void;
	} = $props();
	let previewOpen = $state(false);
	let message = $state('');
	let error = $state('');
	const downloads = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	function releaseDownload(url: string) {
		const timer = downloads.get(url);
		if (timer !== undefined) clearTimeout(timer);
		downloads.delete(url);
		URL.revokeObjectURL(url);
	}
	onDestroy(() => {
		for (const url of downloads.keys()) releaseDownload(url);
	});
	function capture() {
		error = '';
		message = '';
		try {
			onCapture(
				captureRun(simulation, config, {
					capturedAt: new Date().toISOString(),
					browserUserAgent: navigator.userAgent
				})
			);
			message = 'Capture saved. It stays unchanged until you capture again.';
		} catch {
			error = 'Could not capture this run. The previous capture is still available.';
		}
	}
	async function copy() {
		if (!captured) return;
		error = '';
		message = '';
		try {
			await navigator.clipboard.writeText(captured.json);
			message = 'Capture copied.';
		} catch {
			error = 'Could not copy the capture. Use Download or select the preview text.';
		}
	}
	function download() {
		if (!captured) return;
		error = '';
		message = '';
		let url: string | null = null;
		try {
			url = URL.createObjectURL(new Blob([captured.json], { type: 'application/json' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = captured.filename;
			document.body.append(link);
			try {
				link.click();
			} finally {
				link.remove();
			}
			const downloadUrl = url;
			downloads.set(
				url,
				setTimeout(() => releaseDownload(downloadUrl), 1000)
			);
			message = 'Capture download requested.';
		} catch {
			if (url) releaseDownload(url);
			error = 'Could not download the capture. Use Copy or select the preview text.';
		}
	}
</script>

<section class="capture" data-testid="debug-run-capture" aria-label="Saved run capture">
	<h3>Run capture</h3>
	<p>
		Save the current state and active configuration together. A capture stays unchanged as the run
		advances or is regenerated; capturing again replaces it.
	</p>
	<button type="button" onclick={capture} data-testid="debug-capture-run"
		>Capture current run</button
	>
	{#if captured}
		<p class="saved" data-testid="debug-capture-summary">
			Captured run · seed <strong>{captured.seed}</strong> · t={captured.timeSeconds.toFixed(3)}s · {captured.capturedAt}
		</p>
		<div class="actions">
			<button type="button" onclick={copy} data-testid="debug-copy-capture">Copy capture</button
			><button type="button" onclick={download} data-testid="debug-download-capture"
				>Download capture</button
			>
		</div>
		<details bind:open={previewOpen} data-testid="debug-capture-preview">
			<summary>Captured JSON</summary>{#if previewOpen}<pre
					data-testid="debug-captured-json">{captured.json}</pre>{/if}
		</details>
	{:else}<p>No capture saved.</p>{/if}
	<p>
		For inspection and bug reports. The current capture is kept until this page reloads; download it
		to keep a file.
	</p>
	{#if message}<p role="status">{message}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	h3 {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9ca3af;
	}
	p {
		margin: 0.4rem 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.4;
	}
	.saved {
		color: #e2e8f0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	button {
		padding: 0.25rem 0.45rem;
		border: 1px solid #334155;
		border-radius: 0.3rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}
	summary {
		margin: 0.5rem 0;
		font-size: 0.75rem;
		color: #cbd5e1;
		cursor: pointer;
	}
	pre {
		margin: 0;
		padding: 0.55rem;
		border-radius: 0.35rem;
		background: #020617;
		border: 1px solid #1e293b;
		color: #94a3b8;
		font-size: 0.68rem;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 16rem;
		overflow: auto;
	}
	.error {
		color: #fca5a5;
	}
</style>
