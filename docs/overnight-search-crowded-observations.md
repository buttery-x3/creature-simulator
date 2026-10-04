# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 1:29 a.m. with `node scripts/overnight-observation.mjs docs/overnight-search-crowded-observations.md 600 crowded`. Source HEAD: `2f42d466d6cea685018f5ddfb1194e6fc05f465b`; working-source SHA-256: `89e700dfc53a26cd696e3339ec7f2464417242d35f8d615bd08706d201de89da`.

Scenario preset: `crowded`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the crowded creation preset and default fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        32 / 2 / 2–32 |          0 / 30 |              0 |       13494.7667 |               none |
| overnight-river   |                        32 / 0 / 0–32 |          0 / 32 |              0 |       10508.1333 |              569.8 |
| overnight-drought |                        32 / 0 / 0–33 |          1 / 33 |              1 |       11948.5333 |              570.5 |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    6.6317 |             21 / 70 |                     18 / 14 |                        830 / 6.8803 |                       0 / 0 |
| overnight-river   |    4.8251 |            19 / 461 |                     12 / 40 |                        490 / 4.0726 |                       3 / 0 |
| overnight-drought |    5.7847 |            23 / 650 |                     16 / 27 |                        598 / 4.9697 |                       1 / 1 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1118–1 |       0.1109–1 |       0–0.9058 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1124–1 |       0.1109–1 |       0–0.9062 |            0–1 |                   16 / 16 |
| overnight-drought |       0.1163–1 |        0.111–1 |       0–0.9067 |            0–1 |                   16 / 16 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                            7916.0333 / 295 |                        2097.4667 / 67.9667 |                92.3667 |       2492 / 999 |                         2 |
| overnight-river   |                          5522.7 / 196.1667 |                          3106.8667 / 133.5 |               345.6333 |      3101 / 1631 |                         2 |
| overnight-drought |                          6977.5 / 268.5333 |                          3168.0333 / 129.3 |                  348.5 |      4092 / 2336 |                         1 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                          8 / 3 |                                   59 / 85 / 350 |                        1 / 10 |                  16 / 4 |                0 |
| overnight-river   |                          4 / 0 |                                  64 / 206 / 733 |                        0 / 10 |                  16 / 4 |                0 |
| overnight-drought |                          1 / 0 |                                 58 / 367 / 1626 |                         0 / 8 |                  16 / 4 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes |
| ----------------- | -------------------------: | ----------------------: | ---------------: | ------------------------- |
| demo              |                      0 / 0 |                  0s / 0 |                0 | none                      |
| overnight-river   |                      0 / 0 |                  0s / 0 |                0 | none                      |
| overnight-drought |                      0 / 0 |                  0s / 0 |                0 | none                      |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: deprivation: 21 (70.0%); age: 9 (30.0%). Courtship failures: timeout: 1 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2552 (75.9%); bound: 547 (16.3%); ambiguous: 260 (7.7%); budget: 2 (0.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 2, food 1, water 2, danger 2, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 58.66% / 15.5428% / 0.6845% of alive creature-time.

Actions: search: 6511 (48.3%); move: 4343 (32.2%); sleep: 1016 (7.5%); explore: 684 (5.1%); drink: 518 (3.8%); eat: 212 (1.6%); fight: 82 (0.6%); court: 63 (0.5%); cry: 30 (0.2%); dance: 21 (0.2%); investigate: 1 (0.0%).

Innate expression starts: dance: 36; cry: 30. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 6856 (50.9%); satisfy_thirst: 2140 (15.9%); investigate_signal: 2121 (15.7%); rest: 1071 (7.9%); explore: 684 (5.1%); flee: 154 (1.1%); hunt: 147 (1.1%); court_peer: 94 (0.7%); avoid_danger: 85 (0.6%); announce_resource: 70 (0.5%); cry: 30 (0.2%); dance: 21 (0.2%); warn_danger: 8 (0.1%).

Most frequent rapid transition pairs: rest → satisfy_hunger: 266; rest → satisfy_thirst: 58; warn_danger → flee: 52; rest → investigate_signal: 51; rest → explore: 41.

Final mean hunger/thirst/energy: 0.253 / 0.2559 / 0.5912; injured creatures: 2/2; food sources: 3. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: deprivation: 26 (81.3%); age: 4 (12.5%); injury: 2 (6.3%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 4682 (72.6%); bound: 1033 (16.0%); ambiguous: 704 (10.9%); budget: 26 (0.4%). Saturated learning / emission history steps: 0 / 1. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 52.5564% / 29.5663% / 3.2892% of alive creature-time.

Actions: move: 4760 (45.4%); search: 4033 (38.4%); sleep: 724 (6.9%); explore: 415 (4.0%); drink: 301 (2.9%); eat: 181 (1.7%); fight: 53 (0.5%); court: 17 (0.2%); dance: 4 (0.0%); cry: 4 (0.0%).

Innate expression starts: dance: 8; cry: 4. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 3994 (38.1%); satisfy_thirst: 1909 (18.2%); flee: 1504 (14.3%); investigate_signal: 1156 (11.0%); rest: 773 (7.4%); avoid_danger: 495 (4.7%); explore: 415 (4.0%); hunt: 106 (1.0%); warn_danger: 65 (0.6%); announce_resource: 38 (0.4%); court_peer: 29 (0.3%); dance: 4 (0.0%); cry: 4 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 364; rest → satisfy_hunger: 209; rest → satisfy_thirst: 89; flee → satisfy_hunger: 88; avoid_danger → satisfy_hunger: 57.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: deprivation: 23 (69.7%); age: 9 (27.3%); injury: 1 (3.0%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 9550 (77.1%); bound: 2056 (16.6%); ambiguous: 662 (5.3%); budget: 120 (1.0%). Saturated learning / emission history steps: 0 / 1. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 58.3963% / 26.514% / 2.9167% of alive creature-time.

Actions: search: 5111 (42.8%); move: 5096 (42.7%); sleep: 870 (7.3%); drink: 394 (3.3%); explore: 204 (1.7%); eat: 172 (1.4%); fight: 61 (0.5%); court: 12 (0.1%); cry: 11 (0.1%); dance: 2 (0.0%); investigate: 1 (0.0%).

Innate expression starts: dance: 5; cry: 12. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 5158 (43.2%); satisfy_thirst: 1788 (15.0%); flee: 1586 (13.3%); investigate_signal: 1502 (12.6%); rest: 968 (8.1%); avoid_danger: 448 (3.8%); explore: 204 (1.7%); hunt: 119 (1.0%); warn_danger: 86 (0.7%); announce_resource: 46 (0.4%); court_peer: 16 (0.1%); cry: 11 (0.1%); dance: 2 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 513; rest → satisfy_hunger: 278; flee → satisfy_hunger: 190; rest → satisfy_thirst: 102; rest → investigate_signal: 90.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `04d5299ce64f8ae50ae26bf950409956bf84fe5d40c88128b6a0e775cf182356`. Summary metrics also matched after excluding wall-clock runtime.

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
	"creatureCount": 32,
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
