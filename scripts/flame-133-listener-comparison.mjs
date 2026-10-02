/**
 * Reproduce the matched FLAME-133 listener experiment without browser/server ports.
 * Usage: node scripts/flame-133-listener-comparison.mjs BASELINE_ROOT [OUTPUT_JSON]
 * BASELINE_ROOT must be an export/worktree of 542f6310947b0829c6aaa19829f50fb95c989653.
 * Only source is loaded from the baseline: the current checkout supplies Vite.
 * Export the pinned revision with git archive, then copy .svelte-kit/tsconfig.json
 * to the same path under that export (generated tooling configuration only).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const BASELINE_REVISION = '542f6310947b0829c6aaa19829f50fb95c989653';
const currentRoot = fileURLToPath(new URL('..', import.meta.url));
const baselineRoot = process.argv[2] && path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3] ?? 'flame-133-listener-comparison.json');
if (!baselineRoot)
	throw new Error('Supply an exported baseline source directory at revision 542f631');

function verifyBaseline() {
	const tree = execFileSync(
		'git',
		[
			'ls-tree',
			'-r',
			BASELINE_REVISION,
			'--',
			'src/lib/determinism',
			'src/lib/habitat',
			'src/lib/simulation'
		],
		{ cwd: currentRoot, encoding: 'utf8' }
	);
	let verifiedFiles = 0;
	for (const line of tree.trim().split('\n')) {
		const [entry, relativePath] = line.split('\t');
		const expectedHash = entry.split(' ')[2];
		const content = fs.readFileSync(path.join(baselineRoot, relativePath));
		const actualHash = createHash('sha1')
			.update(`blob ${content.length}\0`)
			.update(content)
			.digest('hex');
		assert.equal(
			actualHash,
			expectedHash,
			`Baseline file differs from pinned revision: ${relativePath}`
		);
		verifiedFiles += 1;
	}
	return {
		revision: BASELINE_REVISION,
		verifiedFiles,
		method:
			'Every baseline file in determinism, habitat and simulation is checked against its pinned Git blob hash before loading.'
	};
}
const baselineVerification = verifyBaseline();

const older = {
	rememberedAt: 0,
	emissionId: 'older-useful-signal',
	symbolId: 'glyph-1',
	origin: { x: -5, y: 0 }
};
const newer = {
	rememberedAt: 0,
	emissionId: 'newer-opposite-resource-signal',
	symbolId: 'glyph-2',
	origin: { x: 5, y: 0 }
};

async function loadSimulation(root) {
	const server = await createServer({
		root,
		configFile: false,
		resolve: { alias: { $lib: path.join(root, 'src/lib') } },
		server: { middlewareMode: true, hmr: false, ws: false },
		appType: 'custom'
	});
	return { server, api: await server.ssrLoadModule('/src/lib/simulation/index.ts') };
}

function makeFixture(api, resourceKind, variant, oppositeResourcePresent = true) {
	const config = api.defaultSimulationConfig('flame-133-matched-listener');
	Object.assign(config, {
		creatureCount: 1,
		foodSpawnIntervalSeconds: 100000,
		rainIntervalMinSeconds: 100000,
		rainIntervalMaxSeconds: 100000
	});
	const state = api.createSimulation(config);
	const useful = {
		id: `useful-${resourceKind}`,
		kind: resourceKind,
		position: { ...older.origin },
		size: { width: 0.4, height: 0.4 },
		amount: 10,
		capacity: 10
	};
	const oppositeKind = resourceKind === 'food' ? 'water' : 'food';
	const opposite = {
		...useful,
		id: `opposite-${oppositeKind}`,
		kind: oppositeKind,
		position: { ...newer.origin }
	};
	state.habitat = {
		...state.habitat,
		[resourceKind]: [useful],
		[oppositeKind]: oppositeResourcePresent ? [opposite] : []
	};
	const matching =
		resourceKind === 'food'
			? { food: 'glyph-1', water: 'glyph-2' }
			: { food: 'glyph-2', water: 'glyph-1' };
	const swapped = { food: matching.water, water: matching.food };
	const lexicon =
		variant === 'matching'
			? matching
			: variant === 'swapped'
				? swapped
				: { food: null, water: null };
	Object.assign(state.creatures[0], {
		position: { x: 0, y: 0 },
		facing: 0,
		movementSpeed: 2,
		hunger: resourceKind === 'food' ? 0.8 : 0.05,
		thirst: resourceKind === 'water' ? 0.8 : 0.05,
		energy: 0.99,
		curiosity: resourceKind === 'water' ? 0 : 0.5,
		verbosity: 0,
		intention: 'explore',
		action: 'explore',
		target: { kind: 'point', position: { x: 4, y: 0 } },
		memory: api.rememberHeardSignal(
			api.rememberHeardSignal(api.createEmptyMemory(16), older),
			newer
		),
		perception: api.emptyPerception(),
		nextReconsiderAt: 0,
		pendingArbitrationTrigger: 'new_heard_signal_memory',
		lexicon
	});
	return { config, state };
}

const rounded = (value) => (value === null ? null : Number(value.toFixed(6)));
function run(api, fixture) {
	const { config } = fixture;
	let state = structuredClone(fixture.state);
	const initial = state.creatures[0];
	let firstInvestigation = null;
	let usefulEvidenceTimeSeconds = null;
	let firstEatingTimeSeconds = null;
	let firstDrinkingTimeSeconds = null;
	const learning = new Map();
	const trajectoryHash = createHash('sha256');
	const needCheckpoints = [];
	const numberOfSteps = Math.round(20 / config.fixedDt);
	for (let step = 1; step <= numberOfSteps; step += 1) {
		state = api.stepSimulation(state, config);
		trajectoryHash.update(JSON.stringify(state));
		const creature = state.creatures[0];
		if (!firstInvestigation && creature.activeInvestigation) {
			firstInvestigation = structuredClone(creature.activeInvestigation);
		}
		if (
			usefulEvidenceTimeSeconds === null &&
			creature.memory.entries.some(
				(entry) => entry.kind === 'resource_observation' && entry.featureId.startsWith('useful-')
			)
		) {
			usefulEvidenceTimeSeconds = state.timeSeconds;
		}
		if (creature.action === 'eat' && firstEatingTimeSeconds === null) {
			firstEatingTimeSeconds = state.timeSeconds;
		}
		if (creature.action === 'drink' && firstDrinkingTimeSeconds === null) {
			firstDrinkingTimeSeconds = state.timeSeconds;
		}
		for (const event of creature.recentLearning) {
			learning.set(`${event.emissionId}:${event.timeSeconds}`, event);
		}
		if (step % Math.round(5 / config.fixedDt) === 0) {
			needCheckpoints.push({
				timeSeconds: rounded(state.timeSeconds),
				hunger: rounded(creature.hunger),
				thirst: rounded(creature.thirst)
			});
		}
	}
	const final = state.creatures[0];
	return {
		trajectorySha256: trajectoryHash.digest('hex'),
		firstInvestigation,
		usefulEvidenceTimeSeconds: rounded(usefulEvidenceTimeSeconds),
		firstEatingTimeSeconds: rounded(firstEatingTimeSeconds),
		firstDrinkingTimeSeconds: rounded(firstDrinkingTimeSeconds),
		needChanges: {
			hunger: rounded(final.hunger - initial.hunger),
			thirst: rounded(final.thirst - initial.thirst)
		},
		needCheckpoints,
		learningEvents: [...learning.values()],
		final: {
			timeSeconds: rounded(state.timeSeconds),
			position: final.position,
			hunger: rounded(final.hunger),
			thirst: rounded(final.thirst),
			energy: rounded(final.energy),
			intention: final.intention,
			action: final.action
		}
	};
}

const baseline = await loadSimulation(baselineRoot);
const current = await loadSimulation(currentRoot);
try {
	const scenarios = [];
	for (const oppositeResourcePresent of [true, false]) {
		for (const resourceKind of ['food', 'water']) {
			for (const variant of ['matching', 'swapped', 'cleared']) {
				const fixture = makeFixture(baseline.api, resourceKind, variant, oppositeResourcePresent);
				const baselineResult = run(baseline.api, fixture);
				const currentResult = run(current.api, fixture);
				assert.deepEqual(
					currentResult,
					run(current.api, fixture),
					'current run must be repeatable'
				);
				assert.ok(baselineResult.firstInvestigation);
				assert.ok(currentResult.firstInvestigation);
				assert.equal(baselineResult.firstInvestigation.emissionId, newer.emissionId);
				assert.equal(
					currentResult.firstInvestigation.emissionId,
					variant === 'matching' ? older.emissionId : newer.emissionId
				);
				if (variant === 'matching') {
					assert.notEqual(currentResult.usefulEvidenceTimeSeconds, null);
					assert.notEqual(baselineResult.usefulEvidenceTimeSeconds, null);
					assert.ok(
						currentResult.usefulEvidenceTimeSeconds < baselineResult.usefulEvidenceTimeSeconds
					);
					const consumption =
						resourceKind === 'food' ? 'firstEatingTimeSeconds' : 'firstDrinkingTimeSeconds';
					assert.notEqual(currentResult[consumption], null);
					assert.notEqual(baselineResult[consumption], null);
					assert.ok(currentResult[consumption] < baselineResult[consumption]);
				}
				scenarios.push({
					fixture: oppositeResourcePresent ? 'separated_food_water' : 'empty_newer_origin',
					resourceKind,
					variant,
					initialLexicon: fixture.state.creatures[0].lexicon,
					initialNeeds: {
						hunger: fixture.state.creatures[0].hunger,
						thirst: fixture.state.creatures[0].thirst,
						energy: fixture.state.creatures[0].energy
					},
					curiosity: fixture.state.creatures[0].curiosity,
					baseline: baselineResult,
					current: currentResult
				});
			}
		}
	}
	const evidence = {
		baselineVerification,
		method:
			'Primary fixtures have food and water at separated origins; supplementary fixtures leave the newer origin empty. Both versions receive the same cloned baseline-created state and config. Only listener lexicon changes across variants; hunger uses curiosity 0.5 and thirst uses 0. Actual stepSimulation is run for 20 simulated seconds. Current runs are repeated; summary equality and SHA-256 hashes of every full state in each trajectory must match. No browser is used.',
		usefulEvidenceDefinition:
			'First retained local resource_observation of the useful food/water feature. This is not necessarily symbol-association reinforcement: visible matching resources can interrupt the investigation before origin inspection.',
		interpretationLimit:
			'This measures earlier useful discovery and initial need recovery, not a permanent advantage. At 20 seconds the matching listener can have higher need pressure because it consumed earlier and pressure has had longer to rise. Inspect all checkpoints and final values, not only the 5-second snapshot.',
		initialConfig: makeFixture(baseline.api, 'food', 'matching').config,
		signals: [older, newer],
		scenarios
	};
	fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
	console.log(JSON.stringify({ outputPath, scenarios }, null, 2));
} finally {
	await baseline.server.close();
	await current.server.close();
}
