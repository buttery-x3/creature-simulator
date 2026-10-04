/**
 * Reproducible headless ecology observation; opens no server port.
 * Usage: node scripts/overnight-observation.mjs [REPORT_PATH] [SIMULATED_SECONDS]
 * Default: three fixed seeds, 600 seconds each, normal fixedDt; 60-second determinism repeat.
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
assert.ok(Number.isFinite(duration) && duration > 0, 'Duration must be positive and finite');
const seeds = ['demo', 'overnight-river', 'overnight-drought'];
// Historical 600-second acute-need measurements, retained in checkpoint 6d02f21.
// Values are observational comparisons, never pass/fail thresholds or tuning targets.
const previousBaseline = {
	demo: { hunger: 2837.8333, thirst: 555.4667, exhaustion: 293.6333 },
	'overnight-river': { hunger: 4033.9, thirst: 4216.5333, exhaustion: 1839 },
	'overnight-drought': { hunger: 3188.9, thirst: 1300.1, exhaustion: 440.3333 }
};
const fields = ['hunger', 'thirst', 'energy', 'health'];
const rounded = (value) => Number(value.toFixed(4));
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
	const config = api.defaultSimulationConfig(seed);
	let state = api.createSimulation(config);
	const stats = {
		seed,
		simulatedSeconds: seconds,
		fixedDt: config.fixedDt,
		steps: Math.round(seconds / config.fixedDt),
		runtimeSeconds: 0,
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
		const sample = state.timeSeconds + 1e-8 >= nextSample;
		for (const creature of state.creatures) {
			const prior = previous.get(creature.id);
			assert.ok(prior, 'This physical-slice harness expects the initial fixed population');
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
		if (sample) nextSample += 1;
	}
	stats.runtimeSeconds = rounded((performance.now() - started) / 1000);
	stats.final = {
		population: state.creatures.length,
		livingWildlife: state.wildlife.filter((w) => w.health > 0).length,
		carcasses: state.wildlife.filter((w) => w.health <= 0).length,
		foodSources: state.habitat.food.length,
		meanHunger: rounded(
			state.creatures.reduce((sum, c) => sum + c.hunger, 0) / state.creatures.length
		),
		meanThirst: rounded(
			state.creatures.reduce((sum, c) => sum + c.thirst, 0) / state.creatures.length
		),
		meanEnergy: rounded(
			state.creatures.reduce((sum, c) => sum + c.energy, 0) / state.creatures.length
		),
		injuredCreatures: state.creatures.filter((c) => c.body.health < 0.99).length
	};
	if (trajectory) stats.trajectorySha256 = trajectory.digest('hex');
	for (const value of Object.values(stats.extremes)) {
		value.min = rounded(value.min);
		value.max = rounded(value.max);
	}
	for (const key of [
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
	return { stats, config };
}

function distribution(counts) {
	const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.map(([key, value]) => `${key}: ${value} (${((value / total) * 100).toFixed(1)}%)`)
		.join('; ');
}

function report(results, repeat, metadata) {
	const lines = [
		'# Overnight physical ecology observation',
		'',
		`Run on ${metadata.date} with \`node scripts/overnight-observation.mjs\`. Source HEAD: \`${metadata.head}\`; working-source SHA-256: \`${metadata.sourceFingerprint}\`.`,
		'',
		'## Method',
		'',
		`Three fixed seeds, default configuration and fixed timestep, ${duration} simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.`,
		'',
		'Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.',
		'',
		'This run covers the current physical ecology and danger-behaviour slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.',
		'',
		'## Results',
		'',
		'| Seed | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |',
		'| --- | ---: | ---: | ---: | ---: | ---: |'
	];
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
	for (const row of results)
		lines.push(
			'',
			`### ${row.seed}`,
			'',
			`Actions: ${distribution(row.actionSamples)}.`,
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
	if (duration === 600) {
		lines.push(
			'',
			'## Comparison with the acute-needs checkpoint',
			'',
			'The same seeds, duration and defaults were measured at checkpoint `6d02f21` (fingerprint `5e14deb60a18ded70dc723bedfed66053de6c56a6edc5f089f2e1a44be938acd`). This compares complete evolving trajectories; changes in one decision policy can alter later encounters and evidence. No improvement is assumed.',
			'',
			'| Seed | Hunger ≥.95 creature-s before → now | Thirst ≥.95 creature-s before → now | Energy ≤.05 creature-s before → now |',
			'| --- | ---: | ---: | ---: |'
		);
		for (const row of results) {
			const old = previousBaseline[row.seed];
			lines.push(
				`| ${row.seed} | ${old.hunger} → ${row.highHungerCreatureSeconds} | ${old.thirst} → ${row.highThirstCreatureSeconds} | ${old.exhaustion} → ${row.lowEnergyCreatureSeconds} |`
			);
		}
	}
	lines.push(
		'',
		'## Determinism and interpretation',
		'',
		`Two independent ${repeat.seconds}-second runs of seed \`${seeds[0]}\` produced identical complete-state trajectory SHA-256: \`${repeat.sha256}\`. Summary metrics also matched after excluding wall-clock runtime.`,
		'',
		'All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.',
		'',
		`Hunger pressure remains high for ${Math.min(...results.map((row) => (row.highHungerCreatureSeconds / (row.final.population * duration)) * 100)).toFixed(1)}–${Math.max(...results.map((row) => (row.highHungerCreatureSeconds / (row.final.population * duration)) * 100)).toFixed(1)}% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.`,
		'',
		'## Reproduction configuration',
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
	const runs = seeds.map((seed) => run(api, seed, duration));
	const repeatSeconds = Math.min(60, duration);
	const first = run(api, seeds[0], repeatSeconds, true).stats;
	const second = run(api, seeds[0], repeatSeconds, true).stats;
	assert.deepEqual(
		{ ...first, runtimeSeconds: 0 },
		{ ...second, runtimeSeconds: 0 },
		'Repeat trajectory and observations differ'
	);
	const metadata = {
		date: new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Australia/Sydney',
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date()),
		head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
		sourceFingerprint: fingerprint,
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
			{ reportPath, runs: runs.map((run) => run.stats), repeatSha256: first.trajectorySha256 },
			null,
			2
		)
	);
} finally {
	await server.close();
}
