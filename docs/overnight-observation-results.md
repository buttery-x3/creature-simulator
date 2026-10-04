# Overnight physical ecology observation

Run on October 4, 2026 at 11:09 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `7cb2638cfbfc719c5133ccfc641b628ecbc2ff6e`; working-source SHA-256: `414fe2db0ae1b83dcfb30f51a37a5a6b4c49986625cf3b5fc009d23de306c2c4`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.

Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run covers the current physical ecology and danger-behaviour slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.

## Results

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    1.8424 |             19 / 88 |                     11 / 20 |                         435 / 3.612 |                       2 / 1 |
| overnight-river   |    1.8474 |             9 / 361 |                      5 / 52 |                        106 / 0.8753 |                       5 / 0 |
| overnight-drought |    1.6539 |            14 / 275 |                     16 / 33 |                        439 / 3.6535 |                       1 / 2 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1118–1 |       0.1109–1 |       0–0.9065 |       0.4499–1 |                   16 / 16 |
| overnight-river   |       0.0995–1 |        0.111–1 |       0–0.9065 |         0.05–1 |                   15 / 15 |
| overnight-drought |       0.1122–1 |        0.111–1 |       0–0.9065 |         0.05–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                          2555.6 / 257.2667 |                            139.6 / 29.9667 |                  112.1 |       1702 / 701 |                         2 |
| overnight-river   |                       3466.6667 / 194.2667 |                          1557.7667 / 103.9 |                  249.9 |      2223 / 1140 |                         3 |
| overnight-drought |                          2859.3333 / 194.4 |                             1437.4 / 125.9 |                92.1667 |       1983 / 911 |                         1 |

### demo

Actions: move: 3086 (42.9%); search: 2065 (28.7%); explore: 865 (12.0%); sleep: 539 (7.5%); drink: 330 (4.6%); eat: 208 (2.9%); dance: 64 (0.9%); fight: 43 (0.6%).

Innate expression starts: dance: 65. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 2872 (39.9%); investigate_signal: 1427 (19.8%); satisfy_thirst: 882 (12.3%); explore: 865 (12.0%); rest: 657 (9.1%); flee: 188 (2.6%); hunt: 91 (1.3%); avoid_danger: 75 (1.0%); dance: 64 (0.9%); announce_resource: 62 (0.9%); warn_danger: 17 (0.2%).

Most frequent rapid transition pairs: rest → satisfy_hunger: 69; warn_danger → flee: 66; dance → explore: 54; satisfy_thirst → satisfy_hunger: 38; rest → investigate_signal: 33.

Final mean hunger/thirst/energy: 0.6312 / 0.4563 / 0.5898; injured creatures: 7/12; food sources: 1. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Actions: move: 3549 (49.3%); search: 2412 (33.5%); sleep: 527 (7.3%); drink: 258 (3.6%); explore: 237 (3.3%); eat: 174 (2.4%); fight: 32 (0.4%); dance: 8 (0.1%); cry: 2 (0.0%); investigate: 1 (0.0%).

Innate expression starts: dance: 8; cry: 2. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 2655 (36.9%); satisfy_thirst: 1217 (16.9%); flee: 1172 (16.3%); investigate_signal: 958 (13.3%); rest: 565 (7.8%); avoid_danger: 254 (3.5%); explore: 237 (3.3%); hunt: 65 (0.9%); warn_danger: 52 (0.7%); announce_resource: 15 (0.2%); dance: 8 (0.1%); cry: 2 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 274; rest → satisfy_hunger: 118; flee → satisfy_hunger: 78; rest → satisfy_thirst: 58; avoid_danger → satisfy_hunger: 39.

Final mean hunger/thirst/energy: 0.809 / 0.7519 / 0.2834; injured creatures: 12/12; food sources: 4. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Actions: move: 3448 (47.9%); search: 2386 (33.1%); sleep: 536 (7.4%); explore: 277 (3.8%); drink: 272 (3.8%); eat: 206 (2.9%); fight: 69 (1.0%); dance: 5 (0.1%); investigate: 1 (0.0%).

Innate expression starts: dance: 6. Maximum retained relationships: 8; current observed peers: 11.

Intentions: satisfy_hunger: 2566 (35.6%); satisfy_thirst: 1413 (19.6%); investigate_signal: 943 (13.1%); flee: 865 (12.0%); rest: 597 (8.3%); avoid_danger: 340 (4.7%); explore: 277 (3.8%); hunt: 129 (1.8%); warn_danger: 60 (0.8%); announce_resource: 5 (0.1%); dance: 5 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 229; rest → satisfy_hunger: 82; flee → satisfy_hunger: 54; rest → satisfy_thirst: 44; rest → investigate_signal: 44.

Final mean hunger/thirst/energy: 0.7215 / 0.6009 / 0.5025; injured creatures: 9/12; food sources: 3. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Comparison with the acute-needs checkpoint

The same seeds, duration and defaults were measured at checkpoint `6d02f21` (fingerprint `5e14deb60a18ded70dc723bedfed66053de6c56a6edc5f089f2e1a44be938acd`). This compares complete evolving trajectories; changes in one decision policy can alter later encounters and evidence. No improvement is assumed.

| Seed              | Hunger ≥.95 creature-s before → now | Thirst ≥.95 creature-s before → now | Energy ≤.05 creature-s before → now |
| ----------------- | ----------------------------------: | ----------------------------------: | ----------------------------------: |
| demo              |                  2837.8333 → 2555.6 |                    555.4667 → 139.6 |                    293.6333 → 112.1 |
| overnight-river   |                  4033.9 → 3466.6667 |               4216.5333 → 1557.7667 |                        1839 → 249.9 |
| overnight-drought |                  3188.9 → 2859.3333 |                     1300.1 → 1437.4 |                  440.3333 → 92.1667 |

## Determinism and interpretation

Two independent 60-second runs of seed `demo` produced identical complete-state trajectory SHA-256: `1b046a6ca8d381d5d9c576705609d86001d2a8cfeece749f9c2c4fa1c4b69390`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Hunger pressure remains high for 35.5–48.1% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.

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
