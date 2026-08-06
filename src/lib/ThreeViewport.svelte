<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { orthographicFrustum } from './orthographic-frustum';

	let container: HTMLDivElement | undefined = $state();

	onMount(() => {
		const host = container;
		if (!host) {
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x111827);

		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
		camera.position.z = 1;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.domElement.dataset.testid = 'three-canvas';
		host.appendChild(renderer.domElement);

		// Static bounded 2D area used only to confirm Three.js rendering works.
		const planeGeometry = new THREE.PlaneGeometry(1.2, 0.8);
		const planeMaterial = new THREE.MeshBasicMaterial({
			color: 0x1b4332,
			side: THREE.DoubleSide
		});
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		scene.add(plane);

		const edgeGeometry = new THREE.EdgesGeometry(planeGeometry);
		const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x95d5b2 });
		const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
		scene.add(edges);

		function renderFrame() {
			if (!host) {
				return;
			}

			const width = host.clientWidth;
			const height = host.clientHeight;
			if (width === 0 || height === 0) {
				return;
			}

			renderer.setSize(width, height, false);

			const frustum = orthographicFrustum(width / height, 1);
			camera.left = frustum.left;
			camera.right = frustum.right;
			camera.top = frustum.top;
			camera.bottom = frustum.bottom;
			camera.updateProjectionMatrix();

			renderer.render(scene, camera);
		}

		const observer = new ResizeObserver(renderFrame);
		observer.observe(host);
		renderFrame();

		return () => {
			observer.disconnect();
			scene.remove(plane, edges);
			planeGeometry.dispose();
			planeMaterial.dispose();
			edgeGeometry.dispose();
			edgeMaterial.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		};
	});
</script>

<div
	class="viewport"
	bind:this={container}
	data-testid="three-viewport"
	aria-label="Three.js viewport"
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
