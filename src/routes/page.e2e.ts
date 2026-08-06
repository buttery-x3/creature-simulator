import { expect, test } from '@playwright/test';

test('loads the habitat surface and workbench controls', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Creature Simulator' })).toBeVisible();
	await expect(page.getByTestId('three-viewport')).toBeVisible();
	await expect(page.getByTestId('habitat-workbench')).toBeVisible();

	const canvas = page.getByTestId('three-canvas');
	await expect(canvas).toBeVisible();

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
});

test('a new random seed changes the active seed and diagnostics', async ({ page }) => {
	await page.goto('/');

	const beforeSeed = await page.getByTestId('habitat-active-seed').textContent();
	const beforeDiagnostics = await page.getByTestId('habitat-diagnostics').textContent();

	await page.getByTestId('habitat-random-seed').click();

	await expect(page.getByTestId('habitat-active-seed')).not.toHaveText(beforeSeed ?? '');
	await expect(page.getByTestId('habitat-diagnostics')).not.toHaveText(beforeDiagnostics ?? '');
	await expect(page.getByTestId('habitat-diagnostics')).toContainText('seed:');
});
