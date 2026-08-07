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
	SymbolSelectionEvidence,
	SymbolSelectionMode
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
	selectContextSymbol,
	type LexiconAssignmentRow,
	type SelectContextSymbolInput,
	type SelectContextSymbolResult
} from './symbol-selection';

export {
	expireEmissions,
	stepCommunication,
	type CommunicationStepConfig,
	type CommunicationStepResult
} from './step-communication';
