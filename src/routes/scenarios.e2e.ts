import { expect, test, type Page } from '@playwright/test';

async function openDebug(page: Page) {
	await page.getByTestId('workbench-tab-debug').click();
	return {
		config: JSON.parse((await page.getByTestId('debug-config-json').textContent())!),
		environment: JSON.parse((await page.getByTestId('debug-environment-json').textContent())!)
	};
}

test('stages scenario changes, applies32 founders and preserves an active run on invalid regeneration', async ({
	page
}) => {
	await page.goto('/');
	await page.getByTestId('simulation-pause-resume').click();
	const selector = page.getByTestId('simulation-scenario');
	const active = page.getByTestId('simulation-active-scenario');
	await selector.selectOption('crowded');
	await expect(active).toHaveAttribute('data-scenario-id', 'baseline');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('12');
	await page.getByTestId('habitat-regenerate').click();
	await expect(active).toHaveAttribute('data-scenario-id', 'crowded');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('32');
	await expect(page.getByTestId('three-canvas')).toHaveAttribute('data-creature-count', '32');
	await selector.selectOption('baseline');
	await page.getByTestId('habitat-seed-input').fill('   ');
	await page.getByTestId('habitat-regenerate').click();
	await expect(page.getByTestId('habitat-error')).toContainText('non-empty');
	await expect(active).toHaveAttribute('data-scenario-id', 'crowded');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('32');
	await page.getByTestId('simulation-reset').click();
	await expect(selector).toHaveValue('crowded');
	await expect(page.getByTestId('habitat-seed-input')).toHaveValue('demo');
	await expect(page.getByTestId('habitat-error')).toHaveCount(0);
	await selector.selectOption('baseline');
	await page.getByTestId('habitat-regenerate').click();
	await expect(active).toHaveAttribute('data-scenario-id', 'baseline');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('12');
});

test('uses active rich resource cadence in animation and single steps, and resets active seed/scenario', async ({
	page
}) => {
	await page.goto('/');
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('simulation-scenario').selectOption('resource-rich');
	await page.getByTestId('habitat-regenerate').click();
	let diagnostics = await openDebug(page);
	expect(diagnostics.config.foodSpawnIntervalSeconds).toBe(8);
	expect(diagnostics.config.habitat.foodCount).toBe(8);
	expect(diagnostics.config.ecology.wildlifeCount).toBe(2);
	expect(diagnostics.environment.nextFoodSpawnAt).toBe(8);
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-speed').selectOption('8');
	await page.getByTestId('simulation-pause-resume').click();
	await expect
		.poll(
			async () => Number((await page.getByTestId('simulation-time').innerText()).replace(' s', '')),
			{ timeout: 15000, intervals: [50] }
		)
		.toBeGreaterThan(8.2);
	await page.getByTestId('simulation-pause-resume').click();
	diagnostics = await openDebug(page);
	expect(diagnostics.environment.foodSpawnEventIndex).toBe(1);
	expect(diagnostics.environment.nextFoodSpawnAt).toBeGreaterThanOrEqual(16);
	expect(diagnostics.environment.nextFoodSpawnAt).toBeLessThan(16.1);
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-scenario').selectOption('baseline');
	await page.getByTestId('habitat-seed-input').fill('discarded-draft');
	await page.getByTestId('simulation-reset').click();
	await expect(page.getByTestId('simulation-scenario')).toHaveValue('resource-rich');
	await expect(page.getByTestId('habitat-seed-input')).toHaveValue('demo');
	await expect(page.getByTestId('simulation-active-scenario')).toHaveAttribute(
		'data-scenario-id',
		'resource-rich'
	);
	await page.getByTestId('simulation-step').evaluate((button: HTMLButtonElement) => {
		for (let i = 0; i < 270; i++) button.click();
	});
	diagnostics = await openDebug(page);
	expect(diagnostics.environment.foodSpawnEventIndex).toBe(1);
	expect(diagnostics.environment.nextFoodSpawnAt).toBeGreaterThanOrEqual(16);
	expect(diagnostics.environment.nextFoodSpawnAt).toBeLessThan(16.1);
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-scenario').selectOption('crowded');
	await page.getByTestId('habitat-random-seed').click();
	await expect(page.getByTestId('simulation-active-scenario')).toHaveAttribute(
		'data-scenario-id',
		'crowded'
	);
	await expect(page.getByTestId('habitat-active-seed')).not.toHaveText('demo');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('32');
});

test('frames the larger single-home habitat and runs its active configuration', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	await page.getByTestId('simulation-pause-resume').click();
	await page.getByTestId('simulation-scenario').selectOption('larger-world');
	await page.getByTestId('habitat-regenerate').click();
	await expect(page.getByTestId('simulation-active-scenario')).toHaveAttribute(
		'data-scenario-id',
		'larger-world'
	);
	const canvas = page.getByTestId('three-canvas');
	await expect(canvas).toHaveAttribute('data-creature-count', '48');
	await expect(canvas).toHaveAttribute('data-habitat-fully-visible', 'true');
	const diagnostics = await openDebug(page);
	expect(diagnostics.config.habitat).toMatchObject({
		worldWidth: 40,
		worldHeight: 28,
		foodCount: 32,
		waterCount: 8
	});
	expect(diagnostics.config.lifecycle.populationCap).toBe(128);
	expect(diagnostics.config.memoryCapacityRange).toEqual({ min: 8, max: 16 });
	expect(diagnostics.config.sensingRadius).toBe(3);
	expect(diagnostics.config.hearingRadius).toBe(12);
	expect(diagnostics.environment.nextFoodSpawnAt).toBe(2);
	await page.getByTestId('debug-live-snapshot').locator('summary').click();
	const initial = JSON.parse((await page.getByTestId('debug-simulation-snapshot').textContent())!);
	expect(initial.habitat.bounds).toEqual({ width: 40, height: 28 });
	expect(initial.habitat.water).toHaveLength(8);
	expect(initial.wildlife).toHaveLength(8);
	expect(initial.creatures[0].exploration.map).toMatchObject({
		cellSize: 2,
		columns: 20,
		rows: 14
	});
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-step').evaluate((button: HTMLButtonElement) => {
		for (let i = 0; i < 75; i++) button.click();
	});
	const advanced = await openDebug(page);
	expect(advanced.environment.foodSpawnEventIndex).toBe(1);
	expect(advanced.environment.nextFoodSpawnAt).toBeCloseTo(4, 1);
	await page.getByTestId('workbench-tab-overview').click();
	await page.getByTestId('simulation-scenario').selectOption('baseline');
	await page.getByTestId('simulation-reset').click();
	await expect(page.getByTestId('simulation-scenario')).toHaveValue('larger-world');
	await expect(page.getByTestId('simulation-creature-count')).toHaveText('48');
	await expect(canvas).toHaveAttribute('data-habitat-fully-visible', 'true');
	expect(errors).toEqual([]);
});
