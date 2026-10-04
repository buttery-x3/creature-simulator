# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 12:23 a.m. with `node scripts/overnight-observation.mjs docs/overnight-follow-baseline-observations.md 600 baseline`. Source HEAD: `115b39525416566b9cce1b6115aa36f8601da7a8`; working-source SHA-256: `98d63ef332a1fb0357062bbdf49c2bd343c808735787abb42792bee70da3d47b`.

Scenario preset: `baseline`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the baseline creation preset and default fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 2 / 2–14 |          2 / 12 |              1 |        6906.1667 |               none |
| overnight-river   |                        12 / 0 / 0–12 |          0 / 12 |              0 |           4416.2 |              589.4 |
| overnight-drought |                        12 / 3 / 3–12 |          1 / 10 |              1 |           5593.6 |               none |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    3.0552 |            14 / 144 |                     13 / 18 |                         485 / 4.034 |                       2 / 0 |
| overnight-river   |    1.7871 |             4 / 267 |                      3 / 31 |                        105 / 0.8716 |                       5 / 0 |
| overnight-drought |    2.1341 |            21 / 227 |                     13 / 25 |                        569 / 4.7199 |                       2 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1118–1 |       0.1109–1 |       0–0.9065 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1117–1 |        0.111–1 |       0–0.9066 |       0.0001–1 |                   15 / 15 |
| overnight-drought |        0.112–1 |       0.1109–1 |       0–0.9066 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                               2520.3 / 295 |                              170 / 24.5333 |                  123.1 |       1821 / 841 |                         2 |
| overnight-river   |                       1032.3667 / 105.6333 |                        1039.8333 / 92.9667 |                91.7333 |       1475 / 767 |                         2 |
| overnight-drought |                           1201.9667 / 98.3 |                        748.9333 / 191.6667 |                19.1333 |       1825 / 880 |                         1 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                         23 / 7 |                                   32 / 93 / 294 |                         1 / 4 |                  13 / 4 |                0 |
| overnight-river   |                          9 / 2 |                                   13 / 59 / 224 |                         0 / 2 |                  11 / 4 |                0 |
| overnight-drought |                        34 / 20 |                                   30 / 72 / 204 |                         1 / 4 |                  11 / 4 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes                           |
| ----------------- | -------------------------: | ----------------------: | ---------------: | --------------------------------------------------- |
| demo              |                    1 / 0.8 |           0.8s / 0.2649 |                0 | turn_back: 1                                        |
| overnight-river   |                      0 / 0 |                  0s / 0 |                0 | none                                                |
| overnight-drought |                6 / 13.6333 |             4s / 4.1415 |                0 | visible_chain: 2; interrupted: 3; resource_found: 1 |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: age: 7 (58.3%); deprivation: 5 (41.7%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1318 (64.9%); bound: 632 (31.1%); ambiguous: 80 (3.9%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 1, food 1, water 1, danger 1, approach 1; generation 1, alive 1, food 1, water 1, danger 1, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 36.4935% / 2.4616% / 1.7825% of alive creature-time.

Actions: move: 3029 (43.9%); search: 2006 (29.1%); explore: 593 (8.6%); sleep: 508 (7.4%); drink: 306 (4.4%); eat: 205 (3.0%); court: 159 (2.3%); fight: 60 (0.9%); dance: 26 (0.4%); cry: 7 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 56; cry: 8. Maximum retained relationships: 8; current observed peers: 13.

Intentions: satisfy_hunger: 2663 (38.6%); investigate_signal: 1292 (18.7%); satisfy_thirst: 811 (11.8%); explore: 593 (8.6%); rest: 557 (8.1%); flee: 310 (4.5%); court_peer: 248 (3.6%); avoid_danger: 226 (3.3%); hunt: 104 (1.5%); announce_resource: 37 (0.5%); dance: 26 (0.4%); warn_danger: 25 (0.4%); cry: 7 (0.1%); follow_peer: 1 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 107; rest → satisfy_hunger: 61; rest → satisfy_thirst: 43; flee → satisfy_hunger: 43; satisfy_thirst → satisfy_hunger: 35.

Final mean hunger/thirst/energy: 0.1585 / 0.2722 / 0.5753; injured creatures: 2/2; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: injury: 7 (58.3%); deprivation: 3 (25.0%); age: 2 (16.7%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1334 (73.1%); bound: 457 (25.1%); ambiguous: 32 (1.8%); budget: 1 (0.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 23.3768% / 23.5459% / 2.0772% of alive creature-time.

Actions: move: 2718 (61.6%); search: 904 (20.5%); sleep: 306 (6.9%); eat: 156 (3.5%); explore: 136 (3.1%); drink: 132 (3.0%); court: 35 (0.8%); fight: 14 (0.3%); cry: 7 (0.2%); dance: 3 (0.1%).

Innate expression starts: dance: 11; cry: 6. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1006 (22.8%); flee: 888 (20.1%); satisfy_thirst: 868 (19.7%); investigate_signal: 816 (18.5%); rest: 332 (7.5%); avoid_danger: 176 (4.0%); explore: 136 (3.1%); court_peer: 62 (1.4%); warn_danger: 50 (1.1%); hunt: 36 (0.8%); announce_resource: 31 (0.7%); cry: 7 (0.2%); dance: 3 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 216; rest → satisfy_hunger: 46; flee → satisfy_thirst: 34; rest → satisfy_thirst: 31; satisfy_hunger → warn_danger: 25.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: age: 4 (40.0%); injury: 3 (30.0%); deprivation: 3 (30.0%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1178 (66.2%); bound: 521 (29.3%); ambiguous: 78 (4.4%); budget: 2 (0.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 2, food 0, water 2, danger 2, approach 1; generation 1, alive 1, food 0, water 1, danger 1, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 21.4882% / 13.3891% / 0.3421% of alive creature-time.

Actions: move: 3236 (57.9%); search: 1076 (19.2%); sleep: 387 (6.9%); explore: 282 (5.0%); drink: 207 (3.7%); eat: 196 (3.5%); court: 128 (2.3%); fight: 66 (1.2%); dance: 8 (0.1%); cry: 5 (0.1%).

Innate expression starts: dance: 36; cry: 5. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1273 (22.8%); satisfy_thirst: 1141 (20.4%); investigate_signal: 820 (14.7%); flee: 804 (14.4%); rest: 493 (8.8%); avoid_danger: 344 (6.2%); explore: 282 (5.0%); court_peer: 202 (3.6%); hunt: 121 (2.2%); warn_danger: 52 (0.9%); approach_peer: 19 (0.3%); follow_peer: 16 (0.3%); announce_resource: 11 (0.2%); dance: 8 (0.1%); cry: 5 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 181; rest → satisfy_thirst: 42; rest → investigate_signal: 38; flee → satisfy_thirst: 34; rest → satisfy_hunger: 33.

Final mean hunger/thirst/energy: 0.3543 / 0.7936 / 0.6247; injured creatures: 3/3; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `210d7928a3fb3984c5b090f1da3a1eba6a31bd4915947c0496a55377039787b4`. Summary metrics also matched after excluding wall-clock runtime.

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
