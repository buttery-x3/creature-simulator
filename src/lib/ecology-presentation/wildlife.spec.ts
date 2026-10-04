import { describe, expect, it, vi } from 'vitest';
import type { Wildlife } from '$lib/simulation';
import { createWildlifePresentation, daylightAppearance } from './wildlife';

function animal(overrides: Partial<Wildlife> = {}): Wildlife {
	return {
		id: 'wildlife-1',
		position: { x: 2, y: 3 },
		facing: 0.5,
		size: 1.3,
		physicality: 1,
		health: 1,
		energy: 0.8,
		nextAttackAt: 0,
		foodAmount: 0,
		patrolPhase: 0,
		mode: 'roam',
		...overrides
	};
}

describe('wildlife presentation', () => {
	it('preserves meshes across live movement and carcass transition, and disposes removed materials', () => {
		const presentation = createWildlifePresentation();
		const original = animal();
		presentation.update([original]);
		const mesh = presentation.byId.get(original.id)!;
		const dispose = vi.spyOn(mesh.material, 'dispose');
		presentation.update([
			animal({ position: { x: 4, y: 5 }, health: 0, foodAmount: 2, mode: 'carcass' })
		]);
		expect(presentation.byId.get(original.id)).toBe(mesh);
		expect(mesh.position.x).toBe(4);
		expect(mesh.userData.carcass).toBe(true);
		expect(mesh.scale.z).toBeLessThan(mesh.scale.y);
		expect(mesh.visible).toBe(true);
		expect(original.health).toBe(1);
		presentation.update([]);
		expect(dispose).toHaveBeenCalledOnce();
		expect(presentation.root.children).toHaveLength(0);
		presentation.dispose();
	});
	it('keeps night legible with smooth bounded exposure and colors', () => {
		const night = daylightAppearance(0);
		const dusk = daylightAppearance(0.5);
		const day = daylightAppearance(1);
		expect(night.exposure).toBeGreaterThan(0.3);
		expect(dusk.exposure).toBeCloseTo((night.exposure + day.exposure) / 2);
		expect(daylightAppearance(-1).exposure).toBe(night.exposure);
		expect(daylightAppearance(2).background.getHex()).toBe(day.background.getHex());
	});
});
