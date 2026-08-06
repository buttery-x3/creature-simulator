import { expect, test } from '@playwright/test';

test('loads the app and exposes the Three.js rendering surface', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Creature Simulator' })).toBeVisible();
	await expect(page.getByTestId('three-viewport')).toBeVisible();

	const canvas = page.getByTestId('three-canvas');
	await expect(canvas).toBeVisible();

	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.width).toBeGreaterThan(0);
	expect(box!.height).toBeGreaterThan(0);
});
