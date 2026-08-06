import { expect, type Locator, type Page, test } from '@playwright/test';

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

test('loads the habitat surface and workbench controls', async ({ page }) => {
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
	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
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

	const diagnostics = page.getByTestId('habitat-diagnostics');
	const first = await diagnostics.textContent();

	await page.getByTestId('habitat-seed-input').fill('demo');
	await page.getByTestId('habitat-regenerate').click();

	await expect(page.getByTestId('habitat-active-seed')).toHaveText('demo');
	await expect(diagnostics).toHaveText(first ?? '');

	const canvas = await waitForHabitatCanvas(page);
	await expectHabitatFullyVisible(canvas);
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
