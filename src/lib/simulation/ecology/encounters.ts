import type { Creature, SimulationConfig } from '../types';
import { bodyAbility } from './body';
import type { EncounterRecord, Wildlife } from './types';

function inReach(creature: Creature, animal: Wildlife, distance: number): boolean {
	return (
		Math.hypot(creature.position.x - animal.position.x, creature.position.y - animal.position.y) <=
		distance
	);
}

/** Physical consequences of proximity/actions; never selects a creature intention. */
export function resolveEncounters(
	wildlife: readonly Wildlife[],
	creatures: readonly Creature[],
	time: number,
	dt: number,
	config: Pick<SimulationConfig, 'ecology' | 'eatRecoveryPerSecond'>
): { wildlife: Wildlife[]; creatures: Creature[]; encounters: EncounterRecord[] } {
	const animals = wildlife.map((animal) => ({ ...animal }));
	const updated = new Map(creatures.map((creature) => [creature.id, creature]));
	const encounters: EncounterRecord[] = [];
	const ecology = config.ecology;
	const orderedAnimals = [...animals].sort((a, b) => a.id.localeCompare(b.id));
	// Stable id ordering resolves simultaneous claims without dependence on input-array order.
	for (const original of [...creatures].sort((a, b) => a.id.localeCompare(b.id))) {
		let creature = updated.get(original.id)!;
		for (const animal of orderedAnimals) {
			if (creature.body.health <= 0) break;
			if (!inReach(creature, animal, ecology.encounterDistance)) continue;
			const creatureAbility = bodyAbility(creature.body, creature.energy);
			const wildlifeAbility = bodyAbility(animal, animal.energy);
			const record = (kind: EncounterRecord['kind'], amount: number) =>
				encounters.push({
					time,
					creatureId: creature.id,
					wildlifeId: animal.id,
					kind,
					amount,
					creatureAbility,
					wildlifeAbility
				});
			const targetMatches =
				creature.target?.kind === 'wildlife' && creature.target.wildlifeId === animal.id;
			if (animal.health <= 0) {
				if (targetMatches && creature.intention === 'hunt' && creature.action === 'fight') {
					const amount = Math.min(
						animal.foodAmount,
						creature.hunger,
						config.eatRecoveryPerSecond * dt
					);
					if (amount > 0) {
						animal.foodAmount -= amount;
						creature = { ...creature, hunger: Math.max(0, creature.hunger - amount) };
						record('consume_carcass', amount);
					}
				}
				continue;
			}
			const attacking =
				targetMatches &&
				creature.intention === 'hunt' &&
				creature.action === 'fight' &&
				time >= creature.body.nextAttackAt &&
				creature.energy >= ecology.attackEnergyCost;
			if (attacking) {
				const amount = Math.min(
					animal.health,
					(ecology.attackDamage * creatureAbility) / Math.max(0.15, wildlifeAbility)
				);
				animal.health = Math.max(0, animal.health - amount);
				creature = {
					...creature,
					energy: Math.max(0, creature.energy - ecology.attackEnergyCost),
					body: { ...creature.body, nextAttackAt: time + ecology.attackCooldownSeconds }
				};
				record('creature_attack', amount);
				if (animal.health === 0) {
					animal.mode = 'carcass';
					animal.foodAmount = animal.size * ecology.carcassFoodPerSize;
				}
			}
			if (
				animal.health > 0 &&
				(attacking || animal.mode === 'approach') &&
				time >= animal.nextAttackAt &&
				animal.energy >= ecology.attackEnergyCost
			) {
				const amount = Math.min(
					creature.body.health,
					(ecology.attackDamage * wildlifeAbility) / Math.max(0.15, creatureAbility)
				);
				animal.nextAttackAt = time + ecology.attackCooldownSeconds;
				animal.energy = Math.max(0, animal.energy - ecology.attackEnergyCost);
				creature = {
					...creature,
					body: { ...creature.body, health: Math.max(0, creature.body.health - amount) },
					pendingArbitrationTrigger: 'danger_perception_change'
				};
				record('wildlife_attack', amount);
			}
		}
		updated.set(creature.id, creature);
	}
	return {
		wildlife: animals.filter((animal) => animal.health > 0 || animal.foodAmount > 0),
		creatures: creatures.map((creature) => updated.get(creature.id)!),
		encounters
	};
}
