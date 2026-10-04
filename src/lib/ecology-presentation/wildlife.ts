import * as THREE from 'three';
import type { Wildlife } from '$lib/simulation';

/** Shared geometry and individually colored animals, reconciled by authoritative id. */
export function createWildlifePresentation() {
	const root = new THREE.Group();
	root.name = 'wildlife';
	const geometry = new THREE.SphereGeometry(0.27, 10, 7);
	const byId = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
	function update(animals: readonly Wildlife[]) {
		const seen = new Set<string>();
		for (const animal of animals) {
			seen.add(animal.id);
			let mesh = byId.get(animal.id);
			if (!mesh) {
				mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
				mesh.name = animal.id;
				root.add(mesh);
				byId.set(animal.id, mesh);
			}
			const alive = animal.health > 0;
			mesh.position.set(animal.position.x, animal.position.y, alive ? 0.22 * animal.size : 0.06);
			mesh.rotation.z = animal.facing;
			mesh.scale.set(animal.size * 1.5, animal.size, animal.size * (alive ? 0.8 : 0.18));
			mesh.material.color.setHex(alive ? 0xd88364 : 0x72594a);
			mesh.material.color.lerp(new THREE.Color(0x822f32), alive ? (1 - animal.health) * 0.65 : 0);
			mesh.visible = alive || animal.foodAmount > 0;
			mesh.userData.health = animal.health;
			mesh.userData.carcass = !alive;
		}
		for (const [id, mesh] of byId) {
			if (!seen.has(id)) {
				root.remove(mesh);
				mesh.material.dispose();
				byId.delete(id);
			}
		}
	}
	function dispose() {
		for (const mesh of byId.values()) mesh.material.dispose();
		byId.clear();
		root.clear();
		geometry.dispose();
	}
	return { root, byId, update, dispose };
}

/** Night stays legible; the same authoritative daylight value drives physiology. */
export function daylightAppearance(daylight: number) {
	const value = Math.max(0, Math.min(1, daylight));
	return {
		exposure: 0.48 + value * 0.72,
		background: new THREE.Color(0x060c20).lerp(new THREE.Color(0x192c40), value)
	};
}
