export type { LifeState, LifecycleConfig, DeathCause, BirthSpec, LifeEvent } from './types';
export { DEFAULT_LIFECYCLE_CONFIG, validateLifecycleConfig } from './defaults';
export { createLifeState, isMature, reproductionEligible, advanceLife } from './physiology';
export { resolveReproduction } from './reproduction';
