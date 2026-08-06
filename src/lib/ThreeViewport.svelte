<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { Habitat, HabitatFeature } from '$lib/habitat';
	import {
		assessHabitatVisibility,
		frameHabitatPerspectiveCamera,
		type HabitatVisibilityReport
	} from './habitat-camera';

	/**
	 * Coordinate convention:
	 * - Simulation ground plane uses (x, y).
	 * - Three.js maps those onto the XY plane (z is presentation height only).
	 * - Perspective camera is elevated and offset so upright presentation
	 *   (bushes now; creature capsules later) reads as 3D while the full
	 *   habitat remains framed in the viewport.
	 */

	type Props = {
		habitat: Habitat;
	};

	let { habitat }: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	/** Set by onMount; used by $effect to rebuild presentation when habitat changes. */
	let applyHabitat: ((data: Habitat) => void) | undefined = $state();

	onMount(() => {
		const host = container;
		if (!host) {
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0f172a);

		const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
		camera.up.set(0, 0, 1);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.domElement.dataset.testid = 'three-canvas';
		host.appendChild(renderer.domElement);

		const habitatRoot = new THREE.Group();
		habitatRoot.name = 'habitat-root';
		scene.add(habitatRoot);

		const geometries: THREE.BufferGeometry[] = [];
		const materials: THREE.Material[] = [];
		let currentHabitat: Habitat | undefined;

		function trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
			geometries.push(geometry);
			return geometry;
		}

		function trackMaterial<T extends THREE.Material>(material: T): T {
			materials.push(material);
			return material;
		}

		function clearHabitatPresentation(): void {
			while (habitatRoot.children.length > 0) {
				habitatRoot.remove(habitatRoot.children[0]!);
			}
			for (const geometry of geometries.splice(0)) {
				geometry.dispose();
			}
			for (const material of materials.splice(0)) {
				material.dispose();
			}
		}

		function addGround(boundsWidth: number, boundsHeight: number): void {
			const groundGeom = trackGeometry(new THREE.PlaneGeometry(boundsWidth, boundsHeight));
			const groundMat = trackMaterial(
				new THREE.MeshBasicMaterial({
					color: 0x1b4332,
					side: THREE.DoubleSide
				})
			);
			const ground = new THREE.Mesh(groundGeom, groundMat);
			ground.name = 'ground';
			ground.position.z = -0.02;
			habitatRoot.add(ground);

			const edgeGeom = trackGeometry(new THREE.EdgesGeometry(groundGeom));
			const edgeMat = trackMaterial(new THREE.LineBasicMaterial({ color: 0xd8f3dc }));
			const edges = new THREE.LineSegments(edgeGeom, edgeMat);
			edges.name = 'world-edges';
			edges.position.z = 0.01;
			habitatRoot.add(edges);
		}

		function addRegionMarker(feature: HabitatFeature, color: number): void {
			const geom = trackGeometry(new THREE.PlaneGeometry(feature.size.width, feature.size.height));
			const mat = trackMaterial(
				new THREE.MeshBasicMaterial({
					color,
					transparent: true,
					opacity: 0.85,
					side: THREE.DoubleSide
				})
			);
			const mesh = new THREE.Mesh(geom, mat);
			mesh.name = feature.id;
			mesh.position.set(feature.position.x, feature.position.y, 0);
			habitatRoot.add(mesh);

			const outlineGeom = trackGeometry(new THREE.EdgesGeometry(geom));
			const outlineMat = trackMaterial(
				new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
			);
			const outline = new THREE.LineSegments(outlineGeom, outlineMat);
			outline.position.copy(mesh.position);
			outline.position.z = 0.02;
			habitatRoot.add(outline);
		}

		/**
		 * Presentation-only bush: simple stacked geometry above the ground plane.
		 * Creatures will interact with the feature footprint, not these meshes.
		 */
		function addFoodBush(feature: HabitatFeature): void {
			const group = new THREE.Group();
			group.name = feature.id;
			group.position.set(feature.position.x, feature.position.y, 0);

			const footprint = Math.min(feature.size.width, feature.size.height);
			const trunkHeight = footprint * 0.35;
			const canopyRadius = footprint * 0.42;

			const trunkGeom = trackGeometry(
				new THREE.CylinderGeometry(footprint * 0.08, footprint * 0.1, trunkHeight, 6)
			);
			const trunkMat = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x5c4033 }));
			const trunk = new THREE.Mesh(trunkGeom, trunkMat);
			// Cylinder is Y-up; rotate so height rises along presentation Z.
			trunk.rotation.x = Math.PI / 2;
			trunk.position.z = trunkHeight / 2;
			group.add(trunk);

			const canopyGeom = trackGeometry(new THREE.IcosahedronGeometry(canopyRadius, 0));
			const canopyMat = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x2d6a4f }));
			const canopy = new THREE.Mesh(canopyGeom, canopyMat);
			canopy.position.z = trunkHeight + canopyRadius * 0.65;
			group.add(canopy);

			const canopyTopGeom = trackGeometry(new THREE.IcosahedronGeometry(canopyRadius * 0.7, 0));
			const canopyTopMat = trackMaterial(new THREE.MeshBasicMaterial({ color: 0x40916c }));
			const canopyTop = new THREE.Mesh(canopyTopGeom, canopyTopMat);
			canopyTop.position.set(
				footprint * 0.08,
				-footprint * 0.05,
				trunkHeight + canopyRadius * 1.15
			);
			group.add(canopyTop);

			habitatRoot.add(group);
		}

		function buildHabitatPresentation(data: Habitat): void {
			clearHabitatPresentation();
			addGround(data.bounds.width, data.bounds.height);
			addRegionMarker(data.home, 0xc9a227);
			for (const water of data.water) {
				addRegionMarker(water, 0x1d4e89);
			}
			for (const food of data.food) {
				addFoodBush(food);
			}
		}

		function publishVisibility(report: HabitatVisibilityReport): void {
			const canvas = renderer.domElement;
			canvas.dataset.habitatFullyVisible = report.fullyVisible ? 'true' : 'false';
			canvas.dataset.habitatCameraMode = 'perspective-elevated';
			// Compact corner summary for Playwright assertions without scraping WebGL pixels.
			canvas.dataset.habitatCornersVisible = String(
				report.corners.filter((corner) => corner.visible).length
			);
			canvas.dataset.habitatCornerCount = String(report.corners.length);
		}

		function renderFrame() {
			if (!host || !currentHabitat) {
				return;
			}

			const width = host.clientWidth;
			const height = host.clientHeight;
			if (width === 0 || height === 0) {
				return;
			}

			renderer.setSize(width, height, false);

			const report = frameHabitatPerspectiveCamera(camera, currentHabitat.bounds, width / height);
			// Re-assess after final camera write (frame already returns the report).
			const confirmed = assessHabitatVisibility(camera, currentHabitat.bounds);
			publishVisibility(report.fullyVisible ? report : confirmed);

			renderer.render(scene, camera);
		}

		applyHabitat = (data: Habitat) => {
			currentHabitat = data;
			buildHabitatPresentation(data);
			renderFrame();
		};

		// Initial paint uses the current prop value.
		applyHabitat(habitat);

		const observer = new ResizeObserver(renderFrame);
		observer.observe(host);

		return () => {
			observer.disconnect();
			applyHabitat = undefined;
			clearHabitatPresentation();
			scene.remove(habitatRoot);
			renderer.dispose();
			renderer.domElement.remove();
		};
	});

	$effect(() => {
		const data = habitat;
		applyHabitat?.(data);
	});
</script>

<div
	class="viewport"
	bind:this={container}
	data-testid="three-viewport"
	aria-label="Habitat viewport"
></div>

<style>
	.viewport {
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
