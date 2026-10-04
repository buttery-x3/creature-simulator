import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function downloadCapture(page: Page) {
	const pending = page.waitForEvent('download');
	await page.getByTestId('debug-download-capture').click();
	const download = await pending;
	const path = await download.path();
	expect(path).not.toBeNull();
	return { json: await readFile(path!, 'utf8'), filename: download.suggestedFilename() };
}

test('captures exact active run once, downloads it unchanged after live advance and regeneration, and opens raw state on demand', async ({
	page
}) => {
	await page.goto('/');
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('simulation-scenario').selectOption('resource-rich');
	await page.getByTestId('habitat-seed-input').fill('capture-source');
	await page.getByTestId('habitat-regenerate').click();
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('workbench-tab-debug').click();
	await expect(page.getByTestId('simulation-status')).toHaveText('running');
	await expect(page.getByTestId('debug-simulation-snapshot')).toHaveCount(0);
	await page.getByTestId('debug-capture-run').click();
	const first = await downloadCapture(page);
	const bundle = JSON.parse(first.json);
	expect(bundle.format).toBe('creature-simulator-debug');
	expect(bundle.version).toBe(1);
	expect(bundle.config.seed).toBe('capture-source');
	expect(bundle.state.seed).toBe('capture-source');
	expect(bundle.config.foodSpawnIntervalSeconds).toBe(8);
	expect(bundle.config.ecology.wildlifeCount).toBe(2);
	expect(bundle.runtime).toEqual({
		kind: 'browser',
		userAgent: await page.evaluate(() => navigator.userAgent)
	});
	expect(Number.isNaN(Date.parse(bundle.capturedAt))).toBe(false);
	await expect
		.poll(async () =>
			Number((await page.getByTestId('simulation-time').innerText()).replace(' s', ''))
		)
		.toBeGreaterThan(bundle.state.timeSeconds + 0.5);
	expect((await downloadCapture(page)).json).toBe(first.json);
	await page.getByTestId('debug-capture-preview').locator('summary').click();
	await expect(page.getByTestId('debug-captured-json')).toHaveText(first.json);
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('simulation-scenario').selectOption('crowded');
	await page.getByTestId('habitat-seed-input').fill('capture-new-run');
	await page.getByTestId('habitat-regenerate').click();
	await page.getByTestId('workbench-tab-debug').click();
	await expect(page.getByTestId('debug-capture-summary')).toContainText('capture-source');
	await expect(page.getByTestId('debug-capture-summary')).toContainText(
		't=' + bundle.state.timeSeconds.toFixed(3) + 's'
	);
	expect((await downloadCapture(page)).json).toBe(first.json);
	expect(first.filename).toContain('capture-source');
	await expect(page.getByTestId('debug-simulation-snapshot')).toHaveCount(0);
	await page.getByTestId('debug-live-snapshot').locator('summary').click();
	const live = JSON.parse((await page.getByTestId('debug-simulation-snapshot').textContent())!);
	expect(live.seed).toBe('capture-new-run');
	expect(live.creatures).toHaveLength(32);
	expect(live.timeSeconds).toBe(0);
	await page.getByTestId('debug-live-snapshot').locator('summary').click();
	await expect(page.getByTestId('debug-simulation-snapshot')).toHaveCount(0);
	await page.getByTestId('debug-capture-run').click();
	const replacement = JSON.parse((await downloadCapture(page)).json);
	expect(replacement.state).toEqual(live);
	expect(replacement.config.creatureCount).toBe(32);
	expect(replacement.config.seed).toBe('capture-new-run');
});
