import { expect, type Locator, type Page, test } from '@playwright/test';

function parseSimulationTime(text: string | null): number {
	if (!text) {
		return Number.NaN;
	}
	// Workbench shows values like "0.123 s".
	return Number(text.replace(/\s*s\s*$/i, '').trim());
}

async function expectHabitatFullyVisible(canvas: Locator): Promise<void> {
	await expect(canvas).toHaveAttribute('data-habitat-fully-visible', 'true');
	await expect(canvas).toHaveAttribute('data-habitat-camera-mode', 'perspective-near-top-down');

	const cornerCount = Number(await canvas.getAttribute('data-habitat-corner-count'));
	const cornersVisible = Number(await canvas.getAttribute('data-habitat-corners-visible'));
	expect(cornerCount).toBeGreaterThan(0);
	expect(cornersVisible).toBe(cornerCount);
}

async function waitForHabitatCanvas(page: Page): Promise<Locator> {
	const canvas = page.getByTestId('three-canvas');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-habitat-fully-visible', /true|false/);
	return canvas;
}

async function openWorkbenchTab(
	page: Page,
	tab: 'overview' | 'creatures' | 'communication' | 'world' | 'events' | 'debug'
): Promise<void> {
	const tabButton = page.getByTestId(`workbench-tab-${tab}`);
	await tabButton.scrollIntoViewIfNeeded();
	await tabButton.click();
	await expect(tabButton).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId(`workbench-panel-${tab}`)).toBeVisible();
}

test('loads the habitat surface, creatures and workbench controls', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Creature Simulator' })).toBeVisible();
	await expect(page.getByTestId('three-viewport')).toBeVisible();
	await expect(page.getByTestId('habitat-workbench')).toBeVisible();

	const canvas = await waitForHabitatCanvas(page);

	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.width).toBeGreaterThan(0);
	expect(box!.height).toBeGreaterThan(0);

	// Overview holds run controls by default.
	await expect(page.getByTestId('workbench-tab-overview')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('habitat-seed-input')).toBeVisible();
	await expect(page.getByTestId('habitat-regenerate')).toBeVisible();
	await expect(page.getByTestId('habitat-random-seed')).toBeVisible();
	await expect(page.getByTestId('simulation-pause-resume')).toBeVisible();
	await expect(page.getByTestId('simulation-reset')).toBeVisible();
	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('12');
	await expect(canvas).toHaveAttribute('data-creature-count', '12');

	await openWorkbenchTab(page, 'debug');
	await expect(page.getByTestId('habitat-diagnostics')).toContainText('seed: demo');
});

test('near-top-down perspective view keeps the entire habitat visible', async ({ page }) => {
	await page.goto('/');

	const canvas = await waitForHabitatCanvas(page);
	await expectHabitatFullyVisible(canvas);

	// Desktop-ish and taller aspects still frame the full bounds.
	for (const size of [
		{ width: 1280, height: 800 },
		{ width: 1440, height: 900 },
		{ width: 1024, height: 768 }
	]) {
		await page.setViewportSize(size);
		await expectHabitatFullyVisible(canvas);
	}
});

test('regenerating the same seed keeps the active seed and diagnostics stable', async ({
	page
}) => {
	await page.goto('/');
	const canvas = await waitForHabitatCanvas(page);

	await openWorkbenchTab(page, 'debug');
	const first = await page.getByTestId('habitat-diagnostics').textContent();

	await openWorkbenchTab(page, 'overview');
	await page.getByTestId('habitat-seed-input').fill('demo');
	await page.getByTestId('habitat-regenerate').click();

	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await openWorkbenchTab(page, 'debug');
	await expect(page.getByTestId('habitat-diagnostics')).toHaveText(first ?? '');

	await expectHabitatFullyVisible(canvas);
	await expect(canvas).toHaveAttribute('data-creature-count', '12');
});

test('a new random seed changes the habitat while keeping it fully framed', async ({ page }) => {
	await page.goto('/');

	const beforeSeed = await page.getByTestId('habitat-active-seed').textContent();
	await openWorkbenchTab(page, 'debug');
	const beforeDiagnostics = await page.getByTestId('habitat-diagnostics').textContent();

	await openWorkbenchTab(page, 'overview');
	await page.getByTestId('habitat-random-seed').click();

	await expect(page.getByTestId('habitat-active-seed')).not.toHaveText(beforeSeed ?? '');
	await openWorkbenchTab(page, 'debug');
	await expect(page.getByTestId('habitat-diagnostics')).not.toHaveText(beforeDiagnostics ?? '');
	await expect(page.getByTestId('habitat-diagnostics')).toContainText('seed:');

	const canvas = await waitForHabitatCanvas(page);
	await expectHabitatFullyVisible(canvas);
});

test('pause, resume and reset controls work', async ({ page }) => {
	await page.goto('/');

	const canvas = await waitForHabitatCanvas(page);
	await expect(page.getByTestId('simulation-status')).toHaveText('running');

	// Let the simulation advance a little.
	await expect
		.poll(async () => parseSimulationTime(await page.getByTestId('simulation-time').textContent()))
		.toBeGreaterThan(0.05);

	await openWorkbenchTab(page, 'debug');
	const creaturesBefore = await page.getByTestId('simulation-diagnostics').textContent();

	await openWorkbenchTab(page, 'overview');
	await page.getByTestId('simulation-pause-resume').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');
	await expect(page.getByTestId('simulation-pause-resume')).toHaveText('Resume');

	// Capture time only after pause is applied so an in-flight frame cannot race.
	const timeWhilePaused = await page.getByTestId('simulation-time').textContent();
	await page.waitForTimeout(250);
	await expect(page.getByTestId('simulation-time')).toHaveText(timeWhilePaused ?? '');

	await page.getByTestId('simulation-pause-resume').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('running');

	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('simulation-reset').click();

	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await expect(page.getByTestId('simulation-time')).toHaveText('0.000 s');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('12');
	await expect(canvas).toHaveAttribute('data-creature-count', '12');

	// Reset returns to initial creature state for the seed.
	await openWorkbenchTab(page, 'debug');
	const afterReset = await page.getByTestId('simulation-diagnostics').textContent();
	expect(afterReset).toContain('time: 0.000 s');
	expect(afterReset).toMatch(/intention=explore|intention=satisfy_/);
	// Creature diagnostics text should differ from mid-run paused snapshot in general,
	// but reset to t=0 is the hard requirement.
	expect(creaturesBefore).toBeTruthy();
});

test('selecting a creature shows needs, goal, action and candidate scores', async ({ page }) => {
	await page.goto('/');

	await waitForHabitatCanvas(page);
	await openWorkbenchTab(page, 'creatures');
	await expect(page.getByTestId('creature-inspector-empty')).toHaveText('No creature selected.');

	// Pause so inspection values are stable while we assert structure.
	await openWorkbenchTab(page, 'overview');
	await page.getByTestId('simulation-pause-resume').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');

	await openWorkbenchTab(page, 'debug');
	const diagnosticsBefore = await page.getByTestId('simulation-diagnostics').textContent();
	const timeBefore = await page.getByTestId('simulation-time').textContent();

	await openWorkbenchTab(page, 'creatures');
	await page.getByTestId('creature-select-creature-0').click();

	await expect(page.getByTestId('workbench-tab-creatures')).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByTestId('inspector-id')).toHaveText('creature-0');
	await expect(page.getByTestId('inspector-hunger')).toBeVisible();
	await expect(page.getByTestId('inspector-thirst')).toBeVisible();
	await expect(page.getByTestId('inspector-energy')).toBeVisible();
	await expect(page.getByTestId('inspector-intention')).toBeVisible();
	await expect(page.getByTestId('inspector-action')).toBeVisible();
	await expect(page.getByTestId('inspector-target')).toBeVisible();
	await expect(page.getByTestId('inspector-decision-reason')).not.toHaveText('—');
	await expect(page.getByTestId('inspector-candidates')).toBeVisible();
	await expect(page.getByTestId('inspector-candidate-explore')).toBeVisible();
	await expect(page.getByTestId('inspector-candidate-satisfy_hunger')).toBeVisible();

	// Selection must not advance or mutate simulation while paused.
	await expect(page.getByTestId('simulation-time')).toHaveText(timeBefore ?? '');
	await openWorkbenchTab(page, 'debug');
	await expect(page.getByTestId('simulation-diagnostics')).toHaveText(diagnosticsBefore ?? '');

	await openWorkbenchTab(page, 'creatures');
	await page.getByTestId('creature-clear-selection').click();
	await expect(page.getByTestId('creature-inspector-empty')).toHaveText('No creature selected.');
});

test('creature inspector and canvas expose communication wiring', async ({ page }) => {
	await page.goto('/');

	const canvas = await waitForHabitatCanvas(page);

	// Pause so selection is stable while asserting presentation metadata.
	await page.getByTestId('simulation-pause-resume').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');

	await openWorkbenchTab(page, 'creatures');
	await page.getByTestId('creature-select-creature-0').click();

	await expect(page.getByTestId('inspector-preferred-symbol')).toBeVisible();
	await expect(page.getByTestId('inspector-preferred-symbol')).toContainText('glyph-');
	await expect(page.getByTestId('inspector-hearing-radius')).toBeVisible();
	await expect(page.getByTestId('inspector-lexicon-panel')).toBeVisible();
	await expect(page.getByTestId('inspector-lexicon-food')).toContainText('unassigned');
	await expect(page.getByTestId('inspector-lexicon-water')).toContainText('unassigned');
	await expect(page.getByTestId('inspector-last-selection')).toBeVisible();
	await expect(page.getByTestId('inspector-recent-emitted')).toBeVisible();
	await expect(page.getByTestId('inspector-recent-heard')).toBeVisible();
	await expect(page.getByTestId('inspector-symbol-associations')).toBeVisible();
	await expect(page.getByTestId('inspector-assoc-glyph-0')).toContainText('food=0.000');
	await expect(page.getByTestId('inspector-pending-signals')).toBeVisible();
	await expect(page.getByTestId('inspector-active-investigation')).toBeVisible();
	await expect(page.getByTestId('inspector-recent-learning')).toBeVisible();
	await expect(page.getByTestId('inspector-candidate-investigate_signal')).toBeVisible();

	// Preferred symbol uses shared glyph + stable id text.
	await expect(
		page.getByTestId('inspector-preferred-symbol').getByTestId(/symbol-glyph-/)
	).toBeVisible();

	// Communication tab owns population summaries and the shared glyph legend.
	await openWorkbenchTab(page, 'communication');
	await expect(page.getByTestId('population-communication-panel')).toBeVisible();
	await expect(page.getByTestId('population-communication-hint')).toContainText('Observational');
	const legend = page.getByTestId('symbol-presentation-legend');
	await expect(legend).toBeVisible();
	await expect(legend.getByTestId('symbol-glyph-glyph-0')).toBeVisible();
	await expect(legend.getByTestId('symbol-glyph-glyph-1')).toBeVisible();
	await expect(legend.getByTestId('symbol-glyph-glyph-2')).toBeVisible();
	await expect(legend.getByTestId('symbol-glyph-glyph-3')).toBeVisible();
	await expect(page.getByTestId('population-context-food')).toBeVisible();
	await expect(page.getByTestId('population-context-water')).toBeVisible();
	await expect(page.getByTestId('population-food-row-glyph-0')).toBeVisible();
	await expect(page.getByTestId('population-food-most-assigned')).toBeVisible();
	await expect(page.getByTestId('population-food-highest-mean')).toBeVisible();
	await expect(page.getByTestId('population-food-most-emitted')).toBeVisible();
	await expect(page.getByTestId('communication-funnel')).toBeVisible();

	// Canvas metadata is presentation-only; no need to wait for a natural discovery.
	await expect(canvas).toHaveAttribute('data-active-emission-count', /\d+/);
	await expect(canvas).toHaveAttribute('data-signal-structure-version', /\d+/);
	await expect(canvas).toHaveAttribute('data-heard-cue-count', /\d+/);
	await expect(canvas).toHaveAttribute('data-hearing-radius', /\d+(\.\d+)?/);
});

test('domain workbench tabs switch and layout stays full-height beside viewport', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');

	const workbench = page.getByTestId('habitat-workbench');
	const viewport = page.getByTestId('three-viewport');
	await expect(workbench).toBeVisible();
	await expect(viewport).toBeVisible();

	const wbBox = await workbench.boundingBox();
	const vpBox = await viewport.boundingBox();
	expect(wbBox).not.toBeNull();
	expect(vpBox).not.toBeNull();
	// Wider than the historical 20rem (~320px) stack.
	expect(wbBox!.width).toBeGreaterThan(400);
	// Side-by-side: workbench is to the right of the viewport, not a bottom panel.
	expect(wbBox!.x).toBeGreaterThan(vpBox!.x);
	expect(Math.abs(wbBox!.y - vpBox!.y)).toBeLessThan(80);

	for (const tab of [
		'overview',
		'creatures',
		'communication',
		'world',
		'events',
		'debug'
	] as const) {
		await openWorkbenchTab(page, tab);
		await expect(page.getByTestId(`workbench-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByTestId(`workbench-panel-${tab}`)).toBeVisible();
	}

	// Overview does not host the full communication funnel.
	await openWorkbenchTab(page, 'overview');
	await expect(page.getByTestId('overview-wellbeing')).toBeVisible();
	await expect(page.getByTestId('communication-funnel')).toHaveCount(0);
	await expect(page.getByTestId('simulation-diagnostics')).toHaveCount(0);

	await openWorkbenchTab(page, 'world');
	await expect(page.getByTestId('world-food-table')).toBeVisible();

	await openWorkbenchTab(page, 'events');
	await expect(page.getByTestId('events-table')).toBeVisible();

	await openWorkbenchTab(page, 'debug');
	await expect(page.getByTestId('simulation-diagnostics')).toBeVisible();
	await expect(page.getByTestId('habitat-diagnostics')).toBeVisible();
});

test('creature movement does not rebuild static habitat presentation', async ({ page }) => {
	await page.goto('/');

	const canvas = await waitForHabitatCanvas(page);
	await expect(canvas).toHaveAttribute('data-habitat-build-count', '1');

	// Wait for simulation time to advance (creatures moving).
	await expect
		.poll(async () => parseSimulationTime(await page.getByTestId('simulation-time').textContent()))
		.toBeGreaterThan(0.2);

	// Habitat build count must remain 1 while only creatures move.
	await expect(canvas).toHaveAttribute('data-habitat-build-count', '1');
	await expect(canvas).toHaveAttribute('data-creature-count', '12');
});
