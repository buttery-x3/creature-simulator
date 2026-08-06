/**
 * Communication subdomain: arbitrary symbols, emission, local reception, step advance.
 * Consumed by simulation siblings; presentation imports via $lib/simulation only.
 */

export type {
	EmissionContext,
	EmissionRequest,
	HeardSignal,
	ResourceDiscoveryDetail,
	SignalEmission,
	SymbolId,
	SymbolSelectionCandidateEvidence,
	SymbolSelectionEvidence
} from './types';

export { DEFAULT_SYMBOL_INVENTORY } from './types';

export {
	appendBounded,
	buildEmission,
	canEmit,
	nextEmissionId,
	selectPreferredSymbol,
	toHeardSignal
} from './emission';

export { selectReceivers, type ReceiverCandidate } from './reception';

export {
	buildEmissionWeights,
	selectContextSymbol,
	type AssociationStrengthRow,
	type SelectContextSymbolInput,
	type SelectContextSymbolResult,
	type SymbolSelectionConfig
} from './symbol-selection';

export {
	expireEmissions,
	stepCommunication,
	type CommunicationStepConfig
} from './step-communication';
