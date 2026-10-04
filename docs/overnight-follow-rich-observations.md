# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 12:23 a.m. with `node scripts/overnight-observation.mjs docs/overnight-follow-rich-observations.md 900 resource-rich`. Source HEAD: `115b39525416566b9cce1b6115aa36f8601da7a8`; working-source SHA-256: `98d63ef332a1fb0357062bbdf49c2bd343c808735787abb42792bee70da3d47b`.

Scenario preset: `resource-rich`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the resource-rich creation preset and default fixed timestep, 900 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 6 / 5–16 |          7 / 13 |              4 |       11020.3333 |               none |
| overnight-river   |                        12 / 6 / 5–17 |          7 / 13 |              2 |          11029.3 |               none |
| overnight-drought |                        12 / 1 / 1–16 |          4 / 15 |              2 |           9384.4 |               none |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    5.1493 |              5 / 22 |                       4 / 1 |                        207 / 1.7196 |                       1 / 0 |
| overnight-river   |    4.8444 |             2 / 133 |                       4 / 8 |                             120 / 1 |                       1 / 0 |
| overnight-drought |    3.5557 |              3 / 51 |                       2 / 6 |                        103 / 0.8539 |                       1 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1117–1 |       0.1107–1 |  0.2115–0.9066 |            0–1 |                   16 / 16 |
| overnight-river   |       0.0928–1 |       0.1109–1 |       0–0.9065 |            0–1 |                   16 / 16 |
| overnight-drought |       0.1118–1 |       0.1109–1 |       0–0.9067 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                          40.5667 / 11.8333 |                             87.9 / 16.5667 |                      0 |      3051 / 1208 |                         3 |
| overnight-river   |                               282.9 / 51.4 |                            351.3 / 73.1667 |                19.0333 |      3155 / 1330 |                         3 |
| overnight-drought |                            198.6 / 39.1333 |                       1285.0333 / 133.4667 |                22.0333 |       2271 / 840 |                         3 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                       108 / 51 |                                  84 / 141 / 346 |                        2 / 12 |                  15 / 4 |                0 |
| overnight-river   |                        67 / 54 |                                 119 / 171 / 461 |                        5 / 14 |                  15 / 4 |                0 |
| overnight-drought |                        60 / 10 |                                   56 / 68 / 264 |                         1 / 7 |                  15 / 3 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes                                                                          |
| ----------------- | -------------------------: | ----------------------: | ---------------: | -------------------------------------------------------------------------------------------------- |
| demo              |                7 / 14.1667 |        3.4667s / 1.7607 |                0 | turn_back: 1; visible_chain: 1; interrupted: 1; lost_contact: 1; no_progress: 1; resource_found: 2 |
| overnight-river   |                      3 / 8 |        5.0667s / 3.0185 |                0 | turn_back: 1; resource_found: 1; lost_contact: 1                                                   |
| overnight-drought |                    2 / 8.4 |         5.8667s / 5.104 |                0 | turn_back: 1; resource_found: 1                                                                    |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: age: 13 (100.0%). Courtship failures: timeout: 27 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 3384 (63.2%); bound: 1459 (27.3%); ambiguous: 510 (9.5%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 2, food 2, water 1, danger 0, approach 1; generation 2, alive 1, food 0, water 1, danger 0, approach 1; generation 3, alive 2, food 2, water 2, danger 1, approach 0; generation 4, alive 1, food 0, water 0, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 0.3681% / 0.7976% / 0% of alive creature-time.

Actions: move: 6089 (55.3%); explore: 1744 (15.8%); court: 1001 (9.1%); sleep: 813 (7.4%); eat: 567 (5.1%); drink: 507 (4.6%); search: 105 (1.0%); dance: 102 (0.9%); cry: 76 (0.7%); fight: 14 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 272; cry: 76. Maximum retained relationships: 8; current observed peers: 14.

Intentions: investigate_signal: 2495 (22.6%); explore: 1744 (15.8%); satisfy_hunger: 1610 (14.6%); satisfy_thirst: 1588 (14.4%); court_peer: 1482 (13.4%); rest: 1060 (9.6%); announce_resource: 683 (6.2%); dance: 102 (0.9%); cry: 76 (0.7%); avoid_danger: 66 (0.6%); flee: 52 (0.5%); hunt: 30 (0.3%); follow_peer: 15 (0.1%); approach_peer: 12 (0.1%); warn_danger: 4 (0.0%).

Most frequent rapid transition pairs: rest → explore: 84; dance → explore: 69; announce_resource → explore: 62; rest → investigate_signal: 52; explore → announce_resource: 51.

Final mean hunger/thirst/energy: 0.3569 / 0.3951 / 0.7526; injured creatures: 2/6; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: age: 12 (92.3%); deprivation: 1 (7.7%). Courtship failures: timeout: 3 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 3808 (67.6%); bound: 1546 (27.4%); ambiguous: 280 (5.0%); budget: 1 (0.0%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 4, food 4, water 4, danger 4, approach 4; generation 2, alive 2, food 1, water 1, danger 0, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 2.565% / 3.1852% / 0.1726% of alive creature-time.

Actions: move: 7423 (67.3%); sleep: 848 (7.7%); explore: 813 (7.4%); eat: 549 (5.0%); drink: 513 (4.7%); search: 400 (3.6%); court: 372 (3.4%); dance: 59 (0.5%); cry: 35 (0.3%); fight: 10 (0.1%); investigate: 2 (0.0%).

Innate expression starts: dance: 130; cry: 33. Maximum retained relationships: 8; current observed peers: 15.

Intentions: investigate_signal: 4066 (36.9%); satisfy_hunger: 1702 (15.4%); satisfy_thirst: 1566 (14.2%); rest: 914 (8.3%); explore: 813 (7.4%); announce_resource: 616 (5.6%); court_peer: 594 (5.4%); flee: 433 (3.9%); avoid_danger: 175 (1.6%); dance: 59 (0.5%); cry: 35 (0.3%); warn_danger: 21 (0.2%); hunt: 15 (0.1%); follow_peer: 8 (0.1%); approach_peer: 7 (0.1%).

Most frequent rapid transition pairs: rest → investigate_signal: 117; warn_danger → flee: 103; rest → explore: 65; announce_resource → explore: 51; investigate_signal → satisfy_hunger: 49.

Final mean hunger/thirst/energy: 0.4287 / 0.3287 / 0.6392; injured creatures: 3/6; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: age: 11 (73.3%); deprivation: 4 (26.7%). Courtship failures: timeout: 5 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1972 (71.5%); bound: 664 (24.1%); ambiguous: 121 (4.4%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 2, alive 1, food 1, water 1, danger 1, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 2.1163% / 13.6933% / 0.2348% of alive creature-time.

Actions: move: 5189 (55.3%); search: 1116 (11.9%); explore: 1053 (11.2%); sleep: 683 (7.3%); eat: 468 (5.0%); court: 384 (4.1%); drink: 372 (4.0%); dance: 67 (0.7%); cry: 42 (0.4%); fight: 6 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 137; cry: 43. Maximum retained relationships: 8; current observed peers: 13.

Intentions: investigate_signal: 2621 (27.9%); satisfy_thirst: 2092 (22.3%); satisfy_hunger: 1369 (14.6%); explore: 1053 (11.2%); rest: 909 (9.7%); court_peer: 600 (6.4%); announce_resource: 401 (4.3%); flee: 145 (1.5%); dance: 67 (0.7%); avoid_danger: 58 (0.6%); cry: 42 (0.4%); hunt: 10 (0.1%); follow_peer: 9 (0.1%); warn_danger: 5 (0.1%).

Most frequent rapid transition pairs: rest → investigate_signal: 47; dance → explore: 45; satisfy_hunger → investigate_signal: 44; rest → satisfy_thirst: 42; rest → explore: 39.

Final mean hunger/thirst/energy: 0.2594 / 0.4041 / 0.6229; injured creatures: 1/1; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `7e6071bb7aa273a768b5ec0ceb64bce0162453212330c9e6a1d5443567c1d9d3`. Summary metrics also matched after excluding wall-clock runtime.

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
