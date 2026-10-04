<script lang="ts">
	import { isMature, type Creature, type LifecycleConfig } from '$lib/simulation';
	let {
		creature,
		timeSeconds,
		config
	}: { creature: Creature; timeSeconds: number; config: LifecycleConfig } = $props();
	const life = $derived(creature.lifecycle);
	const mature = $derived(isMature(life, config));
</script>

<section data-testid="creature-lifecycle" aria-label="Age and lifecycle">
	<h3>Age & lifecycle</h3>
	<dl>
		<div>
			<dt>Age</dt>
			<dd data-testid="inspector-age">
				{life.ageSeconds.toFixed(1)}s · {mature ? 'adult' : 'juvenile'}
			</dd>
		</div>
		<div>
			<dt>Maturity</dt>
			<dd>
				{config.maturitySeconds.toFixed(1)}s{#if !mature}
					· {Math.max(0, config.maturitySeconds - life.ageSeconds).toFixed(1)}s remaining{/if}
			</dd>
		</div>
		<div>
			<dt>Reproduction cooldown</dt>
			<dd>{Math.max(0, life.nextReproductionAt - timeSeconds).toFixed(1)}s remaining</dd>
		</div>
		<div>
			<dt>Courtship</dt>
			<dd data-testid="inspector-courtship">
				{#if life.courtship}{life.courtship.peerId} · {(
						timeSeconds - life.courtship.startedAt
					).toFixed(1)}s elapsed{#if life.courtship.mutualSince !== null}
						· mutual {(timeSeconds - life.courtship.mutualSince).toFixed(1)} / {config.mutualCourtshipSeconds.toFixed(
							1
						)}s{:else}
						· awaiting mutual courtship{/if}{:else}none{/if}
			</dd>
		</div>
		<div>
			<dt>Hunger deprivation</dt>
			<dd>
				{life.deprivationSeconds.hunger.toFixed(1)}s · grace {config.hungerGraceSeconds.toFixed(1)}s
			</dd>
		</div>
		<div>
			<dt>Thirst deprivation</dt>
			<dd>
				{life.deprivationSeconds.thirst.toFixed(1)}s · grace {config.thirstGraceSeconds.toFixed(1)}s
			</dd>
		</div>
	</dl>
	<p>
		Cooldown completion alone does not imply reproductive eligibility. The candidate factors show
		the actual decision.
	</p>
	<h4>Genealogy · observer only</h4>
	<dl data-testid="inspector-genealogy">
		<div>
			<dt>Generation</dt>
			<dd>{life.generation}</dd>
		</div>
		<div>
			<dt>Parents</dt>
			<dd>{life.parentIds.length ? life.parentIds.join(', ') : 'founder'}</dd>
		</div>
	</dl>
	<p>
		Genealogy is observer metadata. Offspring learn their own symbol meanings and relationships.
	</p>
</section>

<style>
	section {
		margin-bottom: 1rem;
	}
	h3,
	h4 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	h4 {
		margin-top: 0.8rem;
	}
	dl {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		font-size: 0.78rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 0.35rem;
	}
	dt {
		color: #94a3b8;
	}
	dd {
		margin: 0;
		color: #e2e8f0;
	}
	p {
		color: #94a3b8;
		font-size: 0.75rem;
		line-height: 1.4;
	}
</style>
