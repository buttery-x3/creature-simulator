import { expect, test } from '@playwright/test';

test('inspects founder lifecycle and advances its authoritative age while paused', async ({
	page
}) => {
	await page.goto('/');
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('workbench-tab-creatures').click();
	await page.getByTestId('creature-select-creature-0').click();
	await expect(page.getByTestId('inspector-age')).toContainText('adult');
	await expect(page.getByTestId('inspector-genealogy')).toContainText('founder');
	await expect(page.getByTestId('creature-lifecycle')).toContainText('observer only');
	const ageBefore = Number((await page.getByTestId('inspector-age').innerText()).split('s')[0]);
	await page.getByTestId('workbench-tab-overview').click();
	// Advance enough fixed steps to cross the inspector's 0.1-second display precision.
	for (let i = 0; i < 6; i++) await page.getByTestId('simulation-step').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('paused');
	await expect(page.getByTestId('overview-lifecycle')).toContainText(
		'counts are not all-time totals'
	);
	await page.getByTestId('workbench-tab-creatures').click();
	await expect
		.poll(async () => Number((await page.getByTestId('inspector-age').innerText()).split('s')[0]))
		.toBeGreaterThan(ageBefore);
});
