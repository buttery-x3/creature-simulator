import type { Vec2 } from '$lib/habitat';

export type LifeState = {
	ageSeconds: number;
	/** Immutable juvenile growth baseline; not observable peer knowledge. */
	adultBody: { size: number; physicality: number };
	nextReproductionAt: number;
	courtship: { peerId: string; startedAt: number; mutualSince: number | null } | null;
	deprivationSeconds: { hunger: number; thirst: number };
	generation: number;
	/** Observer genealogy only; offspring do not inherit parents' learned state. */
	parentIds: string[];
};

export type LifecycleConfig = {
	maturitySeconds: number;
	newbornBodyScale: number;
	initialAdultAgeMinSeconds: number;
	initialAdultAgeMaxSeconds: number;
	senescenceAgeSeconds: number;
	maxAgeSeconds: number;
	ageDamagePerSecond: number;
	deprivationThreshold: number;
	hungerGraceSeconds: number;
	thirstGraceSeconds: number;
	hungerDamagePerSecond: number;
	thirstDamagePerSecond: number;
	deprivationRecoveryRate: number;
	reproductionHealthMin: number;
	reproductionEnergyMin: number;
	reproductionNeedMax: number;
	courtshipDistance: number;
	mutualCourtshipSeconds: number;
	courtshipTimeoutSeconds: number;
	failedCourtshipCooldownSeconds: number;
	reproductionCooldownSeconds: number;
	reproductionEnergyCost: number;
	reproductionHungerCost: number;
	populationCap: number;
	eventHistoryLimit: number;
};

export type DeathCause = 'injury' | 'deprivation' | 'age';
export type BirthSpec = {
	id: string;
	position: Vec2;
	parentIds: [string, string];
	generation: number;
};
export type LifeEvent =
	| {
			kind: 'birth';
			time: number;
			creatureId: string;
			parentIds: [string, string];
			generation: number;
	  }
	| { kind: 'death'; time: number; creatureId: string; cause: DeathCause }
	| {
			kind: 'courtship_failed';
			time: number;
			creatureIds: string[];
			reason: 'timeout' | 'population_cap';
	  };
