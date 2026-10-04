/**
 * Reproducible headless ecology observation; opens no server port.
 * Usage: node scripts/overnight-observation.mjs [REPORT_PATH] [SIMULATED_SECONDS] [SCENARIO]
 * Default: baseline, three fixed seeds, 600 seconds each, normal fixedDt; 60-second determinism repeat.
 * Reports observations rather than asserting ecological success or lifecycle outcomes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('..', import.meta.url));
const reportPath = path.resolve(
	process.argv[2] ?? path.join(root, 'docs/overnight-observation-results.md')
);
const duration = Number(process.argv[3] ?? 600);
const scenario = process.argv[4] ?? 'baseline';
assert.ok(Number.isFinite(duration) && duration > 0, 'Duration must be positive and finite');
const seeds = ['demo', 'overnight-river', 'overnight-drought'];
const fields = ['hunger', 'thirst', 'energy', 'health'];
const rounded = (value) => (Number.isFinite(value) ? Number(value.toFixed(4)) : null);
const increment = (counts, key, amount = 1) => {
	counts[key] = (counts[key] ?? 0) + amount;
};

function sourceFingerprint() {
	const hash = createHash('sha256');
	function visit(directory) {
		for (const item of fs
			.readdirSync(directory, { withFileTypes: true })
			.sort((a, b) => a.name.localeCompare(b.name))) {
			const absolute = path.join(directory, item.name);
			if (item.isDirectory()) visit(absolute);
			else if (item.name.endsWith('.ts') && !item.name.endsWith('.spec.ts')) {
				hash.update(path.relative(root, absolute).replaceAll('\\', '/'));
				hash.update(fs.readFileSync(absolute, 'utf8').replaceAll('\r\n', '\n'));
			}
		}
	}
	for (const name of ['determinism', 'habitat', 'simulation'])
		visit(path.join(root, 'src/lib', name));
	return hash.digest('hex');
}

function run(api, seed, seconds, hashTrajectory = false) {
	const config = api.scenarioSimulationConfig(seed, scenario);
	let state = api.createSimulation(config);
	const stats = {
		seed,
		simulatedSeconds: seconds,
		fixedDt: config.fixedDt,
		steps: Math.round(seconds / config.fixedDt),
		runtimeSeconds: 0,
		initialPopulation: state.creatures.length,
		populationMinimum: state.creatures.length,
		populationMaximum: state.creatures.length,
		births: 0,
		deaths: 0,
		deathCauses: {},
		courtshipFailures: {},
		maximumGeneration: 0,
		aliveCreatureSeconds: 0,
		firstExtinctionAt: state.creatures.length === 0 ? 0 : null,
		saturatedLifeEventSteps: 0,
		actionSamples: {},
		intentionSamples: {},
		intentionEntries: {},
		encounters: {},
		encounterAmounts: {},
		saturatedEncounterSteps: 0,
		extremes: Object.fromEntries(fields.map((field) => [field, { min: Infinity, max: -Infinity }])),
		maxMemoryEntries: 0,
		maxMemoryCapacity: 0,
		memoryBoundViolations: 0,
		maxRelationships: 0,
		maxObservedPeers: 0,
		maxMovementEncounters: 0,
		maxPendingMovementTraces: 0,
		movementBoundViolations: 0,
		movementOutcomes: {},
		movementBindings: {},
		approachCalls: 0,
		learnedApproachCalls: 0,
		saturatedEmissionSteps: 0,
		maximumApproachCarriers: 0,
		followStarts: 0,
		followBoundViolations: 0,
		followCreatureSeconds: 0,
		followOutcomes: {},
		maximumFollowDuration: 0,
		maximumFollowTravel: 0,
		saturatedLearningSteps: 0,
		expressionStarts: {},
		highHungerCreatureSeconds: 0,
		highThirstCreatureSeconds: 0,
		lowEnergyCreatureSeconds: 0,
		exhaustedHomeTravelCreatureSeconds: 0,
		longestHighHungerSeconds: 0,
		longestHighThirstSeconds: 0,
		intentionSwitches: 0,
		rapidIntentionSwitches: 0,
		rapidTransitionPairs: {},
		maximumStationaryMovementSeconds: 0,
		final: null,
		trajectorySha256: null
	};
	const previous = new Map(
		state.creatures.map((c) => [
			c.id,
			{
				intention: c.intention,
				switchedAt: 0,
				position: c.position,
				hungerRun: 0,
				thirstRun: 0,
				stationaryRun: 0
			}
		])
	);
	const trajectory = hashTrajectory ? createHash('sha256') : null;
	let nextSample = 1;
	const started = performance.now();
	for (let step = 1; step <= stats.steps; step += 1) {
		state = api.stepSimulation(state, config);
		if (trajectory) trajectory.update(JSON.stringify(state));
		const events = state.recentEncounters.filter((event) => event.time === state.timeSeconds);
		if (events.length === config.ecology.encounterHistoryLimit) stats.saturatedEncounterSteps += 1;
		for (const event of events) {
			increment(stats.encounters, event.kind);
			increment(stats.encounterAmounts, event.kind, event.amount);
		}
		const livingIds = new Set(state.creatures.map((creature) => creature.id));
		for (const id of previous.keys()) {
			if (!livingIds.has(id)) {
				stats.deaths += 1;
				previous.delete(id);
			}
		}
		stats.populationMinimum = Math.min(stats.populationMinimum, state.creatures.length);
		stats.populationMaximum = Math.max(stats.populationMaximum, state.creatures.length);
		stats.aliveCreatureSeconds += state.creatures.length * config.fixedDt;
		if (state.creatures.length === 0 && stats.firstExtinctionAt === null)
			stats.firstExtinctionAt = rounded(state.timeSeconds);
		const lifeEvents = state.recentLifeEvents.filter((event) => event.time === state.timeSeconds);
		if (lifeEvents.length === config.lifecycle.eventHistoryLimit)
			stats.saturatedLifeEventSteps += 1;
		for (const event of lifeEvents) {
			if (event.kind === 'death') increment(stats.deathCauses, event.cause);
			if (event.kind === 'courtship_failed') increment(stats.courtshipFailures, event.reason);
		}
		const currentCalls = new Set();
		if (
			state.recentEmissions.filter((emission) => emission.emittedAt === state.timeSeconds)
				.length === config.recentSimulationEmissionHistoryLimit
		)
			stats.saturatedEmissionSteps += 1;
		// Positive lifetime preserves every new emission here, without diagnostic-history truncation.
		for (const emission of state.activeEmissions) {
			if (
				emission.emittedAt !== state.timeSeconds ||
				emission.contextDetail !== 'approach' ||
				currentCalls.has(emission.id)
			)
				continue;
			currentCalls.add(emission.id);
			stats.approachCalls += 1;
			if (emission.selectionEvidence.mode === 'learned_lexicon') stats.learnedApproachCalls += 1;
		}
		let approachCarriers = 0;
		const currentLearning = new Set();
		const sample = state.timeSeconds + 1e-8 >= nextSample;
		for (const creature of state.creatures) {
			let prior = previous.get(creature.id);
			if (!prior) {
				stats.births += 1;
				prior = {
					intention: creature.intention,
					switchedAt: state.timeSeconds,
					position: creature.position,
					hungerRun: 0,
					thirstRun: 0,
					stationaryRun: 0
				};
				previous.set(creature.id, prior);
			}
			stats.maximumGeneration = Math.max(stats.maximumGeneration, creature.lifecycle.generation);
			const companionship = creature.social.companionship;
			if (companionship.active) {
				const episode = companionship.active;
				if (
					!Number.isFinite(episode.travelDistance) ||
					episode.travelDistance < 0 ||
					episode.travelDistance > api.FOLLOW_DEFAULTS.maximumTravel + 1e-9 ||
					state.timeSeconds >= episode.expiresAt ||
					episode.startedAt > state.timeSeconds ||
					creature.intention !== 'follow_peer' ||
					creature.target?.kind !== 'creature' ||
					creature.target.creatureId !== episode.peerId
				)
					stats.followBoundViolations += 1;
				if (episode.startedAt === state.timeSeconds) stats.followStarts += 1;
				stats.followCreatureSeconds += config.fixedDt;
				stats.maximumFollowDuration = Math.max(
					stats.maximumFollowDuration,
					state.timeSeconds - episode.startedAt
				);
				stats.maximumFollowTravel = Math.max(stats.maximumFollowTravel, episode.travelDistance);
			}
			const followOutcome = companionship.lastOutcome;
			if (followOutcome?.timeSeconds === state.timeSeconds) {
				increment(stats.followOutcomes, followOutcome.reason);
				stats.maximumFollowDuration = Math.max(
					stats.maximumFollowDuration,
					followOutcome.durationSeconds
				);
				stats.maximumFollowTravel = Math.max(
					stats.maximumFollowTravel,
					followOutcome.travelDistance
				);
			}

			for (const field of fields) {
				const value = field === 'health' ? creature.body.health : creature[field];
				assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${seed}: invalid ${field}`);
				stats.extremes[field].min = Math.min(stats.extremes[field].min, value);
				stats.extremes[field].max = Math.max(stats.extremes[field].max, value);
			}
			assert.ok(Number.isFinite(creature.position.x) && Number.isFinite(creature.position.y));
			stats.maxMemoryEntries = Math.max(stats.maxMemoryEntries, creature.memory.entries.length);
			stats.maxMemoryCapacity = Math.max(stats.maxMemoryCapacity, creature.memory.capacity);
			if (creature.memory.entries.length > creature.memory.capacity)
				stats.memoryBoundViolations += 1;
			stats.maxRelationships = Math.max(
				stats.maxRelationships,
				creature.social.relationships.length
			);
			stats.maxObservedPeers = Math.max(stats.maxObservedPeers, creature.perceivedPeers.length);
			const movement = creature.movementLearning;
			const pending = movement.encounters.filter(
				(encounter) => encounter.trace?.status === 'pending'
			).length;
			stats.maxMovementEncounters = Math.max(
				stats.maxMovementEncounters,
				movement.encounters.length
			);
			stats.maxPendingMovementTraces = Math.max(stats.maxPendingMovementTraces, pending);
			if (
				movement.encounters.length > api.MOVEMENT_DEFAULTS.encounterCapacity ||
				pending > api.MOVEMENT_DEFAULTS.pendingCapacity
			)
				stats.movementBoundViolations += 1;
			if (creature.lexicon.approach !== null) approachCarriers += 1;
			if (movement.lastBinding?.heardAt === state.timeSeconds)
				increment(stats.movementBindings, movement.lastBinding.status);
			const learning = creature.recentLearning.filter(
				(entry) => entry.timeSeconds === state.timeSeconds
			);
			if (learning.length === config.learningHistoryLimit) stats.saturatedLearningSteps += 1;
			for (const event of learning) {
				if (
					!['approach_evidence', 'approach_contradicted', 'approach_unobserved'].includes(
						event.outcome
					)
				)
					continue;
				const key = `${creature.id}:${event.emissionId}:${event.outcome}`;
				if (currentLearning.has(key)) continue;
				currentLearning.add(key);
				increment(stats.movementOutcomes, event.outcome);
			}
			assert.ok(creature.social.relationships.length <= api.SOCIAL_DEFAULTS.relationshipCapacity);
			assert.ok(creature.perceivedPeers.length <= api.SOCIAL_DEFAULTS.peerCapacity);
			for (const relationship of creature.social.relationships) {
				assert.ok(
					Number.isFinite(relationship.familiarity) &&
						relationship.familiarity >= 0 &&
						relationship.familiarity <= 1
				);
				assert.ok(
					Number.isFinite(relationship.liking) &&
						relationship.liking >= -1 &&
						relationship.liking <= 1
				);
			}
			if (creature.social.expression?.startedAt === state.timeSeconds)
				increment(stats.expressionStarts, creature.social.expression.kind);
			const hungry = creature.hunger >= 0.95;
			const thirsty = creature.thirst >= 0.95;
			prior.hungerRun = hungry ? prior.hungerRun + config.fixedDt : 0;
			prior.thirstRun = thirsty ? prior.thirstRun + config.fixedDt : 0;
			stats.highHungerCreatureSeconds += hungry ? config.fixedDt : 0;
			stats.highThirstCreatureSeconds += thirsty ? config.fixedDt : 0;
			stats.lowEnergyCreatureSeconds += creature.energy <= 0.05 ? config.fixedDt : 0;
			if (
				creature.energy <= 0.05 &&
				creature.intention === 'rest' &&
				creature.action === 'move' &&
				creature.target?.kind === 'feature' &&
				creature.target.featureKind === 'home'
			)
				stats.exhaustedHomeTravelCreatureSeconds += config.fixedDt;
			stats.longestHighHungerSeconds = Math.max(stats.longestHighHungerSeconds, prior.hungerRun);
			stats.longestHighThirstSeconds = Math.max(stats.longestHighThirstSeconds, prior.thirstRun);
			if (creature.intention !== prior.intention) {
				increment(stats.intentionEntries, creature.intention);
				stats.intentionSwitches += 1;
				if (state.timeSeconds - prior.switchedAt <= 2) {
					stats.rapidIntentionSwitches += 1;
					increment(stats.rapidTransitionPairs, `${prior.intention} → ${creature.intention}`);
				}
				prior.switchedAt = state.timeSeconds;
				prior.intention = creature.intention;
			}
			if (sample) {
				increment(stats.actionSamples, creature.action);
				increment(stats.intentionSamples, creature.intention);
				const moved = Math.hypot(
					creature.position.x - prior.position.x,
					creature.position.y - prior.position.y
				);
				const moving = ['move', 'search', 'explore'].includes(creature.action);
				prior.stationaryRun = moving && moved < 0.02 ? prior.stationaryRun + 1 : 0;
				stats.maximumStationaryMovementSeconds = Math.max(
					stats.maximumStationaryMovementSeconds,
					prior.stationaryRun
				);
				prior.position = creature.position;
			}
		}
		stats.maximumApproachCarriers = Math.max(stats.maximumApproachCarriers, approachCarriers);
		if (sample) nextSample += 1;
	}
	stats.runtimeSeconds = rounded((performance.now() - started) / 1000);
	const livingMean = (field) =>
		state.creatures.length > 0
			? rounded(
					state.creatures.reduce((sum, creature) => sum + creature[field], 0) /
						state.creatures.length
				)
			: null;
	stats.final = {
		population: state.creatures.length,
		approachCarriers: state.creatures.filter((creature) => creature.lexicon.approach !== null)
			.length,
		generations: [...new Set(state.creatures.map((creature) => creature.lifecycle.generation))]
			.sort((a, b) => a - b)
			.map((generation) => {
				const members = state.creatures.filter(
					(creature) => creature.lifecycle.generation === generation
				);
				return {
					generation,
					population: members.length,
					meaningCarriers: Object.fromEntries(
						api.LEXICON_MEANINGS.map((meaning) => [
							meaning,
							members.filter((creature) => creature.lexicon[meaning] !== null).length
						])
					)
				};
			}),
		livingWildlife: state.wildlife.filter((w) => w.health > 0).length,
		carcasses: state.wildlife.filter((w) => w.health <= 0).length,
		foodSources: state.habitat.food.length,
		meanHunger: livingMean('hunger'),
		meanThirst: livingMean('thirst'),
		meanEnergy: livingMean('energy'),
		injuredCreatures: state.creatures.filter((c) => c.body.health < 0.99).length
	};
	if (trajectory) stats.trajectorySha256 = trajectory.digest('hex');
	for (const value of Object.values(stats.extremes)) {
		value.min = rounded(value.min);
		value.max = rounded(value.max);
	}
	for (const key of [
		'aliveCreatureSeconds',
		'highHungerCreatureSeconds',
		'highThirstCreatureSeconds',
		'lowEnergyCreatureSeconds',
		'exhaustedHomeTravelCreatureSeconds',
		'longestHighHungerSeconds',
		'longestHighThirstSeconds'
	])
		stats[key] = rounded(stats[key]);
	for (const key of Object.keys(stats.encounterAmounts))
		stats.encounterAmounts[key] = rounded(stats.encounterAmounts[key]);
	stats.highHungerAlivePercent =
		stats.aliveCreatureSeconds > 0
			? rounded((100 * stats.highHungerCreatureSeconds) / stats.aliveCreatureSeconds)
			: null;
	stats.highThirstAlivePercent =
		stats.aliveCreatureSeconds > 0
			? rounded((100 * stats.highThirstCreatureSeconds) / stats.aliveCreatureSeconds)
			: null;
	stats.lowEnergyAlivePercent =
		stats.aliveCreatureSeconds > 0
			? rounded((100 * stats.lowEnergyCreatureSeconds) / stats.aliveCreatureSeconds)
			: null;
	assert.equal(
		stats.final.population,
		stats.initialPopulation + stats.births - stats.deaths,
		'Population accounting differs'
	);
	return { stats, config };
}

function distribution(counts) {
	const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
	if (total === 0) return 'none';
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.map(([key, value]) => `${key}: ${value} (${((value / total) * 100).toFixed(1)}%)`)
		.join('; ');
}

function report(results, repeat, metadata) {
	const lines = [
		'# Overnight lifecycle and ecology observation',
		'',
		`Run on ${metadata.date} with \`node scripts/overnight-observation.mjs ${path.relative(root, reportPath).replaceAll('\\', '/')} ${duration} ${scenario}\`. Source HEAD: \`${metadata.head}\`; working-source SHA-256: \`${metadata.sourceFingerprint}\`.`,
		'',
		`Scenario preset: \`${scenario}\`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.`,
		'',
		'## Method',
		'',
		`Three fixed seeds, the ${scenario} creation preset and default fixed timestep, ${duration} simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.`,
		'',
		'Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.',
		'',
		'This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.',
		'',
		'## Results',
		'',
		'| Seed | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	];
	for (const row of results)
		lines.push(
			`| ${row.seed} | ${row.initialPopulation} / ${row.final.population} / ${row.populationMinimum}–${row.populationMaximum} | ${row.births} / ${row.deaths} | ${row.maximumGeneration} | ${row.aliveCreatureSeconds} | ${row.firstExtinctionAt ?? 'none'} |`
		);
	lines.push(
		'',
		'| Seed | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	);
	for (const row of results)
		lines.push(
			`| ${row.seed} | ${row.runtimeSeconds} | ${row.intentionEntries.hunt ?? 0} / ${row.intentionEntries.flee ?? 0} | ${row.encounters.creature_attack ?? 0} / ${row.encounters.wildlife_attack ?? 0} | ${row.encounters.consume_carcass ?? 0} / ${row.encounterAmounts.consume_carcass ?? 0} | ${row.final.livingWildlife} / ${row.final.carcasses} |`
		);
	lines.push(
		'',
		'| Seed | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	);
	for (const row of results)
		lines.push(
			`| ${row.seed} | ${fields.map((field) => `${row.extremes[field].min}–${row.extremes[field].max}`).join(' | ')} | ${row.maxMemoryEntries} / ${row.maxMemoryCapacity} |`
		);
	lines.push(
		'',
		'| Seed | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	);
	for (const row of results)
		lines.push(
			`| ${row.seed} | ${row.highHungerCreatureSeconds} / ${row.longestHighHungerSeconds} | ${row.highThirstCreatureSeconds} / ${row.longestHighThirstSeconds} | ${row.lowEnergyCreatureSeconds} | ${row.intentionSwitches} / ${row.rapidIntentionSwitches} | ${row.maximumStationaryMovementSeconds} |`
		);
	lines.push(
		'',
		'| Seed | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	);
	for (const row of results)
		lines.push(
			`| ${row.seed} | ${row.approachCalls} / ${row.learnedApproachCalls} | ${row.movementOutcomes.approach_evidence ?? 0} / ${row.movementOutcomes.approach_contradicted ?? 0} / ${row.movementOutcomes.approach_unobserved ?? 0} | ${row.final.approachCarriers} / ${row.maximumApproachCarriers} | ${row.maxMovementEncounters} / ${row.maxPendingMovementTraces} | ${row.movementBoundViolations} |`
		);
	lines.push(
		'',
		'| Seed | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes |',
		'| --- | ---: | ---: | ---: | --- |',
		...results.map(
			(row) =>
				`| ${row.seed} | ${row.followStarts} / ${rounded(row.followCreatureSeconds)} | ${rounded(row.maximumFollowDuration)}s / ${rounded(row.maximumFollowTravel)} | ${row.followBoundViolations} | ${
					Object.entries(row.followOutcomes)
						.map(([reason, count]) => reason + ': ' + count)
						.join('; ') || 'none'
				} |`
		),
		'',
		'Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.'
	);
	for (const row of results)
		lines.push(
			'',
			`### ${row.seed}`,
			'',
			`Death causes: ${distribution(row.deathCauses)}. Courtship failures: ${distribution(row.courtshipFailures)}. Saturated lifecycle-history steps: ${row.saturatedLifeEventSteps}.`,
			'',
			`Latest local source bindings: ${distribution(row.movementBindings)}. Saturated learning / emission history steps: ${row.saturatedLearningSteps} / ${row.saturatedEmissionSteps}. Final retained meaning carriers by generation: ${
				row.final.generations
					.map(
						(group) =>
							`generation ${group.generation}, alive ${group.population}, ${Object.entries(
								group.meaningCarriers
							)
								.map(([meaning, count]) => `${meaning} ${count}`)
								.join(', ')}`
					)
					.join('; ') || 'no survivors'
			}. These are personal assignments among survivors, not inherited meanings or a population dictionary.`,
			'',
			`High hunger / high thirst / exhaustion: ${row.highHungerAlivePercent ?? 'n/a'}% / ${row.highThirstAlivePercent ?? 'n/a'}% / ${row.lowEnergyAlivePercent ?? 'n/a'}% of alive creature-time.`,
			'',
			`Actions: ${distribution(row.actionSamples)}.`,
			'',
			`Innate expression starts: ${
				Object.entries(row.expressionStarts)
					.map(([kind, count]) => `${kind}: ${count}`)
					.join('; ') || 'none'
			}. Maximum retained relationships: ${row.maxRelationships}; current observed peers: ${row.maxObservedPeers}.`,
			'',
			`Intentions: ${distribution(row.intentionSamples)}.`,
			'',
			`Most frequent rapid transition pairs: ${Object.entries(row.rapidTransitionPairs)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([pair, count]) => `${pair}: ${count}`)
				.join('; ')}.`,
			'',
			`Final mean hunger/thirst/energy: ${row.final.meanHunger} / ${row.final.meanThirst} / ${row.final.meanEnergy}; injured creatures: ${row.final.injuredCreatures}/${row.final.population}; food sources: ${row.final.foodSources}. Exhausted travel home: ${row.exhaustedHomeTravelCreatureSeconds} creature-seconds. Memory bound violations: ${row.memoryBoundViolations}; saturated encounter-history steps: ${row.saturatedEncounterSteps}.`
		);

	lines.push(
		'',
		'## Determinism and interpretation',
		'',
		`Two independent ${repeat.seconds}-second runs in ${metadata.runtime} using the same source and seed \`${seeds[0]}\` produced identical complete-state trajectory SHA-256: \`${repeat.sha256}\`. Summary metrics also matched after excluding wall-clock runtime.`,
		'',
		'All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.',
		'',
		'Need-pressure ratios measure time alive, not survival success: death can lower total unmet-need time. Births, deaths, surviving population and generation reach must be read alongside those ratios. Same-runtime repeatability does not guarantee identical long trajectories across JavaScript engines; browser/Node floating-point differences were observed in the preceding social checkpoint.',
		'',
		'## Run configuration',
		'',
		'```json',
		JSON.stringify(metadata.config, null, 2),
		'```',
		''
	);
	return lines.join('\n');
}

const fingerprint = sourceFingerprint();
const server = await createServer({
	root,
	configFile: false,
	resolve: { alias: { $lib: path.join(root, 'src/lib') } },
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom'
});
try {
	const api = await server.ssrLoadModule('/src/lib/simulation/index.ts');
	assert.ok(
		api.SIMULATION_SCENARIOS.some((preset) => preset.id === scenario),
		`Unknown scenario '${scenario}'. Choose ${api.SIMULATION_SCENARIOS.map((preset) => preset.id).join(', ')}`
	);
	const runs = seeds.map((seed) => run(api, seed, duration));
	const repeatSeconds = Math.min(60, duration);
	const first = run(api, seeds[0], repeatSeconds, true).stats;
	const second = run(api, seeds[0], repeatSeconds, true).stats;
	assert.deepEqual(
		{ ...first, runtimeSeconds: 0 },
		{ ...second, runtimeSeconds: 0 },
		'Repeat trajectory and observations differ'
	);
	assert.equal(
		sourceFingerprint(),
		fingerprint,
		'Production source changed during observation; rerun against a stable snapshot'
	);
	const metadata = {
		date: new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Australia/Sydney',
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date()),
		head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
		sourceFingerprint: fingerprint,
		runtime: `Node ${process.version}`,
		scenario,
		config: runs[0].config
	};
	const reportText = report(
		runs.map((run) => run.stats),
		{ seconds: repeatSeconds, sha256: first.trajectorySha256 },
		metadata
	);
	fs.writeFileSync(
		reportPath,
		await format(reportText, { ...(await resolveConfig(reportPath)), filepath: reportPath })
	);
	console.log(
		JSON.stringify(
			{
				reportPath,
				scenario,
				runs: runs.map((run) => run.stats),
				repeatSha256: first.trajectorySha256
			},
			null,
			2
		)
	);
} finally {
	await server.close();
}
