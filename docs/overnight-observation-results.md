# Overnight physical ecology observation

Run on October 4, 2026 at 10:25 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `08289a586d59cf699860d62e282817088283e212`; working-source SHA-256: `214932dedb5419bf5cdb0e00abae5af10eeba2c785fbdbac8464d51d78620139`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.

Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This is the physical ecology slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.

## Results

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    1.0239 |             18 / 72 |                     14 / 13 |                        356 / 2.9561 |                       2 / 2 |
| overnight-river   |     0.788 |            24 / 344 |                     21 / 36 |                        499 / 4.1476 |                       2 / 1 |
| overnight-drought |      0.92 |            22 / 484 |                     22 / 18 |                        722 / 5.9925 |                       0 / 1 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1063–1 |       0.1109–1 |            0–1 |       0.6327–1 |                   16 / 16 |
| overnight-river   |        0.112–1 |        0.111–1 |            0–1 |         0.05–1 |                   13 / 15 |
| overnight-drought |       0.1122–1 |       0.1109–1 |       0.0463–1 |         0.05–1 |                   12 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                       2696.0667 / 212.7333 |                               7.7 / 4.4667 |                 4.9667 |       1309 / 258 |                         1 |
| overnight-river   |                          2578.2 / 125.5333 |                            321.5667 / 31.7 |                52.3333 |       1697 / 767 |                         2 |
| overnight-drought |                          2671.4 / 127.8667 |                             72.0667 / 48.1 |                 0.2667 |      2394 / 1423 |                         2 |

### demo

Actions: move: 5302 (73.6%); sleep: 689 (9.6%); explore: 469 (6.5%); drink: 345 (4.8%); eat: 196 (2.7%); search: 156 (2.2%); fight: 43 (0.6%).

Intentions: rest: 2230 (31.0%); investigate_signal: 2229 (31.0%); satisfy_hunger: 1063 (14.8%); satisfy_thirst: 954 (13.3%); explore: 469 (6.5%); flee: 124 (1.7%); hunt: 95 (1.3%); announce_resource: 36 (0.5%).

Most frequent rapid transition pairs: announce_resource → explore: 22; rest → flee: 22; flee → rest: 20; explore → rest: 17; satisfy_hunger → rest: 15.

Final mean hunger/thirst/energy: 0.7049 / 0.3329 / 0.7257; injured creatures: 6/12; food sources: 1. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Actions: move: 5156 (71.6%); sleep: 569 (7.9%); search: 460 (6.4%); explore: 396 (5.5%); drink: 324 (4.5%); eat: 222 (3.1%); fight: 73 (1.0%).

Intentions: rest: 2311 (32.1%); satisfy_hunger: 1360 (18.9%); satisfy_thirst: 1340 (18.6%); investigate_signal: 1126 (15.6%); flee: 467 (6.5%); explore: 396 (5.5%); hunt: 171 (2.4%); announce_resource: 29 (0.4%).

Most frequent rapid transition pairs: flee → rest: 151; rest → flee: 130; satisfy_hunger → rest: 45; flee → satisfy_hunger: 41; satisfy_hunger → flee: 39.

Final mean hunger/thirst/energy: 0.6931 / 0.3611 / 0.6917; injured creatures: 11/12; food sources: 1. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Actions: move: 3863 (53.7%); search: 1186 (16.5%); sleep: 816 (11.3%); explore: 699 (9.7%); drink: 339 (4.7%); eat: 219 (3.0%); fight: 78 (1.1%).

Intentions: satisfy_hunger: 2119 (29.4%); rest: 2085 (29.0%); satisfy_thirst: 953 (13.2%); investigate_signal: 769 (10.7%); explore: 699 (9.7%); flee: 404 (5.6%); hunt: 162 (2.3%); announce_resource: 9 (0.1%).

Most frequent rapid transition pairs: flee → rest: 228; rest → flee: 216; rest → satisfy_hunger: 188; satisfy_hunger → rest: 162; flee → satisfy_thirst: 75.

Final mean hunger/thirst/energy: 0.6255 / 0.3904 / 0.6642; injured creatures: 6/12; food sources: 2. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs of seed `demo` produced identical complete-state trajectory SHA-256: `45e2c3c4df2bbcfe46bbbb42b4de00b7a9bac135339f79990c9f354562f79409`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Hunger pressure remains high for 35.8–37.4% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.

## Reproduction configuration

```json
{
	"ecology": {
		"wildlifeCount": 6,
		"dayLengthSeconds": 180,
		"wildlifeSensingRadius": 3.5,
		"wildlifeSpeed": 0.65,
		"encounterDistance": 0.65,
		"attackCooldownSeconds": 2,
		"attackDamage": 0.12,
		"attackEnergyCost": 0.035,
		"movementEnergyCostPerUnit": 0.005,
		"activityHungerCostPerSecond": 0.002,
		"injuryRecoveryPerSecond": 0.006,
		"carcassFoodPerSize": 1.2,
		"carcassDecayPerSecond": 0.002,
		"wildlifeEnergyDrainPerSecond": 0.003,
		"wildlifeRestRecoveryPerSecond": 0.012,
		"encounterHistoryLimit": 32
	},
	"habitat": {
		"worldWidth": 20,
		"worldHeight": 14,
		"foodCount": 5,
		"waterCount": 2,
		"homeSize": {
			"minWidth": 2.2,
			"maxWidth": 3.2,
			"minHeight": 1.8,
			"maxHeight": 2.6
		},
		"foodSize": {
			"minWidth": 0.7,
			"maxWidth": 1.1,
			"minHeight": 0.7,
			"maxHeight": 1.1
		},
		"waterSize": {
			"minWidth": 1.6,
			"maxWidth": 2.8,
			"minHeight": 1.2,
			"maxHeight": 2.2
		},
		"minSpacing": 0.6,
		"maxPlacementAttempts": 80,
		"foodCapacity": 1.5,
		"waterCapacity": 12
	},
	"creatureCount": 12,
	"movementSpeed": {
		"min": 0.85,
		"max": 1.35
	},
	"maxTurnRate": 3.141592653589793,
	"creatureRadius": 0.25,
	"fixedDt": 0.03333333333333333,
	"maxCatchUpSteps": 6,
	"arrivalDistance": 0.35,
	"hungerRisePerSecond": 0.012,
	"thirstRisePerSecond": 0.014,
	"energyDrainPerSecond": 0.008,
	"eatRecoveryPerSecond": 0.25,
	"drinkRecoveryPerSecond": 0.28,
	"sleepRecoveryPerSecond": 0.2,
	"seekFoodThreshold": 0.45,
	"seekWaterThreshold": 0.45,
	"restThreshold": 0.4,
	"exploreBaseline": 0.3,
	"signalBaseline": 0.38,
	"signalRecencyBoostMax": 0.04,
	"announceBaseline": 0.44,
	"continuityBonus": 0.05,
	"targetQualityVisible": 1,
	"targetQualityRemembered": 0.7,
	"targetQualitySearch": 0.35,
	"explorationCellSize": 2,
	"explorationDistanceWeight": 1,
	"explorationStalenessWeight": 1,
	"explorationStalenessScaleSeconds": 30,
	"reconsiderIntervalSeconds": 1.5,
	"eatUntilHunger": 0.12,
	"drinkUntilThirst": 0.12,
	"sleepUntilEnergy": 0.9,
	"decisionHistoryLimit": 10,
	"sensingRadius": 3,
	"perceptionIntervalSeconds": 0.25,
	"resourceAnnouncementClarityMargin": 0.75,
	"speakingPositionSearchRadius": 2.5,
	"speakingPositionSearchResolution": 3,
	"recentAnnouncementOutcomeHistoryLimit": 8,
	"symbolInventory": ["glyph-0", "glyph-1", "glyph-2", "glyph-3"],
	"hearingRadius": 12,
	"signalLifetimeSeconds": 1.5,
	"emissionCooldownSeconds": 4,
	"recentEmittedHistoryLimit": 8,
	"recentHeardHistoryLimit": 8,
	"recentSimulationEmissionHistoryLimit": 24,
	"recentEmissionDiagnosticsWindowSeconds": 30,
	"memoryCapacityRange": {
		"min": 8,
		"max": 16
	},
	"investigationDistanceScale": 8,
	"learningEvidenceRadius": 3,
	"associationReinforcement": 0.25,
	"noEvidenceConfidenceReduction": 0,
	"learningHistoryLimit": 8,
	"associationStrengthMin": 0,
	"associationStrengthMax": 1,
	"lexiconAssignmentMinStrength": 0.15,
	"lexiconAssignmentMinEvidenceCount": 1,
	"lexiconHistoryLimit": 12,
	"initialHunger": 0.2,
	"initialThirst": 0.2,
	"initialEnergy": 0.85,
	"maxActiveFoodSources": 5,
	"foodSpawnIntervalSeconds": 18,
	"rainIntervalMinSeconds": 45,
	"rainIntervalMaxSeconds": 75,
	"rainDurationSeconds": 4,
	"seed": "demo"
}
```
