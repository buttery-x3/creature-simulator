import * as THREE from 'three';
import {
	createCreaturePresentationResources,
	clearCreaturePresentation
} from '../creature-presentation';
import {
	createHabitatPresentationResources,
	clearHabitatPresentation
} from '../habitat-presentation';
import { createRainPresentationResources, clearRainPresentation } from '../rain-presentation';
import {
	createListenerCuePresentationResources,
	clearListenerCuePresentation
} from '../listener-cue-presentation';
import { createSignalPresentationResources, clearSignalPresentation } from '../signal-presentation';
import { createWildlifePresentation } from '$lib/ecology-presentation';

/** One owner creates and releases all scene resources, including selection overlays. */
export function createViewportResources(scene: THREE.Scene) {
	const habitat = createHabitatPresentationResources();
	const creatures = createCreaturePresentationResources();
	const rain = createRainPresentationResources();
	const signals = createSignalPresentationResources();
	const listeners = createListenerCuePresentationResources();
	const wildlife = createWildlifePresentation();
	const sensingRing = new THREE.Mesh(
		new THREE.RingGeometry(0.98, 1.02, 48),
		new THREE.MeshBasicMaterial({
			color: 0x94a3b8,
			transparent: true,
			opacity: 0.55,
			side: THREE.DoubleSide,
			depthWrite: false
		})
	);
	sensingRing.name = 'sensing-radius-overlay';
	sensingRing.userData.presentationOnly = true;
	sensingRing.visible = false;
	for (const resource of [habitat, creatures, rain, signals, listeners, wildlife])
		scene.add(resource.root);
	scene.add(sensingRing);
	function dispose() {
		clearHabitatPresentation(habitat);
		clearCreaturePresentation(creatures);
		clearRainPresentation(rain);
		clearSignalPresentation(signals);
		clearListenerCuePresentation(listeners);
		wildlife.dispose();
		sensingRing.geometry.dispose();
		sensingRing.material.dispose();
		scene.clear();
	}
	return { habitat, creatures, rain, signals, listeners, wildlife, sensingRing, dispose };
}
