/** Bounded listener-local movement sequences, evidence and response availability. */
export { MOVEMENT_DEFAULTS } from './defaults';
export {
	emptyMovementLearningState,
	observeMovementLearning,
	hearMovementLearning,
	consumeMovementResponse
} from './observations';
export type {
	MovementLearningState,
	MovementLearningConfig,
	MovementHeardSignal,
	MovementEncounter,
	MovementTrace,
	MovementTraceStatus,
	MovementResponse,
	MovementBinding
} from './types';
