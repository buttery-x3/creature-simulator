import { describe, expect, it } from 'vitest';
import { createExplorationState } from './create-exploration';
import { buildExplorationDiagnostics, formatExplorationDiagnostics } from './diagnostics';

const BOUNDS = { width: 20, height: 14 };
const CONFIG = {
	explorationDistanceWeight: 1,
	explorationStalenessWeight: 1,
	explorationStalenessScaleSeconds: 30
};

describe('exploration diagnostics', () => {
	it('renders absence for target fields when no active cell', () => {
		const exploration = createExplorationState(BOUNDS, 2);
		const view = buildExplorationDiagnostics(exploration, BOUNDS, { x: 0, y: 0 }, 10, CONFIG);
		expect(view.activeCellIndex).toBeNull();
		expect(view.targetCentre).toBeNull();
		expect(view.finalScore).toBeNull();
		expect(view.exploredCount).toBe(0);
		expect(view.totalCells).toBe(70);

		const lines = formatExplorationDiagnostics(view);
		expect(lines.some((l) => l.includes('(none)'))).toBe(true);
		expect(lines.some((l) => l.includes('N/A'))).toBe(true);
	});

	it('exposes score factors when active cell is set', () => {
		const exploration = createExplorationState(BOUNDS, 2);
		exploration.activeCellIndex = 0;
		const view = buildExplorationDiagnostics(exploration, BOUNDS, { x: 0, y: 0 }, 0, CONFIG);
		expect(view.activeCellIndex).toBe(0);
		expect(view.targetCentre).not.toBeNull();
		expect(view.finalScore).not.toBeNull();
		expect(view.distanceFactor).not.toBeNull();
	});
});
