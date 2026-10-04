# Overnight lifecycle and ecology observation

Run on October 5, 2026 at 1:32 a.m. with `node scripts/overnight-observation.mjs docs/overnight-search-rich-observations.md 900 resource-rich`. Source HEAD: `2f42d466d6cea685018f5ddfb1194e6fc05f465b`; working-source SHA-256: `89e700dfc53a26cd696e3339ec7f2464417242d35f8d615bd08706d201de89da`.

Scenario preset: `resource-rich`. The full creation configuration is recorded below; a preset changes initial experiment configuration only and adds no runtime rescue.

## Method

Three fixed seeds, the resource-rich creation preset and default fixed timestep, 900 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause, failed-courtship, movement-learning and approach-call counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. Learning records are also deduplicated by listener, emission and outcome within the step; emissions by ID. Approach-call totals are exact: they use newly emitted active events, which have validated positive lifetime and no count cap. Recent-emission history saturation remains a separate diagnostic and does not truncate these totals. Other retained detail totals can be lower bounds when their histories saturate; learning immediately preceding same-step death can also be absent from survivor history. Binding counts sample only the latest binding per listener per step. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted. Movement outcomes concern any heard form paired with local motion, including resource or danger emissions; approach-call counts concern only the observer-labelled approach emission context. A confirmed sequence is local evidence, not proof of the sender intention.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 4 / 4–17 |          6 / 14 |              3 |       11161.6333 |               none |
| overnight-river   |                        12 / 4 / 4–15 |          5 / 13 |              3 |       10163.8333 |               none |
| overnight-drought |                        12 / 4 / 4–17 |          7 / 15 |              3 |       11356.5333 |               none |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    4.6545 |              1 / 49 |                       3 / 5 |                         31 / 0.2583 |                       1 / 1 |
| overnight-river   |    3.7505 |             1 / 124 |                       0 / 5 |                               0 / 0 |                       2 / 0 |
| overnight-drought |    3.6615 |              0 / 22 |                       0 / 0 |                               0 / 0 |                       2 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1117–1 |       0.1109–1 |       0–0.9065 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1117–1 |       0.1109–1 |       0–0.9063 |            0–1 |                   16 / 16 |
| overnight-drought |       0.1118–1 |       0.1107–1 |  0.0398–0.9066 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                            222.7 / 58.6333 |                            172.2 / 63.5333 |                36.7333 |      3004 / 1132 |                         3 |
| overnight-river   |                            114.2 / 21.5333 |                            212.6 / 81.3333 |                19.7667 |      2985 / 1264 |                         3 |
| overnight-drought |                            298.3667 / 39.1 |                               456.3 / 47.8 |                 1.3667 |       2812 / 987 |                         3 |

| Seed              | Approach calls / learned calls | Confirmed / contradicted / unobserved sequences | Approach carriers final / max | Encounter / pending max | Bound violations |
| ----------------- | -----------------------------: | ----------------------------------------------: | ----------------------------: | ----------------------: | ---------------: |
| demo              |                        98 / 47 |                                  97 / 147 / 307 |                        2 / 12 |                  16 / 4 |                0 |
| overnight-river   |                        45 / 32 |                                 110 / 130 / 351 |                        3 / 12 |                  14 / 3 |                0 |
| overnight-drought |                        58 / 26 |                                  90 / 107 / 358 |                        2 / 14 |                  16 / 3 |                0 |

| Seed              | Follow starts / creature-s | Longest duration / path | Bound violations | Retained episode outcomes                       |
| ----------------- | -------------------------: | ----------------------: | ---------------: | ----------------------------------------------- |
| demo              |                   7 / 18.8 |        4.6667s / 3.3144 |                0 | turn_back: 3; visible_chain: 3; interrupted: 1  |
| overnight-river   |                 4 / 8.4667 |        5.0667s / 3.0185 |                0 | turn_back: 1; visible_chain: 2; interrupted: 1  |
| overnight-drought |                4 / 15.1667 |         5.8667s / 5.104 |                0 | turn_back: 2; visible_chain: 1; lost_contact: 1 |

Following is physical companionship, not a learned translation. Starts and outcomes sample surviving creatures at step end; an episode beginning and ending or a creature dying within that step can be absent. Duration includes spacing pauses. The resource_found outcome means a visible resource won arbitration; it does not prove a new discovery or that the companion caused it. Following does not itself credit a speaker with helpfulness or transfer resource knowledge.

### demo

Death causes: age: 13 (92.9%); injury: 1 (7.1%). Courtship failures: timeout: 20 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 3075 (63.0%); bound: 1423 (29.2%); ambiguous: 382 (7.8%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 1, food 1, water 1, danger 0, approach 1; generation 2, alive 1, food 1, water 0, danger 0, approach 0; generation 3, alive 2, food 2, water 2, danger 0, approach 1. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 1.9952% / 1.5428% / 0.3291% of alive creature-time.

Actions: move: 6398 (57.3%); explore: 1659 (14.9%); court: 846 (7.6%); sleep: 830 (7.4%); eat: 553 (5.0%); drink: 514 (4.6%); search: 181 (1.6%); dance: 93 (0.8%); cry: 76 (0.7%); fight: 6 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 239; cry: 73. Maximum retained relationships: 8; current observed peers: 14.

Intentions: investigate_signal: 2707 (24.3%); satisfy_hunger: 1755 (15.7%); explore: 1659 (14.9%); satisfy_thirst: 1569 (14.1%); court_peer: 1301 (11.7%); rest: 1089 (9.8%); announce_resource: 595 (5.3%); flee: 190 (1.7%); dance: 93 (0.8%); avoid_danger: 81 (0.7%); cry: 76 (0.7%); follow_peer: 18 (0.2%); warn_danger: 14 (0.1%); hunt: 9 (0.1%); approach_peer: 1 (0.0%).

Most frequent rapid transition pairs: dance → explore: 68; rest → explore: 67; rest → investigate_signal: 58; explore → announce_resource: 55; announce_resource → explore: 50.

Final mean hunger/thirst/energy: 0.4277 / 0.5017 / 0.6476; injured creatures: 2/4; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: age: 10 (76.9%); deprivation: 2 (15.4%); injury: 1 (7.7%). Courtship failures: timeout: 2 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 3335 (69.0%); bound: 1225 (25.3%); ambiguous: 275 (5.7%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 1, alive 2, food 2, water 2, danger 2, approach 2; generation 2, alive 1, food 1, water 1, danger 0, approach 1; generation 3, alive 1, food 1, water 1, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 1.1236% / 2.0917% / 0.1945% of alive creature-time.

Actions: move: 7040 (69.3%); sleep: 778 (7.7%); explore: 777 (7.6%); eat: 530 (5.2%); drink: 458 (4.5%); court: 315 (3.1%); search: 161 (1.6%); dance: 58 (0.6%); cry: 40 (0.4%); investigate: 3 (0.0%).

Innate expression starts: dance: 121; cry: 40. Maximum retained relationships: 8; current observed peers: 13.

Intentions: investigate_signal: 3702 (36.4%); satisfy_hunger: 1573 (15.5%); satisfy_thirst: 1404 (13.8%); rest: 871 (8.6%); explore: 777 (7.6%); announce_resource: 558 (5.5%); court_peer: 550 (5.4%); flee: 422 (4.2%); avoid_danger: 169 (1.7%); dance: 58 (0.6%); cry: 40 (0.4%); warn_danger: 25 (0.2%); follow_peer: 8 (0.1%); approach_peer: 2 (0.0%); hunt: 1 (0.0%).

Most frequent rapid transition pairs: rest → investigate_signal: 111; warn_danger → flee: 89; rest → explore: 75; investigate_signal → satisfy_hunger: 60; satisfy_hunger → investigate_signal: 54.

Final mean hunger/thirst/energy: 0.3456 / 0.2645 / 0.6789; injured creatures: 2/4; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: age: 14 (93.3%); deprivation: 1 (6.7%). Courtship failures: timeout: 3 (100.0%). Saturated lifecycle-history steps: 0.

Latest local source bindings: unseen: 2558 (66.6%); bound: 1003 (26.1%); ambiguous: 279 (7.3%). Saturated learning / emission history steps: 0 / 0. Final retained meaning carriers by generation: generation 2, alive 3, food 3, water 3, danger 0, approach 2; generation 3, alive 1, food 1, water 0, danger 0, approach 0. These are personal assignments among survivors, not inherited meanings or a population dictionary.

High hunger / high thirst / exhaustion: 2.6273% / 4.018% / 0.012% of alive creature-time.

Actions: move: 7118 (62.7%); explore: 1273 (11.2%); sleep: 835 (7.4%); search: 586 (5.2%); eat: 569 (5.0%); drink: 513 (4.5%); court: 328 (2.9%); dance: 81 (0.7%); cry: 47 (0.4%); investigate: 1 (0.0%).

Innate expression starts: dance: 151; cry: 47. Maximum retained relationships: 8; current observed peers: 16.

Intentions: investigate_signal: 3952 (34.8%); satisfy_hunger: 1938 (17.1%); satisfy_thirst: 1777 (15.7%); explore: 1273 (11.2%); rest: 1181 (10.4%); court_peer: 505 (4.4%); announce_resource: 490 (4.3%); dance: 81 (0.7%); flee: 64 (0.6%); cry: 47 (0.4%); avoid_danger: 21 (0.2%); follow_peer: 15 (0.1%); warn_danger: 5 (0.0%); approach_peer: 2 (0.0%).

Most frequent rapid transition pairs: rest → investigate_signal: 80; announce_resource → explore: 59; rest → explore: 57; dance → explore: 53; explore → investigate_signal: 49.

Final mean hunger/thirst/energy: 0.2408 / 0.3403 / 0.7127; injured creatures: 2/4; food sources: 12. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

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
