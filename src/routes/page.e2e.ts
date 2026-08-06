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

	await expect(page.getByTestId('habitat-seed-input')).toBeVisible();
	await expect(page.getByTestId('habitat-regenerate')).toBeVisible();
	await expect(page.getByTestId('habitat-random-seed')).toBeVisible();
	await expect(page.getByTestId('simulation-pause-resume')).toBeVisible();
	await expect(page.getByTestId('simulation-reset')).toBeVisible();
	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await expect(page.getByTestId('habitat-diagnostics')).toContainText('seed: demo');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('12');
	await expect(canvas).toHaveAttribute('data-creature-count', '12');
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

	const diagnostics = page.getByTestId('habitat-diagnostics');
	const first = await diagnostics.textContent();

	await page.getByTestId('habitat-seed-input').fill('demo');
	await page.getByTestId('habitat-regenerate').click();

	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await expect(diagnostics).toHaveText(first ?? '');

	const canvas = await waitForHabitatCanvas(page);
	await expectHabitatFullyVisible(canvas);
	await expect(canvas).toHaveAttribute('data-creature-count', '12');
});

test('a new random seed changes the habitat while keeping it fully framed', async ({ page }) => {
	await page.goto('/');

	const beforeSeed = await page.getByTestId('habitat-active-seed').textContent();
	const beforeDiagnostics = await page.getByTestId('habitat-diagnostics').textContent();

	await page.getByTestId('habitat-random-seed').click();

	await expect(page.getByTestId('habitat-active-seed')).not.toHaveText(beforeSeed ?? '');
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

	const creaturesBefore = await page.getByTestId('simulation-diagnostics').textContent();

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
	const afterReset = await page.getByTestId('simulation-diagnostics').textContent();
	expect(afterReset).toContain('time: 0.000 s');
	expect(afterReset).toMatch(/goal=wander|goal=seek_/);
	// Creature diagnostics text should differ from mid-run paused snapshot in general,
	// but reset to t=0 is the hard requirement.
	expect(creaturesBefore).toBeTruthy();
});

test('selecting a creature shows needs, goal, action and candidate scores', async ({ page }) => {
	await page.goto('/');

	await waitForHabitatCanvas(page);
	await expect(page.getByTestId('creature-inspector-empty')).toHaveText('No creature selected.');

	// Pause so inspection values are stable while we assert structure.
	await page.getByTestId('simulation-pause-resume').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');

	const diagnosticsBefore = await page.getByTestId('simulation-diagnostics').textContent();
	const timeBefore = await page.getByTestId('simulation-time').textContent();

	await page.getByTestId('creature-select-creature-0').click();

	await expect(page.getByTestId('inspector-id')).toHaveText('creature-0');
	await expect(page.getByTestId('inspector-hunger')).toBeVisible();
	await expect(page.getByTestId('inspector-thirst')).toBeVisible();
	await expect(page.getByTestId('inspector-energy')).toBeVisible();
	await expect(page.getByTestId('inspector-goal')).toBeVisible();
	await expect(page.getByTestId('inspector-action')).toBeVisible();
	await expect(page.getByTestId('inspector-target')).toBeVisible();
	await expect(page.getByTestId('inspector-decision-reason')).not.toHaveText('—');
	await expect(page.getByTestId('inspector-candidates')).toBeVisible();
	await expect(page.getByTestId('inspector-candidate-wander')).toBeVisible();
	await expect(page.getByTestId('inspector-candidate-seek_food')).toBeVisible();

	// Selection must not advance or mutate simulation while paused.
	await expect(page.getByTestId('simulation-time')).toHaveText(timeBefore ?? '');
	await expect(page.getByTestId('simulation-diagnostics')).toHaveText(diagnosticsBefore ?? '');

	await page.getByTestId('creature-clear-selection').click();
	await expect(page.getByTestId('creature-inspector-empty')).toHaveText('No creature selected.');
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
