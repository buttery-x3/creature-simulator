# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 12:23 a.m. with `node scripts/overnight-observation.mjs docs/overnight-follow-crowded-observations.md 600 crowded`. Source HEAD: `115b39525416566b9cce1b6115aa36f8601da7a8`; working-source SHA-256: `98d63ef332a1fb0357062bbdf49c2bd343c808735787abb42792bee70da3d47b`.

Scenario preset: `crowded`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the crowded creation preset and default fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        32 / 3 / 3–32 |          1 / 30 |              1 |       12768.5667 |               none |
| overnight-river   |                        32 / 0 / 0–32 |          0 / 32 |              0 |       10159.4667 |           584.9667 |
| overnight-drought |                        32 / 0 / 0–33 |          1 / 33 |              1 |        9895.4333 |           498.1667 |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    6.6738 |            29 / 102 |                     20 / 19 |                        769 / 6.3996 |                       0 / 0 |
| overnight-river   |    5.2181 |            18 / 713 |                     11 / 41 |                        504 / 4.1816 |                       3 / 0 |
| overnight-drought |    4.9305 |            10 / 651 |                      6 / 39 |                        171 / 1.4175 |                       4 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.0963–1 |       0.1109–1 |       0–0.9064 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1133–1 |        0.111–1 |       0–0.9047 |            0–1 |                   16 / 16 |
| overnight-drought |        0.112–1 |        0.111–1 |        0–0.906 |            0–1 |                   16 / 16 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                             7209.3 / 273.4 |                        2867.6333 / 74.2667 |               127.9333 |      2473 / 1116 |                         2 |
| overnight-river   |                       5554.3333 / 199.3333 |                          3374.2333 / 169.9 |               470.2667 |      4220 / 2764 |                         1 |
| overnight-drought |                       5560.8667 / 226.2667 |                       3373.9667 / 156.1667 |               411.5333 |      3763 / 2279 |                         3 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                         11 / 3 |                                  63 / 149 / 736 |                        2 / 10 |                  16 / 4 |                0 |
| overnight-river   |                          0 / 0 |                                 23 / 487 / 1961 |                         0 / 2 |                  16 / 4 |                0 |
| overnight-drought |                          3 / 0 |                                 50 / 365 / 1743 |                         0 / 9 |                  16 / 4 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes |
| ----------------- | -------------------------: | ----------------------: | ---------------: | ------------------------- |
| demo              |                      0 / 0 |                  0s / 0 |                0 | none                      |
| overnight-river   |                      0 / 0 |                  0s / 0 |                0 | none                      |
| overnight-drought |                      0 / 0 |                  0s / 0 |                0 | none                      |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: deprivation: 23 (76.7%); age: 7 (23.3%). Courtship failures: timeout: 1 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2394 (64.3%); bound: 867 (23.3%); ambiguous: 320 (8.6%); budget: 143 (3.8%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 0, alive 2, food 2, water 2, danger 2, approach 2; generation 1, alive 1, food 0, water 1, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 56.4613% / 22.4585% / 1.0019% of alive creature-time.

Actions: search: 6380 (50.0%); move: 3699 (29.0%); sleep: 952 (7.5%); explore: 863 (6.8%); drink: 453 (3.6%); eat: 208 (1.6%); court: 84 (0.7%); fight: 61 (0.5%); dance: 26 (0.2%); cry: 25 (0.2%).

Innate expression starts: dance: 49; cry: 24. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 6880 (54.0%); investigate_signal: 1841 (14.4%); satisfy_thirst: 1392 (10.9%); rest: 1084 (8.5%); explore: 863 (6.8%); flee: 185 (1.5%); court_peer: 135 (1.1%); avoid_danger: 127 (1.0%); hunt: 115 (0.9%); announce_resource: 68 (0.5%); dance: 26 (0.2%); cry: 25 (0.2%); warn_danger: 7 (0.1%); approach_peer: 3 (0.0%).

Most frequent rapid transition pairs: rest → satisfy_hunger: 286; warn_danger → flee: 79; satisfy_thirst → satisfy_hunger: 51; flee → satisfy_hunger: 45; rest → satisfy_thirst: 37.

Final mean hunger/thirst/energy: 0.3724 / 0.3007 / 0.7599; injured creatures: 3/3; food sources: 4. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: deprivation: 22 (68.8%); age: 6 (18.8%); injury: 4 (12.5%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 6823 (64.2%); bound: 2737 (25.7%); ambiguous: 879 (8.3%); budget: 194 (1.8%). Saturated learning / emission history steps: 0 / 1. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 54.6715% / 33.2127% / 4.6289% of alive creature-time.

Actions: move: 4866 (48.0%); search: 3867 (38.1%); sleep: 697 (6.9%); drink: 272 (2.7%); explore: 198 (2.0%); eat: 169 (1.7%); fight: 60 (0.6%); cry: 11 (0.1%).

Innate expression starts: cry: 11. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 3858 (38.0%); flee: 1700 (16.8%); satisfy_thirst: 1508 (14.9%); investigate_signal: 1164 (11.5%); avoid_danger: 778 (7.7%); rest: 710 (7.0%); explore: 198 (2.0%); hunt: 121 (1.2%); warn_danger: 83 (0.8%); cry: 11 (0.1%); announce_resource: 9 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 510; rest → satisfy_hunger: 211; flee → satisfy_hunger: 193; avoid_danger → satisfy_hunger: 146; rest → satisfy_thirst: 118.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: deprivation: 24 (72.7%); injury: 5 (15.2%); age: 4 (12.1%). Courtship failures: none. Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 7936 (71.2%); bound: 2505 (22.5%); ambiguous: 570 (5.1%); budget: 140 (1.3%). Saturated learning / emission history steps: 0 / 1. Final retained meaning carriers by generation: no survivors. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 56.1963% / 34.0962% / 4.1588% of alive creature-time.

Actions: move: 4314 (43.7%); search: 4244 (43.0%); sleep: 681 (6.9%); drink: 255 (2.6%); explore: 189 (1.9%); eat: 145 (1.5%); court: 28 (0.3%); fight: 16 (0.2%); cry: 4 (0.0%); dance: 1 (0.0%).

Innate expression starts: dance: 7; cry: 4. Maximum retained relationships: 8; current observed peers: 16.

Intentions: satisfy_hunger: 3939 (39.9%); flee: 1684 (17.0%); satisfy_thirst: 1630 (16.5%); investigate_signal: 886 (9.0%); rest: 744 (7.5%); avoid_danger: 550 (5.6%); explore: 189 (1.9%); announce_resource: 104 (1.1%); warn_danger: 75 (0.8%); hunt: 36 (0.4%); court_peer: 35 (0.4%); cry: 4 (0.0%); dance: 1 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 499; rest → satisfy_hunger: 249; flee → satisfy_hunger: 147; avoid_danger → satisfy_hunger: 93; satisfy_hunger → warn_danger: 92.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `91087201cbfdb9ab593c69076eec0312e126323de9a5582b35d28f1fa5678935`. Summary metrics also matched after excluding wall-clock runtime.

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
