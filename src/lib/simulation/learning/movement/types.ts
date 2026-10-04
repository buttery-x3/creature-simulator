import type { Vec2 } from '$lib/habitat';
import type { HeardSignal } from '../../communication';
import type { SimulationConfig } from '../../types';

/** This input deliberately cannot expose diagnostic speaker identity or intent. */
export type MovementHeardSignal = Pick<
	HeardSignal,
	'emissionId' | 'symbolId' | 'origin' | 'heardAt'
>;
export type MovementTraceStatus = 'pending' | 'confirmed' | 'contradicted' | 'unobserved';
export type MovementTrace = {
	emissionId: string;
	symbolId: MovementHeardSignal['symbolId'];
	heardAt: number;
	expiresAt: number;
	status: MovementTraceStatus;
	peerTowardDistance: number;
	closestDistance: number;
	comfortableContactSeconds: number;
	lastComfortableContact: boolean;
	lastObservedAt: number;
	reason: string;
};

export type MovementEncounter = {
	peerId: string;
	firstObservedAt: number;
	lastObservedAt: number;
	lastPeerPosition: Vec2;
	lastListenerPosition: Vec2;
	trace: MovementTrace | null;
	responseOffered: boolean;
	nextResponseAt: number;
};
export type MovementResponse = Pick<
	MovementTrace,
	'emissionId' | 'symbolId' | 'heardAt' | 'expiresAt'
> & { peerId: string };
export type MovementBinding = Pick<MovementTrace, 'emissionId' | 'symbolId' | 'heardAt'> & {
	status: 'bound' | 'ambiguous' | 'unseen' | 'budget';
	peerId: string | null;
};
export type MovementLearningState = {
	encounters: MovementEncounter[];
	response: MovementResponse | null;
	lastBinding: MovementBinding | null;
};
export type MovementLearningConfig = Pick<
	SimulationConfig,
	| 'perceptionIntervalSeconds'
	| 'sensingRadius'
	| 'associationReinforcement'
	| 'associationStrengthMin'
	| 'associationStrengthMax'
	| 'symbolInventory'
	| 'lexiconAssignmentMinStrength'
	| 'lexiconAssignmentMinEvidenceCount'
	| 'lexiconHistoryLimit'
	| 'learningHistoryLimit'
>;

export type MovementOutcome = { peerId: string; trace: MovementTrace };
