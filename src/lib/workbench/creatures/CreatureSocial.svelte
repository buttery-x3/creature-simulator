<script lang="ts">
	import { deriveMood, type Creature } from '$lib/simulation';
	let { creature, timeSeconds }: { creature: Creature; timeSeconds: number } = $props();
	const mood = $derived(deriveMood(creature));
</script>

<section data-testid="creature-social" aria-label="Social experience and expression">
	<h3>Social experience & expression</h3>
	<p>
		Dance uses golden arcs; cry uses blue tears. These are innate expressions, distinct from learned
		symbol meanings. Approach peer, dance and cry compete through ordinary intention arbitration.
	</p>
	<dl>
		<div>
			<dt>Comfort / distress</dt>
			<dd data-testid="inspector-mood-condition">
				{mood.comfort.toFixed(2)} / {mood.distress.toFixed(2)}
			</dd>
		</div>
		<div>
			<dt>Positive / company</dt>
			<dd>{mood.positive.toFixed(2)} / {mood.company.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Valence</dt>
			<dd data-testid="inspector-mood-valence">{mood.valence.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Recent pain</dt>
			<dd>{creature.social.recentPain.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Expression</dt>
			<dd data-testid="inspector-expression">
				{#if creature.social.expression}{creature.social.expression.kind} · intensity {creature.social.expression.intensity.toFixed(
						2
					)} · {Math.max(0, creature.social.expression.expiresAt - timeSeconds).toFixed(1)}s
					remaining{:else}none{/if}
			</dd>
		</div>
	</dl>
	<h4>Observed peers</h4>
	<p>
		Local snapshots show position, visible maturity and expression; other creatures’ needs are not
		known.
	</p>
	{#if creature.perceivedPeers.length === 0}<p>No peers currently observed.</p>{:else}
		<div class="table-wrap">
			<table data-testid="inspector-perceived-peers">
				<thead
					><tr><th>Peer</th><th>Position</th><th>Mature</th><th>Expression</th><th>Age</th></tr
					></thead
				><tbody>
					{#each creature.perceivedPeers as peer (peer.id)}<tr
							><td>{peer.id}</td><td
								>({peer.position.x.toFixed(1)}, {peer.position.y.toFixed(1)})</td
							><td>{peer.mature ? 'yes' : 'no'}</td><td
								>{peer.expression?.kind ?? 'none'}{#if peer.expression}
									({peer.expression.intensity.toFixed(2)}){/if}</td
							><td>{Math.max(0, timeSeconds - peer.observedAt).toFixed(1)}s</td></tr
						>{/each}
				</tbody>
			</table>
		</div>{/if}
	<h4>Retained relationships</h4>
	<p>Bounded personal experience; familiarity and liking can differ between two creatures.</p>
	{#if creature.social.relationships.length === 0}<p>No retained relationships.</p>{:else}
		<div class="table-wrap">
			<table data-testid="inspector-relationships">
				<thead><tr><th>Peer</th><th>Familiarity</th><th>Liking</th><th>Last seen</th></tr></thead
				><tbody>
					{#each creature.social.relationships as relation (relation.peerId)}<tr
							><td>{relation.peerId}</td><td>{relation.familiarity.toFixed(2)}</td><td
								>{relation.liking.toFixed(2)}</td
							><td>{relation.lastSeenAt.toFixed(1)}s</td></tr
						>{/each}
				</tbody>
			</table>
		</div>{/if}
</section>

<style>
	h3 {
		margin: 0 0 0.4rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	h4 {
		margin: 0.7rem 0 0.3rem;
		font-size: 0.74rem;
		text-transform: uppercase;
		color: #94a3b8;
	}
	p {
		color: #94a3b8;
		font-size: 0.75rem;
		line-height: 1.4;
	}
	dl {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		font-size: 0.78rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.35rem;
	}
	dt {
		color: #94a3b8;
	}
	dd {
		margin: 0;
		color: #e2e8f0;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.3rem;
		border-bottom: 1px solid #1e293b;
		color: #cbd5e1;
	}
	th {
		color: #94a3b8;
	}
</style>
