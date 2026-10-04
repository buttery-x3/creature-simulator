import * as THREE from 'three';
import type { Creature } from '$lib/simulation';

type Cue = {
	root: THREE.Group;
	dance: THREE.Group;
	cry: THREE.Group;
	danceMaterial: THREE.MeshBasicMaterial;
	cryMaterial: THREE.MeshBasicMaterial;
};

/** Innate expression cues are distinct from arbitrary learned symbol glyphs. */
export function createExpressionPresentation() {
	const root = new THREE.Group();
	root.name = 'innate-expressions';
	const byId = new Map<string, Cue>();
	const arc = new THREE.RingGeometry(0.34, 0.39, 12, 1, 0, Math.PI * 0.7);
	const drop = new THREE.Shape();
	drop.moveTo(0, 0.15);
	drop.bezierCurveTo(-0.04, 0.07, -0.13, -0.04, -0.07, -0.09);
	drop.bezierCurveTo(0, -0.16, 0.13, -0.07, 0.07, 0.02);
	drop.lineTo(0, 0.15);
	const tear = new THREE.ShapeGeometry(drop, 5);

	function createCue(id: string): Cue {
		const cueRoot = new THREE.Group();
		cueRoot.name = 'expression-' + id;
		cueRoot.userData.presentationOnly = true;
		const dance = new THREE.Group();
		const cry = new THREE.Group();
		const danceMaterial = new THREE.MeshBasicMaterial({
			color: 0xffd166,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false,
			toneMapped: false
		});
		const cryMaterial = new THREE.MeshBasicMaterial({
			color: 0x7dd3fc,
			transparent: true,
			side: THREE.DoubleSide,
			depthWrite: false,
			toneMapped: false
		});
		for (let i = 0; i < 2; i++) {
			const arcMesh = new THREE.Mesh(arc, danceMaterial);
			arcMesh.rotation.z = i * Math.PI;
			dance.add(arcMesh);
			const dropMesh = new THREE.Mesh(tear, cryMaterial);
			dropMesh.position.x = i === 0 ? -0.3 : 0.3;
			cry.add(dropMesh);
		}
		cueRoot.add(dance, cry);
		root.add(cueRoot);
		return { root: cueRoot, dance, cry, danceMaterial, cryMaterial };
	}
	function removeCue(id: string, cue: Cue) {
		root.remove(cue.root);
		cue.danceMaterial.dispose();
		cue.cryMaterial.dispose();
		byId.delete(id);
	}
	function update(creatures: readonly Creature[], timeSeconds: number) {
		const active = new Set<string>();
		for (const creature of creatures) {
			const expression = creature.social.expression;
			if (!expression || timeSeconds < expression.startedAt || timeSeconds >= expression.expiresAt)
				continue;
			active.add(creature.id);
			let cue = byId.get(creature.id);
			if (!cue) {
				cue = createCue(creature.id);
				byId.set(creature.id, cue);
			}
			const age = timeSeconds - expression.startedAt;
			const intensity = Math.max(0, Math.min(1, expression.intensity));
			const fade = Math.min(1, (expression.expiresAt - timeSeconds) / 0.4);
			cue.root.position.set(creature.position.x, creature.position.y, 0.6 * creature.body.size);
			cue.root.scale.setScalar(creature.body.size);
			cue.root.userData.expressionKind = expression.kind;
			cue.root.userData.expressionId = expression.id;
			cue.dance.visible = expression.kind === 'dance';
			cue.cry.visible = expression.kind === 'cry';
			cue.dance.rotation.z = age * 4;
			cue.dance.scale.setScalar(1 + Math.sin(age * 8) * 0.1 * intensity);
			cue.dance.position.z = Math.abs(Math.sin(age * 4)) * 0.12;
			cue.cry.position.y = 0.12 - ((age * 1.4) % 1) * 0.28;
			cue.danceMaterial.opacity = fade * (0.5 + intensity * 0.45);
			cue.cryMaterial.opacity = fade * (0.5 + intensity * 0.45);
		}
		for (const [id, cue] of byId) if (!active.has(id)) removeCue(id, cue);
	}
	function dispose() {
		for (const [id, cue] of byId) removeCue(id, cue);
		arc.dispose();
		tear.dispose();
	}
	return { root, byId, update, dispose };
}
