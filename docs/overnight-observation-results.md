# Overnight lifecycle and ecology observation

Run on October 4, 2026 at 11:35 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `b517e3d7d2875fe5c58fb5d65a87c368c6dbb88b`; working-source SHA-256: `5f3e03aa6c5c4598ac9f517d76f85febadb133dff436d0ccd65916de6a8d47ab`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step. Alive creature-seconds integrate the post-step living population at each fixed timestep; need percentages use this same changing-population denominator. Empty-population final means are null.

Encounter, death-cause and failed-courtship counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes these detail totals lower bounds. Birth/death totals instead use live ID additions/removals and are not truncated by event-history capacity. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run includes growth, reciprocal courtship, birth, ageing and mortality. Population decline or extinction is reported directly; no rescue or ecological success criterion is imposed. Historical fixed-population pressure totals are not comparable to these dynamic-population measurements and are intentionally omitted.

## Results

| Seed              | Population initial / final / min–max | Births / deaths | Max generation | Alive creature-s | First extinction s |
| ----------------- | -----------------------------------: | --------------: | -------------: | ---------------: | -----------------: |
| demo              |                        12 / 4 / 4–14 |          2 / 10 |              1 |        6916.9333 |               none |
| overnight-river   |                        12 / 0 / 0–12 |          0 / 12 |              0 |        4121.9667 |           580.2667 |
| overnight-drought |                        12 / 0 / 0–12 |          0 / 12 |              0 |        3920.5333 |           463.7333 |

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    3.1222 |             19 / 97 |                     16 / 18 |                        402 / 3.3424 |                       2 / 1 |
| overnight-river   |    1.6538 |             3 / 225 |                      0 / 31 |                               0 / 0 |                       6 / 0 |
| overnight-drought |    1.5867 |            12 / 270 |                      6 / 28 |                         254 / 2.108 |                       4 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.0956–1 |       0.1109–1 |       0–0.9065 |            0–1 |                   16 / 16 |
| overnight-river   |       0.1119–1 |        0.111–1 |       0–0.9066 |            0–1 |                   15 / 15 |
| overnight-drought |       0.1125–1 |       0.1113–1 |       0–0.9051 |            0–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                       2447.7667 / 255.9333 |                             73.9 / 17.1333 |               110.9333 |       1712 / 730 |                         3 |
| overnight-river   |                       1196.8667 / 114.0333 |                        912.8333 / 107.1667 |                94.4667 |       1244 / 642 |                         2 |
| overnight-drought |                       1056.2333 / 106.2667 |                          1381.2333 / 141.5 |                93.8333 |       1380 / 737 |                         2 |

### demo

Death causes: deprivation: 5 (50.0%); age: 4 (40.0%); injury: 1 (10.0%). Courtship failures: timeout: 2 (100.0%). Saturated lifecycle-history steps: 0.

High hunger / high thirst / exhaustion: 35.388% / 1.0684% / 1.6038% of alive creature-time.

Actions: move: 2743 (39.7%); search: 2088 (30.2%); explore: 765 (11.1%); sleep: 519 (7.5%); drink: 315 (4.6%); eat: 202 (2.9%); court: 183 (2.6%); fight: 41 (0.6%); dance: 30 (0.4%); cry: 28 (0.4%).

Innate expression starts: dance: 65; cry: 31. Maximum retained relationships: 8; current observed peers: 13.

Intentions: satisfy_hunger: 2753 (39.8%); investigate_signal: 1026 (14.8%); satisfy_thirst: 894 (12.9%); explore: 765 (11.1%); rest: 606 (8.8%); court_peer: 304 (4.4%); flee: 269 (3.9%); hunt: 87 (1.3%); avoid_danger: 86 (1.2%); announce_resource: 45 (0.7%); dance: 30 (0.4%); cry: 28 (0.4%); warn_danger: 21 (0.3%).

Most frequent rapid transition pairs: warn_danger → flee: 80; rest → satisfy_hunger: 70; rest → explore: 42; satisfy_thirst → satisfy_hunger: 38; rest → investigate_signal: 33.

Final mean hunger/thirst/energy: 0.4039 / 0.3041 / 0.6612; injured creatures: 4/4; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Death causes: injury: 5 (41.7%); deprivation: 5 (41.7%); age: 2 (16.7%). Courtship failures: none. Saturated lifecycle-history steps: 0.

High hunger / high thirst / exhaustion: 29.0363% / 22.1456% / 2.2918% of alive creature-time.

Actions: move: 2472 (60.0%); search: 920 (22.3%); sleep: 269 (6.5%); explore: 157 (3.8%); eat: 138 (3.4%); drink: 132 (3.2%); court: 26 (0.6%); cry: 2 (0.0%); dance: 1 (0.0%).

Innate expression starts: dance: 5; cry: 2. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 1143 (27.8%); flee: 842 (20.5%); investigate_signal: 777 (18.9%); satisfy_thirst: 693 (16.8%); rest: 300 (7.3%); explore: 157 (3.8%); avoid_danger: 103 (2.5%); warn_danger: 40 (1.0%); court_peer: 37 (0.9%); announce_resource: 16 (0.4%); hunt: 6 (0.1%); cry: 2 (0.0%); dance: 1 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 184; rest → satisfy_hunger: 48; rest → satisfy_thirst: 34; flee → satisfy_hunger: 23; satisfy_thirst → warn_danger: 22.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Death causes: injury: 4 (33.3%); deprivation: 4 (33.3%); age: 4 (33.3%). Courtship failures: none. Saturated lifecycle-history steps: 0.

High hunger / high thirst / exhaustion: 26.9411% / 35.2308% / 2.3934% of alive creature-time.

Actions: move: 2215 (56.6%); search: 972 (24.8%); sleep: 276 (7.1%); explore: 185 (4.7%); eat: 124 (3.2%); drink: 101 (2.6%); fight: 27 (0.7%); cry: 11 (0.3%); dance: 3 (0.1%).

Innate expression starts: dance: 3; cry: 11. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_thirst: 958 (24.5%); flee: 927 (23.7%); satisfy_hunger: 832 (21.3%); investigate_signal: 342 (8.7%); rest: 314 (8.0%); avoid_danger: 230 (5.9%); explore: 185 (4.7%); hunt: 51 (1.3%); warn_danger: 46 (1.2%); announce_resource: 12 (0.3%); cry: 11 (0.3%); dance: 3 (0.1%); court_peer: 3 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 205; flee → satisfy_thirst: 43; rest → satisfy_thirst: 38; rest → satisfy_hunger: 34; satisfy_hunger → warn_danger: 28.

Final mean hunger/thirst/energy: null / null / null; injured creatures: 0/0; food sources: 5. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Determinism and interpretation

Two independent 60-second runs in Node v24.15.0 using the same source and seed `demo` produced identical complete-state trajectory SHA-256: `50df915771fbc6198f180cb4e715662292d7090226aa7fe82fc3de649273e864`. Summary metrics also matched after excluding wall-clock runtime.

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
