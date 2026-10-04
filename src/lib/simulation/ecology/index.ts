export type { BodyState, EcologyConfig, EncounterRecord, Wildlife } from './types';
export { createBody, bodyAbility, daylightAt, advanceBody, DEFAULT_ECOLOGY_CONFIG } from './body';
export { createWildlife, stepWildlife } from './wildlife';
export { resolveEncounters } from './encounters';
