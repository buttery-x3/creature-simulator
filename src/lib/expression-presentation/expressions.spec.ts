import { describe, expect, it, vi } from 'vitest';
import { testCreature } from '$lib/simulation/test-creature';
import { createExpressionPresentation } from './expressions';

function expressive(kind: 'dance' | 'cry' = 'dance') {
	const creature = testCreature();
	return {
		...creature,
		social: {
			...creature.social,
			expression: { id: 'expression-0', kind, startedAt: 2, expiresAt: 5, intensity: 0.8 }
		}
	};
}

describe('innate expression presentation', () => {
	it('reuses cues while time drives the pose, freezes at the same clock and never changes state', () => {
		const resources = createExpressionPresentation();
		const creature = expressive();
		const before = JSON.stringify(creature);
		resources.update([creature], 2.1);
		const cue = resources.byId.get(creature.id)!;
		const initialRotation = cue.dance.rotation.z;
		expect(cue.dance.visible).toBe(true);
		expect(cue.cry.visible).toBe(false);
		resources.update([creature], 2.4);
		expect(resources.byId.get(creature.id)).toBe(cue);
		expect(cue.dance.rotation.z).not.toBe(initialRotation);
		const pausedRotation = cue.dance.rotation.z;
		resources.update([creature], 2.4);
		expect(cue.dance.rotation.z).toBe(pausedRotation);
		expect(JSON.stringify(creature)).toBe(before);
		resources.dispose();
	});
	it('changes kind in place, follows authoritative position and releases expired or removed cues', () => {
		const resources = createExpressionPresentation();
		const creature = expressive();
		resources.update([creature], 1.9);
		expect(resources.byId.size).toBe(0);
		resources.update([creature], 2);
		const cue = resources.byId.get(creature.id)!;
		const cry = { ...expressive('cry'), position: { x: 4, y: 3 } };
		const disposed = vi.spyOn(cue.cryMaterial, 'dispose');
		resources.update([cry], 2.5);
		expect(resources.byId.get(creature.id)).toBe(cue);
		expect(cue.cry.visible).toBe(true);
		expect(cue.dance.visible).toBe(false);
		expect(cue.root.position.x).toBe(4);
		resources.update([cry], 5);
		expect(resources.byId.size).toBe(0);
		expect(disposed).toHaveBeenCalledOnce();
		resources.update([creature], 2);
		resources.update([], 2.1);
		expect(resources.root.children).toHaveLength(0);
		resources.dispose();
	});
});
