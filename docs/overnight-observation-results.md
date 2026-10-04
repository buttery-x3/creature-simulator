# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 12:00 a.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `9aee1c6ac91bb816c2abd2736b36454c537b7db6`; working-source SHA-256: `014859d1089bd79e7c91bebe21d7cc3e16a767a5569b229a269171836f1a6b08`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Saturated history steps make detail totals lower bounds, and learning immediately preceding same-step death can be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 5 / 5–14 |          3 / 10 |              2 |             6683 |               none |
| overnight-river   |                        12 / 1 / 1–12 |          1 / 12 |              1 |        4083.9667 |               none |
| overnight-drought |                        12 / 0 / 0–12 |          2 / 14 |              1 |        5169.1333 |           587.7333 |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    2.8424 |            22 / 107 |                     17 / 23 |                        679 / 5.6486 |                       1 / 0 |
| overnight-river   |    1.5802 |             1 / 250 |                      3 / 37 |                         71 / 0.5917 |                       5 / 0 |
| overnight-drought |    1.8712 |            18 / 259 |                      9 / 32 |                        345 / 2.8613 |                       3 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1117–1 |       0.1109–1 |       0–0.9066 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1117–1 |        0.111–1 |       0–0.9066 |            0–1 |                   16 / 16 |
| overnight-drought |       0.1119–1 |        0.111–1 |       0–0.9066 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                          1998.3667 / 188.9 |                            113.8333 / 19.6 |                  115.6 |       1773 / 764 |                         2 |
| overnight-river   |                              944.1 / 110.2 |                         960.5667 / 92.9667 |                88.0667 |       1344 / 688 |                         1 |
| overnight-drought |                             1409.3 / 155.2 |                       1068.9333 / 153.1333 |                   54.5 |       1737 / 923 |                         2 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                         22 / 0 |                                   24 / 94 / 258 |                         0 / 2 |                  13 / 4 |                0 |
| overnight-river   |                         11 / 0 |                                   11 / 54 / 212 |                         0 / 1 |                  11 / 4 |                0 |
| overnight-drought |                          9 / 2 |                                   28 / 81 / 243 |                         0 / 4 |                  11 / 4 |                0 |

### demo

Death causes: deprivation: 6 (60.0%); age: 4 (40.0%). Courtship failures: timeout: 4 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1277 (68.7%); bound: 498 (26.8%); ambiguous: 79 (4.3%); budget: 4 (0.2%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 3, food 3, water 3, danger 3, approach 0; generation 1, alive 1, food 0, water 1, danger 1, approach 0; generation 2, alive 1, food 0, water 1, danger 1, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 29.9022% / 1.7033% / 1.7298% of alive creature-time.

Actions: move: 3193 (47.8%); search: 1576 (23.6%); explore: 665 (10.0%); sleep: 489 (7.3%); drink: 281 (4.2%); eat: 203 (3.0%); court: 170 (2.5%); fight: 58 (0.9%); dance: 32 (0.5%); cry: 12 (0.2%).

Innate expression starts: dance: 64; cry: 14. Maximum retained relationships: 8; current observed peers: 12.

Intentions: satisfy_hunger: 2297 (34.4%); investigate_signal: 1266 (19.0%); satisfy_thirst: 827 (12.4%); explore: 665 (10.0%); rest: 576 (8.6%); flee: 345 (5.2%); court_peer: 260 (3.9%); avoid_danger: 221 (3.3%); hunt: 105 (1.6%); announce_resource: 51 (0.8%); dance: 32 (0.5%); warn_danger: 22 (0.3%); cry: 12 (0.2%).

Most frequent rapid transition pairs: warn_danger → flee: 85; rest → satisfy_hunger: 55; rest → investigate_signal: 47; rest → explore: 43; satisfy_thirst → satisfy_hunger: 31.

Final mean hunger/thirst/energy: 0.3799 / 0.3625 / 0.5678; injured creatures: 4/5; food sources: 4. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: injury: 7 (58.3%); deprivation: 3 (25.0%); age: 2 (16.7%). Courtship failures: timeout: 1 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1213 (73.2%); bound: 404 (24.4%); ambiguous: 38 (2.3%); budget: 1 (0.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 1, food 1, water 1, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 23.1172% / 23.5204% / 2.1564% of alive creature-time.

Actions: move: 2567 (62.9%); search: 718 (17.6%); sleep: 268 (6.6%); explore: 168 (4.1%); eat: 141 (3.5%); drink: 123 (3.0%); court: 70 (1.7%); fight: 12 (0.3%); cry: 8 (0.2%); dance: 4 (0.1%).

Innate expression starts: dance: 17; cry: 8. Maximum retained relationships: 8; current observed peers: 11.

Intentions: flee: 934 (22.9%); satisfy_hunger: 892 (21.9%); satisfy_thirst: 735 (18.0%); investigate_signal: 721 (17.7%); rest: 298 (7.3%); explore: 168 (4.1%); avoid_danger: 128 (3.1%); court_peer: 107 (2.6%); warn_danger: 42 (1.0%); hunt: 23 (0.6%); announce_resource: 19 (0.5%); cry: 8 (0.2%); dance: 4 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 202; rest → satisfy_hunger: 43; rest → satisfy_thirst: 28; flee → satisfy_thirst: 26; satisfy_hunger → warn_danger: 24.

Final mean hunger/thirst/energy: 0.8537 / 1 / 0.1798; injured creatures: 1/1; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: injury: 6 (42.9%); deprivation: 4 (28.6%); age: 4 (28.6%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1182 (65.2%); bound: 548 (30.2%); ambiguous: 82 (4.5%); budget: 2 (0.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 27.2638% / 20.6792% / 1.0543% of alive creature-time.

Actions: move: 2742 (53.1%); search: 1262 (24.4%); sleep: 373 (7.2%); explore: 321 (6.2%); drink: 178 (3.4%); eat: 160 (3.1%); court: 58 (1.1%); fight: 42 (0.8%); cry: 18 (0.3%); dance: 9 (0.2%).

Innate expression starts: dance: 19; cry: 20. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1351 (26.2%); satisfy_thirst: 1017 (19.7%); flee: 916 (17.7%); investigate_signal: 605 (11.7%); rest: 442 (8.6%); explore: 321 (6.2%); avoid_danger: 271 (5.2%); court_peer: 86 (1.7%); hunt: 81 (1.6%); warn_danger: 46 (0.9%); cry: 18 (0.3%); dance: 9 (0.2%).

Most frequent rapid transition pairs: warn_danger → flee: 211; rest → satisfy_hunger: 60; rest → satisfy_thirst: 42; satisfy_hunger → warn_danger: 37; flee → satisfy_hunger: 35.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `e46d1d0cf4af2c70f5b3963db45c739a1b1cf47de8adcece4c2ba2f0f397b83b`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Need-pressure ratios measure time alive, not survival success: death can lower total unmet-need time. Births, deaths, surviving population and generation reach must be read alongside those ratios. Same-runtime repeatability does not guarantee identical long trajectories across JavaScript engines; browser/Node floating-point differences were observed in the preceding social checkpoint.

## Run configuration

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
	"lifecycle": {
		"maturitySeconds": 90,
		"newbornBodyScale": 0.5,
		"initialAdultAgeMinSeconds": 90,
		"initialAdultAgeMaxSeconds": 240,
		"senescenceAgeSeconds": 540,
		"maxAgeSeconds": 900,
		"ageDamagePerSecond": 0.004,
		"deprivationThreshold": 0.95,
		"hungerGraceSeconds": 45,
		"thirstGraceSeconds": 25,
		"hungerDamagePerSecond": 0.004,
		"thirstDamagePerSecond": 0.006,
		"deprivationRecoveryRate": 2,
		"reproductionHealthMin": 0.6,
		"reproductionEnergyMin": 0.6,
		"reproductionNeedMax": 0.5,
		"courtshipDistance": 1,
		"mutualCourtshipSeconds": 3,
		"courtshipTimeoutSeconds": 6,
		"failedCourtshipCooldownSeconds": 15,
		"reproductionCooldownSeconds": 120,
		"reproductionEnergyCost": 0.2,
		"reproductionHungerCost": 0.15,
		"populationCap": 64,
		"eventHistoryLimit": 32
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
