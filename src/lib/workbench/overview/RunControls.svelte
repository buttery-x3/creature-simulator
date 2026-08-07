<script lang="ts">
	type Props = {
		seedInput: string;
		activeSeed: string;
		timeSeconds: number;
		paused: boolean;
		creatureCount: number;
		signalCount: number;
		errorMessage: string | null;
		onSeedInput: (value: string) => void;
		onRegenerate: () => void;
		onRandomSeed: () => void;
		onTogglePause: () => void;
		onReset: () => void;
	};

	let {
		seedInput,
		activeSeed,
		timeSeconds,
		paused,
		creatureCount,
		signalCount,
		errorMessage,
		onSeedInput,
		onRegenerate,
		onRandomSeed,
		onTogglePause,
		onReset
	}: Props = $props();
</script>

<section class="run-controls" data-testid="overview-run-controls" aria-label="Run controls">
	<p class="summary" data-testid="simulation-summary">
		{paused ? 'Paused' : 'Running'} · t={timeSeconds.toFixed(2)}s · creatures {creatureCount} · signals
		{signalCount}
	</p>

	<label class="field" for="habitat-seed">
		<span>Seed</span>
		<input
			id="habitat-seed"
			data-testid="habitat-seed-input"
			type="text"
			value={seedInput}
			oninput={(event) => onSeedInput(event.currentTarget.value)}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					onRegenerate();
				}
			}}
		/>
	</label>

	<div class="actions">
		<button type="button" data-testid="simulation-pause-resume" onclick={onTogglePause}>
			{paused ? 'Resume' : 'Pause'}
		</button>
		<button type="button" data-testid="simulation-reset" onclick={onReset}>Reset</button>
		<button type="button" data-testid="habitat-regenerate" onclick={onRegenerate}>
			Regenerate
		</button>
		<button type="button" data-testid="habitat-random-seed" onclick={onRandomSeed}>
			New random seed
		</button>
	</div>

	{#if errorMessage}
		<p class="error" data-testid="habitat-error" role="alert">{errorMessage}</p>
	{/if}

	<dl class="meta" data-testid="simulation-meta">
		<div>
			<dt>Active seed</dt>
			<dd>{activeSeed}</dd>
		</div>
		<div>
			<dt>Status</dt>
			<dd>{paused ? 'paused' : 'running'}</dd>
		</div>
		<div>
			<dt>Sim time</dt>
			<dd>{timeSeconds.toFixed(3)} s</dd>
		</div>
		<div>
			<dt>Creatures</dt>
			<dd>{creatureCount}</dd>
		</div>
	</dl>
</section>

<style>
	.run-controls {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid #1f2937;
		position: sticky;
		top: 0;
		background: #0b1220;
		z-index: 1;
	}

	.summary {
		margin: 0;
		font-size: 0.85rem;
		color: #d1d5db;
		line-height: 1.4;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: #cbd5e1;
	}

	.field input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #111827;
		color: #e5e7eb;
		font: inherit;
	}

	.field input:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.actions button {
		flex: 1 1 auto;
		padding: 0.4rem 0.55rem;
		border: 1px solid #334155;
		border-radius: 0.35rem;
		background: #1e293b;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.actions button:hover {
		background: #334155;
	}

	.error {
		margin: 0;
		padding: 0.45rem 0.55rem;
		border-radius: 0.35rem;
		background: #450a0a;
		color: #fecaca;
		font-size: 0.8rem;
		line-height: 1.35;
	}

	.meta {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.78rem;
	}

	.meta div {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 0.35rem;
	}

	.meta dt {
		margin: 0;
		color: #94a3b8;
	}

	.meta dd {
		margin: 0;
		color: #e2e8f0;
		word-break: break-word;
	}
</style>
