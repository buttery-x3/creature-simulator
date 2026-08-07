<script lang="ts">
	import type { SymbolId } from '$lib/simulation';
	import { getSymbolPresentation, type SymbolShape, symbolColorCss } from './symbol-presentation';

	type Props = {
		symbolId: SymbolId | string;
		/** When true, show the stable glyph id next to the icon. */
		showId?: boolean;
		/** Icon edge length in CSS pixels. */
		size?: number;
	};

	let { symbolId, showId = true, size = 12 }: Props = $props();

	const presentation = $derived(getSymbolPresentation(symbolId));
	const color = $derived(symbolColorCss(symbolId));
	const shape = $derived(presentation.shape as SymbolShape);
</script>

<span
	class="symbol-glyph"
	data-testid={`symbol-glyph-${symbolId}`}
	data-symbol-shape={shape}
	style:--glyph-color={color}
	style:--glyph-size={`${size}px`}
	title={presentation.label}
>
	<svg
		class="icon"
		width={size}
		height={size}
		viewBox="0 0 16 16"
		aria-hidden="true"
		focusable="false"
	>
		{#if shape === 'star'}
			<polygon
				points="8,1.5 9.9,6.1 14.8,6.4 10.9,9.6 12.2,14.4 8,11.7 3.8,14.4 5.1,9.6 1.2,6.4 6.1,6.1"
				fill="currentColor"
			/>
		{:else if shape === 'circle'}
			<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" />
		{:else if shape === 'triangle'}
			<polygon points="8,2 14,13.5 2,13.5" fill="currentColor" />
		{:else}
			<rect x="3" y="3" width="10" height="10" fill="currentColor" />
		{/if}
	</svg>
	{#if showId}
		<span class="id">{symbolId}</span>
	{/if}
</span>

<style>
	.symbol-glyph {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		vertical-align: middle;
		color: var(--glyph-color, #e2e8f0);
		font-size: 0.75rem;
		line-height: 1.2;
	}

	.icon {
		flex: 0 0 auto;
		display: block;
	}

	.id {
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}
</style>
