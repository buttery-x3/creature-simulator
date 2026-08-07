/**
 * Dynamic signal presentation: reconcile Three.js objects by emission id.
 *
 * Visuals derive only from authoritative active emissions. Presentation does not
 * determine reception or lifetime — when an emission leaves activeEmissions, its
 * mesh is removed.
 *
 * Speech bubbles follow the sender's current presentation position (fallback:
 * emission origin). Propagation rings stay centred on the recorded origin and
 * expand toward configurable hearingRadius. The ring is an illustrative
 * range/falloff cue only — hearing remains instantaneous within radius at
 * emission time (no propagation delay).
 *
 * Selected-creature investigation overlay is presentation-only (line + origin marker).
 */

import * as THREE from 'three';
import type { Vec2 } from '$lib/habitat';
import {
	distanceFalloffFactor,
	type ActiveSignalInvestigation,
	type SignalEmission,
	type SymbolId
} from '$lib/simulation';
import { getSymbolPresentation, type SymbolShape } from './symbol-presentation';

/** Bubble centre height above ground (above creature body). */
const BUBBLE_HEIGHT = 1.15;
/** Ring band thickness in world units (constant; not proportional to radius). */
export const RING_BAND_THICKNESS = 0.06;
const RING_SEGMENTS = 48;
const RING_BASE_OPACITY = 0.55;
const BUBBLE_BACKING_COLOR = 0xf1f5f9;
const BUBBLE_OUTLINE_COLOR = 0x0f172a;
const INVESTIGATION_MARKER_RADIUS = 0.18;
const INVESTIGATION_LINE_Z = 0.06;
const INVESTIGATION_MARKER_Z = 0.55;

export type SignalReconcileOptions = {
	hearingRadius: number;
	investigationDistanceScale: number;
	/** Current presentation positions keyed by creature id (sender lookup). */
	creaturePositions: Readonly<Record<string, Vec2>>;
};

export type SignalPresentationResources = {
	root: THREE.Group;
	/** Shared shape geometries reused across emissions; disposed with the bag. */
	shapeGeometries: Record<SymbolShape, THREE.BufferGeometry>;
	bubbleBackingGeometry: THREE.BufferGeometry;
	byId: Map<string, THREE.Group>;
	materialsById: Map<
		string,
		{
			glyph: THREE.MeshBasicMaterial;
			backing: THREE.MeshBasicMaterial;
			ring: THREE.MeshBasicMaterial;
		}
	>;
	/** Per-emission ring geometry (world-unit thickness; replaced as radius changes). */
	ringGeometryById: Map<string, THREE.BufferGeometry>;
	structureVersion: number;
	investigationOverlay: THREE.Group | null;
	investigationLine: THREE.Line | null;
	investigationMarker: THREE.Mesh | null;
	investigationMaterial: THREE.LineBasicMaterial | null;
	investigationMarkerMaterial: THREE.MeshBasicMaterial | null;
};

function createStarGeometry(): THREE.BufferGeometry {
	const outer = 0.22;
	const inner = 0.09;
	const points: THREE.Vector2[] = [];
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		points.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
	}
	const shape = new THREE.Shape(points);
	return new THREE.ShapeGeometry(shape);
}

function createTriangleGeometry(): THREE.BufferGeometry {
	const shape = new THREE.Shape([
		new THREE.Vector2(0, 0.22),
		new THREE.Vector2(0.2, -0.18),
		new THREE.Vector2(-0.2, -0.18)
	]);
	return new THREE.ShapeGeometry(shape);
}

function createSquareGeometry(): THREE.BufferGeometry {
	return new THREE.PlaneGeometry(0.34, 0.34);
}

function createCircleGeometry(): THREE.BufferGeometry {
	// Ring outline so circle reads as hollow (matches UI ○).
	return new THREE.RingGeometry(0.12, 0.2, 24);
}

export function createSignalPresentationResources(): SignalPresentationResources {
	const root = new THREE.Group();
	root.name = 'signals-root';

	return {
		root,
		shapeGeometries: {
			star: createStarGeometry(),
			circle: createCircleGeometry(),
			triangle: createTriangleGeometry(),
			square: createSquareGeometry()
		},
		bubbleBackingGeometry: new THREE.CircleGeometry(0.32, 24),
		byId: new Map(),
		materialsById: new Map(),
		ringGeometryById: new Map(),
		structureVersion: 0,
		investigationOverlay: null,
		investigationLine: null,
		investigationMarker: null,
		investigationMaterial: null,
		investigationMarkerMaterial: null
	};
}

function shapeForSymbol(symbolId: SymbolId | string): SymbolShape {
	return getSymbolPresentation(symbolId).shape;
}

function createSignalGroup(
	resources: SignalPresentationResources,
	emission: SignalEmission
): THREE.Group {
	const group = new THREE.Group();
	group.name = emission.id;
	group.userData.emissionId = emission.id;
	group.userData.presentationOnly = true;
	group.userData.symbolId = emission.symbolId;
	group.userData.shape = shapeForSymbol(emission.symbolId);

	const presentation = getSymbolPresentation(emission.symbolId);
	const color = presentation.color;

	const glyphMaterial = new THREE.MeshBasicMaterial({
		color,
		side: THREE.DoubleSide,
		depthWrite: false,
		transparent: true,
		opacity: 1
	});
	const backingMaterial = new THREE.MeshBasicMaterial({
		color: BUBBLE_BACKING_COLOR,
		side: THREE.DoubleSide,
		depthWrite: false,
		transparent: true,
		opacity: 0.92
	});
	const ringMaterial = new THREE.MeshBasicMaterial({
		color,
		transparent: true,
		opacity: RING_BASE_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false
	});
	resources.materialsById.set(emission.id, {
		glyph: glyphMaterial,
		backing: backingMaterial,
		ring: ringMaterial
	});

	// Billboard group: speech bubble (backing + glyph). Faces camera via updateSignalBillboards.
	const bubble = new THREE.Group();
	bubble.name = `${emission.id}-bubble`;
	bubble.userData.billboard = true;
	bubble.position.set(0, 0, BUBBLE_HEIGHT);

	const backing = new THREE.Mesh(resources.bubbleBackingGeometry, backingMaterial);
	backing.name = `${emission.id}-bubble-backing`;
	// Slight outline via dark edge mesh behind backing.
	const outline = new THREE.Mesh(
		resources.bubbleBackingGeometry,
		new THREE.MeshBasicMaterial({
			color: BUBBLE_OUTLINE_COLOR,
			side: THREE.DoubleSide,
			depthWrite: false,
			transparent: true,
			opacity: 0.35
		})
	);
	outline.name = `${emission.id}-bubble-outline`;
	outline.scale.setScalar(1.08);
	outline.position.z = -0.01;
	// Outline material is owned by the mesh; track on userData for dispose.
	outline.userData.ownedMaterial = true;

	const glyph = new THREE.Mesh(resources.shapeGeometries[presentation.shape], glyphMaterial);
	glyph.name = `${emission.id}-glyph`;
	glyph.position.z = 0.02;

	bubble.add(outline);
	bubble.add(backing);
	bubble.add(glyph);

	// Ring starts as a thin band; geometry replaced during transform updates.
	const initialRingGeom = new THREE.RingGeometry(
		Math.max(1e-4, RING_BAND_THICKNESS * 0.5),
		RING_BAND_THICKNESS,
		RING_SEGMENTS
	);
	resources.ringGeometryById.set(emission.id, initialRingGeom);
	const ring = new THREE.Mesh(initialRingGeom, ringMaterial);
	ring.name = `${emission.id}-ring`;
	ring.position.set(0, 0, 0.03);
	ring.userData.presentationOnly = true;

	// Ring lives on a sibling group fixed at emission origin; bubble follows sender.
	const ringAnchor = new THREE.Group();
	ringAnchor.name = `${emission.id}-ring-anchor`;
	ringAnchor.add(ring);

	const bubbleAnchor = new THREE.Group();
	bubbleAnchor.name = `${emission.id}-bubble-anchor`;
	bubbleAnchor.add(bubble);

	group.add(ringAnchor);
	group.add(bubbleAnchor);
	return group;
}

/**
 * Compute presentation ring outer radius and opacity for an emission age.
 * Exported for unit tests — does not mutate simulation state.
 */
export function computeRingPresentation(
	emission: Pick<SignalEmission, 'emittedAt' | 'expiresAt'>,
	timeSeconds: number,
	hearingRadius: number,
	investigationDistanceScale: number
): { outerRadius: number; opacity: number; lifetimeT: number; distanceFactor: number } {
	const lifetime = Math.max(1e-6, emission.expiresAt - emission.emittedAt);
	const age = Math.max(0, timeSeconds - emission.emittedAt);
	const lifetimeT = Math.min(1, age / lifetime);
	const safeHearing = hearingRadius > 0 && Number.isFinite(hearingRadius) ? hearingRadius : 1;
	const outerRadius = Math.max(RING_BAND_THICKNESS, lifetimeT * safeHearing);
	const distanceFactor = distanceFalloffFactor(outerRadius, investigationDistanceScale);
	const opacity = RING_BASE_OPACITY * distanceFactor * (1 - lifetimeT);
	return { outerRadius, opacity, lifetimeT, distanceFactor };
}

function applySignalTransform(
	resources: SignalPresentationResources,
	group: THREE.Group,
	emission: SignalEmission,
	timeSeconds: number,
	options: SignalReconcileOptions
): void {
	// Group itself stays at origin; anchors place bubble vs ring independently.
	group.position.set(0, 0, 0);

	const senderPos = options.creaturePositions[emission.senderId];
	const bubblePos = senderPos ?? emission.origin;

	const bubbleAnchor = group.children.find((c) => c.name.endsWith('-bubble-anchor'));
	const ringAnchor = group.children.find((c) => c.name.endsWith('-ring-anchor'));
	if (bubbleAnchor) {
		bubbleAnchor.position.set(bubblePos.x, bubblePos.y, 0);
	}
	if (ringAnchor) {
		ringAnchor.position.set(emission.origin.x, emission.origin.y, 0);
	}

	const { outerRadius, opacity } = computeRingPresentation(
		emission,
		timeSeconds,
		options.hearingRadius,
		options.investigationDistanceScale
	);

	const ring = group.getObjectByName(`${emission.id}-ring`) as THREE.Mesh | undefined;
	if (ring) {
		const innerRadius = Math.max(1e-4, outerRadius - RING_BAND_THICKNESS);
		const prev = resources.ringGeometryById.get(emission.id);
		const next = new THREE.RingGeometry(innerRadius, outerRadius, RING_SEGMENTS);
		ring.geometry = next;
		if (prev) {
			prev.dispose();
		}
		resources.ringGeometryById.set(emission.id, next);

		if (ring.material instanceof THREE.MeshBasicMaterial) {
			ring.material.opacity = opacity;
		}
	}
}

/**
 * Reconcile signal meshes to match authoritative active emissions.
 * Updates transforms in place; creates/disposes only when the id set changes.
 */
export function reconcileSignals(
	resources: SignalPresentationResources,
	emissions: readonly SignalEmission[],
	timeSeconds: number,
	options: SignalReconcileOptions
): void {
	const seen = new Set<string>();

	for (const emission of emissions) {
		seen.add(emission.id);
		let group = resources.byId.get(emission.id);
		if (!group) {
			group = createSignalGroup(resources, emission);
			resources.byId.set(emission.id, group);
			resources.root.add(group);
			resources.structureVersion += 1;
		}
		applySignalTransform(resources, group, emission, timeSeconds, options);
	}

	for (const [id, group] of resources.byId) {
		if (seen.has(id)) {
			continue;
		}
		disposeEmissionGroup(resources, id, group);
		resources.structureVersion += 1;
	}
}

function disposeEmissionGroup(
	resources: SignalPresentationResources,
	id: string,
	group: THREE.Group
): void {
	resources.root.remove(group);
	resources.byId.delete(id);
	const mats = resources.materialsById.get(id);
	if (mats) {
		mats.glyph.dispose();
		mats.backing.dispose();
		mats.ring.dispose();
		resources.materialsById.delete(id);
	}
	const ringGeom = resources.ringGeometryById.get(id);
	if (ringGeom) {
		ringGeom.dispose();
		resources.ringGeometryById.delete(id);
	}
	// Dispose outline materials owned on bubble meshes.
	group.traverse((obj) => {
		if (obj instanceof THREE.Mesh && obj.userData.ownedMaterial) {
			const mat = obj.material;
			if (mat instanceof THREE.Material) {
				mat.dispose();
			}
		}
	});
}

/**
 * Face all speech-bubble billboards toward the active camera.
 * Call once per rendered frame after reconcile.
 */
export function updateSignalBillboards(
	resources: SignalPresentationResources,
	camera: THREE.Camera
): void {
	for (const group of resources.byId.values()) {
		const bubble = group.getObjectByName(`${group.name}-bubble`);
		if (bubble) {
			bubble.quaternion.copy(camera.quaternion);
		}
	}
}

/**
 * Show or hide a presentation-only line from the selected creature to its active
 * investigation origin. Does not mutate simulation state.
 */
export function updateInvestigationOverlay(
	resources: SignalPresentationResources,
	options: {
		creaturePosition: Vec2 | null;
		investigation: ActiveSignalInvestigation | null;
	}
): void {
	const { creaturePosition, investigation } = options;
	const show = creaturePosition !== null && investigation !== null;

	if (!show) {
		if (resources.investigationOverlay) {
			resources.investigationOverlay.visible = false;
		}
		return;
	}

	if (!resources.investigationOverlay) {
		const overlay = new THREE.Group();
		overlay.name = 'investigation-overlay';
		overlay.userData.presentationOnly = true;

		const lineMaterial = new THREE.LineBasicMaterial({
			color: 0xfbbf24,
			transparent: true,
			opacity: 0.85,
			depthWrite: false
		});
		const points = [
			new THREE.Vector3(0, 0, INVESTIGATION_LINE_Z),
			new THREE.Vector3(1, 0, INVESTIGATION_LINE_Z)
		];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const line = new THREE.Line(geometry, lineMaterial);
		line.name = 'investigation-line';

		const markerMaterial = new THREE.MeshBasicMaterial({
			color: 0xfbbf24,
			transparent: true,
			opacity: 0.9
		});
		const markerGeom = new THREE.SphereGeometry(INVESTIGATION_MARKER_RADIUS, 8, 6);
		const marker = new THREE.Mesh(markerGeom, markerMaterial);
		marker.name = 'investigation-origin-marker';
		marker.position.z = INVESTIGATION_MARKER_Z;

		overlay.add(line);
		overlay.add(marker);
		resources.root.add(overlay);
		resources.investigationOverlay = overlay;
		resources.investigationLine = line;
		resources.investigationMarker = marker;
		resources.investigationMaterial = lineMaterial;
		resources.investigationMarkerMaterial = markerMaterial;
		resources.structureVersion += 1;
	}

	const overlay = resources.investigationOverlay;
	const line = resources.investigationLine;
	const marker = resources.investigationMarker;
	if (!overlay || !line || !marker || !investigation || !creaturePosition) {
		return;
	}

	overlay.visible = true;
	marker.position.set(investigation.origin.x, investigation.origin.y, INVESTIGATION_MARKER_Z);

	const positions = line.geometry.attributes.position as THREE.BufferAttribute;
	positions.setXYZ(0, creaturePosition.x, creaturePosition.y, INVESTIGATION_LINE_Z);
	positions.setXYZ(1, investigation.origin.x, investigation.origin.y, INVESTIGATION_LINE_Z);
	positions.needsUpdate = true;
	line.geometry.computeBoundingSphere();
}

export function clearSignalPresentation(resources: SignalPresentationResources): void {
	for (const [id, group] of [...resources.byId.entries()]) {
		disposeEmissionGroup(resources, id, group);
	}

	if (resources.investigationOverlay) {
		resources.root.remove(resources.investigationOverlay);
		resources.investigationLine?.geometry.dispose();
		resources.investigationMaterial?.dispose();
		resources.investigationMarker?.geometry.dispose();
		resources.investigationMarkerMaterial?.dispose();
		resources.investigationOverlay = null;
		resources.investigationLine = null;
		resources.investigationMarker = null;
		resources.investigationMaterial = null;
		resources.investigationMarkerMaterial = null;
	}

	for (const geom of Object.values(resources.shapeGeometries)) {
		geom.dispose();
	}
	resources.bubbleBackingGeometry.dispose();
	resources.structureVersion += 1;
}
