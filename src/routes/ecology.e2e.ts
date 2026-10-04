import { expect, test } from '@playwright/test';

test('pauses, single steps, changes speed and exposes physical ecology', async ({ page }) => {
	await page.goto('/');
	const canvas = page.getByTestId('three-canvas');
	await expect(canvas).toHaveAttribute('data-wildlife-count', /^[1-9][0-9]*$/);
	await expect(page.getByTestId('simulation-step')).toBeDisabled();
	await page.getByTestId('simulation-pause-resume').click();
	const before = Number((await page.getByTestId('simulation-time').innerText()).replace(' s', ''));
	await page.getByTestId('simulation-step').click();
	await expect
		.poll(async () =>
			Number((await page.getByTestId('simulation-time').innerText()).replace(' s', ''))
		)
		.toBeGreaterThan(before);
	const after = await page.getByTestId('simulation-time').innerText();
	await page.getByTestId('simulation-speed').selectOption('4');
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');
	await expect(page.getByTestId('simulation-time')).toHaveText(after);
	await page.getByTestId('workbench-tab-world').click();
	await expect(page.getByTestId('world-wildlife-table')).toBeVisible();
	await expect(page.getByTestId('world-daylight')).toContainText('%');
	await page.getByTestId('workbench-tab-creatures').click();
	await page.getByTestId('creature-select-creature-0').click();
	await expect(page.getByTestId('inspector-health')).toContainText('%');
	await expect(page.getByTestId('inspector-physicality')).toBeVisible();
	await expect(page.getByTestId('three-canvas')).toHaveAttribute(
		'data-selected-creature-id',
		'creature-0'
	);
});
