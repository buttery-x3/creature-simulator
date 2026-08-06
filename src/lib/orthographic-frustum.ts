/**
 * Compute an orthographic camera frustum that keeps a fixed world view height
 * while matching the given pixel aspect ratio.
 */
export function orthographicFrustum(aspect: number, viewHeight = 1) {
	if (!Number.isFinite(aspect) || aspect <= 0) {
		throw new Error(`aspect must be a positive finite number, received ${aspect}`);
	}
	if (!Number.isFinite(viewHeight) || viewHeight <= 0) {
		throw new Error(`viewHeight must be a positive finite number, received ${viewHeight}`);
	}

	const viewWidth = viewHeight * aspect;
	return {
		left: -viewWidth / 2,
		right: viewWidth / 2,
		top: viewHeight / 2,
		bottom: -viewHeight / 2
	};
}
