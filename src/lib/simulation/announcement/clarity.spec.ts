import { describe, expect, it } from 'vitest';
import { evaluateKindClarity, nearestKindDistance } from './clarity';

describe('evaluateKindClarity', () => {
	it('is clear when only the announced kind is in scope', () => {
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'food',
			candidates: [{ featureId: 'food-1', resourceKind: 'food', position: { x: 2, y: 0 } }],
			clarityMargin: 0.75
		});
		expect(result.clear).toBe(true);
		expect(result.reason).toBe('clear_no_opposite');
		expect(result.nearestAnnouncedKindDistance).toBeCloseTo(2);
		expect(result.nearestOppositeKindDistance).toBeNull();
	});

	it('ignores other same-kind features for competition', () => {
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'food',
			candidates: [
				{ featureId: 'food-1', resourceKind: 'food', position: { x: 3, y: 0 } },
				{ featureId: 'food-2', resourceKind: 'food', position: { x: 1, y: 0 } }
			],
			clarityMargin: 0.75
		});
		expect(result.clear).toBe(true);
		expect(result.nearestAnnouncedKindDistance).toBeCloseTo(1);
	});

	it('is unclear when opposite kind is within the margin', () => {
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'food',
			candidates: [
				{ featureId: 'food-1', resourceKind: 'food', position: { x: 1, y: 0 } },
				{ featureId: 'water-1', resourceKind: 'water', position: { x: 1.2, y: 0 } }
			],
			clarityMargin: 0.75
		});
		expect(result.clear).toBe(false);
		expect(result.reason).toBe('unclear_margin');
	});

	it('is clear when opposite is far enough beyond the margin', () => {
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'food',
			candidates: [
				{ featureId: 'food-1', resourceKind: 'food', position: { x: 1, y: 0 } },
				{ featureId: 'water-1', resourceKind: 'water', position: { x: 3, y: 0 } }
			],
			clarityMargin: 0.75
		});
		expect(result.clear).toBe(true);
		expect(result.reason).toBe('clear_margin');
	});

	it('treats ties as unclear', () => {
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'water',
			candidates: [
				{ featureId: 'water-1', resourceKind: 'water', position: { x: 2, y: 0 } },
				{ featureId: 'food-1', resourceKind: 'food', position: { x: 2, y: 0 } }
			],
			clarityMargin: 0.5
		});
		expect(result.clear).toBe(false);
		expect(result.reason).toBe('unclear_opposite_nearer_or_tie');
	});

	it('rejects non-finite positions safely', () => {
		const dist = nearestKindDistance(
			{ x: Number.NaN, y: 0 },
			[{ featureId: 'f', resourceKind: 'food', position: { x: 1, y: 0 } }],
			'food'
		);
		expect(dist).toBeNull();
		const result = evaluateKindClarity({
			position: { x: 0, y: 0 },
			announcedKind: 'food',
			candidates: [],
			clarityMargin: 0.5
		});
		expect(result.clear).toBe(false);
		expect(result.reason).toBe('no_announced_kind_in_scope');
	});
});
