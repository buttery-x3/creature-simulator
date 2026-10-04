# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 1:29 a.m. with `node scripts/overnight-observation.mjs docs/overnight-search-baseline-observations.md 600 baseline`. Source HEAD: `2f42d466d6cea685018f5ddfb1194e6fc05f465b`; working-source SHA-256: `89e700dfc53a26cd696e3339ec7f2464417242d35f8d615bd08706d201de89da`.

Scenario preset: `baseline`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the baseline creation preset and default fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 4 / 4–15 |          3 / 11 |              1 |           7257.8 |               none |
| overnight-river   |                        12 / 1 / 1–12 |          0 / 11 |              0 |        4558.3333 |               none |
| overnight-drought |                        12 / 5 / 5–12 |           2 / 9 |              2 |           6377.4 |               none |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    3.4133 |             18 / 97 |                     16 / 24 |                        686 / 5.6905 |                       1 / 0 |
| overnight-river   |    1.8775 |            10 / 228 |                      6 / 35 |                        264 / 2.1987 |                       4 / 0 |
| overnight-drought |    2.3476 |            26 / 118 |                     23 / 24 |                        789 / 6.5567 |                       0 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1015–1 |       0.1109–1 |       0–0.9066 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1118–1 |        0.111–1 |       0–0.9061 |            0–1 |                   15 / 15 |
| overnight-drought |       0.1033–1 |       0.1109–1 |       0–0.9066 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                          2400.0333 / 219.6 |                         216.1333 / 19.9333 |                   63.8 |       1626 / 626 |                         2 |
| overnight-river   |                          1068.3 / 109.1333 |                           745.9667 / 103.8 |                   43.9 |       1461 / 731 |                         2 |
| overnight-drought |                          1752.3 / 120.6667 |                            431.2 / 46.7667 |                11.8333 |       1536 / 639 |                         1 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                         17 / 1 |                                   20 / 57 / 179 |                         2 / 2 |                  13 / 3 |                0 |
| overnight-river   |                         14 / 7 |                                   21 / 47 / 209 |                         1 / 2 |                  11 / 4 |                0 |
| overnight-drought |                         18 / 4 |                                   18 / 51 / 159 |                         1 / 3 |                  11 / 4 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes |
| ----------------- | -------------------------: | ----------------------: | ---------------: | ------------------------- |
| demo              |                 2 / 1.7667 |        0.9333s / 0.4246 |                0 | turn_back: 1              |
| overnight-river   |                      0 / 0 |                  0s / 0 |                0 | none                      |
| overnight-drought |                      0 / 0 |                  0s / 0 |                0 | none                      |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: deprivation: 7 (63.6%); age: 4 (36.4%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1072 (73.3%); bound: 316 (21.6%); ambiguous: 74 (5.1%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 2, food 2, water 2, danger 1, approach 1; generation 1, alive 2, food 0, water 2, danger 1, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 33.0683% / 2.9779% / 0.8791% of alive creature-time.

Actions: move: 3394 (46.8%); search: 1881 (25.9%); explore: 690 (9.5%); sleep: 531 (7.3%); drink: 322 (4.4%); eat: 201 (2.8%); court: 121 (1.7%); fight: 57 (0.8%); dance: 36 (0.5%); cry: 19 (0.3%); investigate: 1 (0.0%).

Innate expression starts: dance: 60; cry: 20. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 2601 (35.9%); investigate_signal: 1571 (21.7%); satisfy_thirst: 988 (13.6%); explore: 690 (9.5%); rest: 612 (8.4%); flee: 278 (3.8%); court_peer: 227 (3.1%); hunt: 103 (1.4%); avoid_danger: 72 (1.0%); dance: 36 (0.5%); announce_resource: 36 (0.5%); cry: 19 (0.3%); warn_danger: 18 (0.2%); follow_peer: 2 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 84; rest → satisfy_hunger: 58; rest → investigate_signal: 41; rest → satisfy_thirst: 33; rest → explore: 32.

Final mean hunger/thirst/energy: 0.4682 / 0.3341 / 0.7404; injured creatures: 3/4; food sources: 3. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: injury: 6 (54.5%); age: 4 (36.4%); deprivation: 1 (9.1%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 1101 (70.8%); bound: 394 (25.4%); ambiguous: 59 (3.8%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 1, food 1, water 1, danger 1, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 23.4362% / 16.3649% / 0.9631% of alive creature-time.

Actions: move: 2748 (60.4%); search: 808 (17.7%); sleep: 323 (7.1%); explore: 238 (5.2%); drink: 166 (3.6%); eat: 152 (3.3%); court: 71 (1.6%); fight: 31 (0.7%); cry: 12 (0.3%); dance: 3 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 20; cry: 13. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1012 (22.2%); investigate_signal: 868 (19.1%); satisfy_thirst: 820 (18.0%); flee: 765 (16.8%); rest: 344 (7.6%); avoid_danger: 249 (5.5%); explore: 238 (5.2%); court_peer: 106 (2.3%); hunt: 77 (1.7%); warn_danger: 44 (1.0%); announce_resource: 15 (0.3%); cry: 12 (0.3%); dance: 3 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 188; rest → satisfy_hunger: 33; rest → investigate_signal: 28; rest → satisfy_thirst: 28; satisfy_thirst → warn_danger: 23.

Final mean hunger/thirst/energy: 0.4481 / 0.3369 / 0.7119; injured creatures: 1/1; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: deprivation: 4 (44.4%); age: 3 (33.3%); injury: 2 (22.2%). Courtship failures: timeout: 1 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 774 (68.8%); bound: 313 (27.8%); ambiguous: 38 (3.4%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 3, food 3, water 3, danger 3, approach 1; generation 1, alive 1, food 0, water 1, danger 1, approach 0; generation 2, alive 1, food 0, water 1, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 27.4767% / 6.7614% / 0.1856% of alive creature-time.

Actions: move: 3261 (51.2%); search: 1384 (21.7%); explore: 593 (9.3%); sleep: 481 (7.5%); drink: 266 (4.2%); eat: 189 (3.0%); court: 85 (1.3%); fight: 76 (1.2%); cry: 24 (0.4%); dance: 14 (0.2%).

Innate expression starts: dance: 32; cry: 25. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1993 (31.3%); investigate_signal: 1120 (17.6%); satisfy_thirst: 962 (15.1%); flee: 597 (9.4%); explore: 593 (9.3%); rest: 574 (9.0%); avoid_danger: 187 (2.9%); hunt: 152 (2.4%); court_peer: 129 (2.0%); cry: 24 (0.4%); warn_danger: 22 (0.3%); dance: 14 (0.2%); announce_resource: 6 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 100; rest → explore: 43; rest → satisfy_hunger: 36; rest → investigate_signal: 33; rest → satisfy_thirst: 27.

Final mean hunger/thirst/energy: 0.5191 / 0.4753 / 0.6046; injured creatures: 4/5; food sources: 2. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `b4b40e32992f2a41162008e8f551ed9e78d6bf422d124606d3c698d3650b4f92`. Summary metrics also matched after excluding wall-clock runtime.

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
