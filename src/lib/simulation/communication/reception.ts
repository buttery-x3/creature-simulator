/**
 * Local reception: circular hearing radius on the ground plane.
 * Omnidirectional; no facing, LOS or propagation delay.
 * Sender is excluded.
 */

import type { Vec2 } from '$lib/habitat';
import type { SignalEmission } from './types';

export type ReceiverCandidate = {
	id: string;
	position: Vec2;
};

/**
 * Select creatures that hear an emission.
 * - Distance from emission origin ≤ hearingRadius
 * - Sender excluded
 * - Results sorted by creature id for deterministic ordering
 */
export function selectReceivers(
	emission: Pick<SignalEmission, 'origin' | 'senderId'>,
	candidates: readonly ReceiverCandidate[],
	hearingRadius: number
): ReceiverCandidate[] {
	const radiusSq = hearingRadius * hearingRadius;
	const heard: ReceiverCandidate[] = [];

	for (const candidate of candidates) {
		if (candidate.id === emission.senderId) {
			continue;
		}
		const dx = candidate.position.x - emission.origin.x;
		const dy = candidate.position.y - emission.origin.y;
		if (dx * dx + dy * dy <= radiusSq) {
			heard.push(candidate);
		}
	}

	heard.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return heard;
}
