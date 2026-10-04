import type { Vec2 } from '$lib/habitat';

export type BodyState = {
	size: number;
	physicality: number;
	health: number;
	nextAttackAt: number;
};

export type Wildlife = BodyState & {
	id: string;
	position: Vec2;
	facing: number;
	energy: number;
	foodAmount: number;
	patrolPhase: number;
	mode: 'roam' | 'approach' | 'avoid' | 'carcass';
};

export type EcologyConfig = {
	wildlifeCount: number;
	dayLengthSeconds: number;
	wildlifeSensingRadius: number;
	wildlifeSpeed: number;
	encounterDistance: number;
	attackCooldownSeconds: number;
	attackDamage: number;
	attackEnergyCost: number;
	movementEnergyCostPerUnit: number;
	activityHungerCostPerSecond: number;
	injuryRecoveryPerSecond: number;
	carcassFoodPerSize: number;
	carcassDecayPerSecond: number;
	wildlifeEnergyDrainPerSecond: number;
	wildlifeRestRecoveryPerSecond: number;
	encounterHistoryLimit: number;
};

export type EncounterRecord = {
	time: number;
	creatureId: string;
	wildlifeId: string;
	kind: 'creature_attack' | 'wildlife_attack' | 'consume_carcass';
	amount: number;
	creatureAbility: number;
	wildlifeAbility: number;
};
