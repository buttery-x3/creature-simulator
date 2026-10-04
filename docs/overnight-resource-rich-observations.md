# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 12:08 a.m. with `node scripts/overnight-observation.mjs docs/overnight-resource-rich-observations.md 900 resource-rich`. Source HEAD: `0a9325d21b7caa598e54f63976ffbcccd5d6f01c`; working-source SHA-256: `c94900b94c69a40123222f1c301a61bd886e2557054fdbab5f253e156cfd54fa`.

Scenario preset: `resource-rich`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the resource-rich creation preset and default fixed timestep, 900 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 6 / 5–19 |          9 / 15 |              3 |          12878.6 |               none |
| overnight-river   |                        12 / 1 / 1–14 |          3 / 14 |              2 |        9480.5667 |               none |
| overnight-drought |                        12 / 3 / 3–18 |          7 / 16 |              2 |          11754.2 |               none |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    5.1182 |              15 / 7 |                       5 / 2 |                        312 / 2.5911 |                       0 / 0 |
| overnight-river   |    4.0705 |             0 / 120 |                       0 / 4 |                               0 / 0 |                       2 / 0 |
| overnight-drought |    4.9747 |              5 / 20 |                       0 / 2 |                               0 / 0 |                       2 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1117–1 |       0.1109–1 |  0.0587–0.9066 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1117–1 |       0.1109–1 |       0–0.9061 |            0–1 |                   16 / 16 |
| overnight-drought |       0.1117–1 |       0.1109–1 |  0.0431–0.9066 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                        851.3667 / 110.7333 |                                80.8 / 15.9 |                      0 |      3217 / 1192 |                         4 |
| overnight-river   |                               144.4 / 40.5 |                         241.6333 / 76.1333 |                10.0333 |      2765 / 1161 |                         3 |
| overnight-drought |                           556.1 / 110.9333 |                         986.5667 / 77.9667 |                      1 |       2758 / 999 |                         3 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                        80 / 18 |                                  72 / 106 / 338 |                        3 / 10 |                  16 / 4 |                0 |
| overnight-river   |                        50 / 36 |                                 113 / 155 / 321 |                        1 / 14 |                  13 / 4 |                0 |
| overnight-drought |                        60 / 34 |                                  88 / 105 / 353 |                        2 / 12 |                  16 / 3 |                0 |

### demo

Death causes: age: 12 (80.0%); deprivation: 3 (20.0%). Courtship failures: timeout: 10 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2989 (67.5%); bound: 1146 (25.9%); ambiguous: 294 (6.6%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 2, food 1, water 1, danger 0, approach 1; generation 2, alive 3, food 3, water 3, danger 0, approach 2; generation 3, alive 1, food 1, water 1, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 6.6107% / 0.6274% / 0% of alive creature-time.

Actions: move: 7365 (57.2%); explore: 1864 (14.5%); sleep: 937 (7.3%); search: 758 (5.9%); eat: 591 (4.6%); drink: 590 (4.6%); court: 550 (4.3%); dance: 130 (1.0%); cry: 68 (0.5%); fight: 17 (0.1%); investigate: 3 (0.0%).

Innate expression starts: dance: 223; cry: 67. Maximum retained relationships: 8; current observed peers: 16.

Intentions: investigate_signal: 3543 (27.5%); satisfy_hunger: 2563 (19.9%); satisfy_thirst: 1912 (14.9%); explore: 1864 (14.5%); rest: 1279 (9.9%); court_peer: 847 (6.6%); announce_resource: 494 (3.8%); dance: 130 (1.0%); avoid_danger: 93 (0.7%); cry: 68 (0.5%); hunt: 37 (0.3%); flee: 22 (0.2%); approach_peer: 19 (0.1%); warn_danger: 2 (0.0%).

Most frequent rapid transition pairs: rest → explore: 92; dance → explore: 84; rest → investigate_signal: 71; announce_resource → explore: 56; rest → satisfy_hunger: 47.

Final mean hunger/thirst/energy: 0.3782 / 0.3347 / 0.6533; injured creatures: 4/6; food sources: 10. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: age: 11 (78.6%); deprivation: 2 (14.3%); injury: 1 (7.1%). Courtship failures: timeout: 5 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2954 (63.0%); bound: 1318 (28.1%); ambiguous: 415 (8.9%); budget: 1 (0.0%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 1, food 1, water 1, danger 1, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 1.5231% / 2.5487% / 0.1058% of alive creature-time.

Actions: move: 6373 (67.3%); sleep: 733 (7.7%); explore: 732 (7.7%); eat: 470 (5.0%); drink: 422 (4.5%); court: 398 (4.2%); search: 249 (2.6%); dance: 60 (0.6%); cry: 38 (0.4%); investigate: 1 (0.0%).

Innate expression starts: dance: 137; cry: 39. Maximum retained relationships: 8; current observed peers: 13.

Intentions: investigate_signal: 3474 (36.7%); satisfy_hunger: 1387 (14.6%); satisfy_thirst: 1226 (12.9%); rest: 804 (8.5%); explore: 732 (7.7%); court_peer: 656 (6.9%); announce_resource: 590 (6.2%); flee: 395 (4.2%); avoid_danger: 92 (1.0%); dance: 60 (0.6%); cry: 38 (0.4%); warn_danger: 22 (0.2%).

Most frequent rapid transition pairs: rest → investigate_signal: 113; warn_danger → flee: 88; satisfy_hunger → investigate_signal: 50; rest → explore: 48; announce_resource → explore: 45.

Final mean hunger/thirst/energy: 0.1691 / 0.4367 / 0.7673; injured creatures: 1/1; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: age: 9 (56.3%); deprivation: 7 (43.8%). Courtship failures: timeout: 1 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2987 (71.3%); bound: 1013 (24.2%); ambiguous: 190 (4.5%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 1, food 1, water 0, danger 1, approach 1; generation 2, alive 2, food 2, water 1, danger 0, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 4.7311% / 8.3933% / 0.0085% of alive creature-time.

Actions: move: 6804 (57.9%); explore: 1338 (11.4%); search: 1192 (10.1%); sleep: 880 (7.5%); eat: 579 (4.9%); drink: 480 (4.1%); court: 356 (3.0%); dance: 75 (0.6%); cry: 42 (0.4%); fight: 4 (0.0%).

Innate expression starts: dance: 152; cry: 43. Maximum retained relationships: 8; current observed peers: 16.

Intentions: investigate_signal: 3823 (32.5%); satisfy_thirst: 2135 (18.2%); satisfy_hunger: 2048 (17.4%); explore: 1338 (11.4%); rest: 1109 (9.4%); court_peer: 606 (5.2%); announce_resource: 490 (4.2%); dance: 75 (0.6%); flee: 54 (0.5%); cry: 42 (0.4%); hunt: 12 (0.1%); avoid_danger: 10 (0.1%); warn_danger: 8 (0.1%).

Most frequent rapid transition pairs: rest → investigate_signal: 77; rest → explore: 64; announce_resource → explore: 58; dance → explore: 51; announce_resource → investigate_signal: 51.

Final mean hunger/thirst/energy: 0.3254 / 0.4796 / 0.6437; injured creatures: 2/3; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `bdc2f4753cd88873c66a22bb9872f25d9e0ba84c48f5858161adeb76753f508e`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Need-pressure ratios measure time alive, not survival success: death can lower total unmet-need time. Births, deaths, surviving population and generation reach must be read alongside those ratios. Same-runtime repeatability does not guarantee identical long trajectories across JavaScript engines; browser/Node floating-point differences were observed in the preceding social checkpoint.

## Run configuration

```json
{
	"ecology": {
		"wildlifeCount": 2,
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
		"foodCount": 8,
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
	"maxActiveFoodSources": 12,
	"foodSpawnIntervalSeconds": 8,
	"rainIntervalMinSeconds": 45,
	"rainIntervalMaxSeconds": 75,
	"rainDurationSeconds": 4,
	"seed": "demo"
}
```
