# Overnight physical ecology observation

Run on October 4, 2026 at 10:58 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `6d02f2188398c56c6365205dde1a5917f8d86fe5`; working-source SHA-256: `baa8afbb39403ce1f6efbaa5d34417211b94d9e9487ab70fe5dbaf937f475152`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.

Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run covers the current physical ecology and danger-behaviour slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.

## Results

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    1.2394 |             19 / 60 |                     16 / 28 |                        481 / 4.0001 |                       1 / 3 |
| overnight-river   |     1.235 |            21 / 307 |                     12 / 36 |                        533 / 4.4374 |                       3 / 0 |
| overnight-drought |    1.2112 |            15 / 336 |                     14 / 42 |                        495 / 4.1054 |                       2 / 1 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1083–1 |       0.1109–1 |       0–0.9066 |         0.05–1 |                   16 / 16 |
| overnight-river   |       0.1122–1 |        0.111–1 |       0–0.9066 |         0.05–1 |                   15 / 15 |
| overnight-drought |       0.1117–1 |        0.111–1 |       0–0.9067 |         0.05–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                       2470.2333 / 264.3667 |                            108.9 / 39.3667 |                   48.9 |       1548 / 565 |                         3 |
| overnight-river   |                          2768.3667 / 122.7 |                       1414.4667 / 118.7333 |                  201.5 |      2106 / 1050 |                         2 |
| overnight-drought |                       2721.2333 / 151.5333 |                          1766.2667 / 260.6 |               184.1333 |      2228 / 1120 |                         1 |

### demo

Actions: move: 3308 (45.9%); search: 2005 (27.8%); explore: 760 (10.6%); sleep: 544 (7.6%); drink: 319 (4.4%); eat: 212 (2.9%); fight: 52 (0.7%).

Intentions: satisfy_hunger: 2761 (38.3%); investigate_signal: 1642 (22.8%); satisfy_thirst: 926 (12.9%); explore: 760 (10.6%); rest: 659 (9.2%); flee: 208 (2.9%); hunt: 97 (1.3%); avoid_danger: 73 (1.0%); announce_resource: 63 (0.9%); warn_danger: 11 (0.2%).

Most frequent rapid transition pairs: rest → satisfy_hunger: 76; warn_danger → flee: 50; rest → investigate_signal: 42; satisfy_thirst → satisfy_hunger: 34; announce_resource → explore: 31.

Final mean hunger/thirst/energy: 0.5739 / 0.4609 / 0.5278; injured creatures: 6/12; food sources: 0. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Actions: move: 3743 (52.0%); search: 2111 (29.3%); sleep: 535 (7.4%); explore: 271 (3.8%); drink: 265 (3.7%); eat: 208 (2.9%); fight: 67 (0.9%).

Intentions: satisfy_hunger: 2297 (31.9%); investigate_signal: 1407 (19.5%); satisfy_thirst: 1307 (18.2%); flee: 880 (12.2%); rest: 571 (7.9%); explore: 271 (3.8%); avoid_danger: 223 (3.1%); hunt: 151 (2.1%); warn_danger: 60 (0.8%); announce_resource: 33 (0.5%).

Most frequent rapid transition pairs: warn_danger → flee: 232; rest → satisfy_hunger: 93; rest → satisfy_thirst: 62; flee → satisfy_hunger: 59; rest → investigate_signal: 50.

Final mean hunger/thirst/energy: 0.6868 / 0.5922 / 0.5761; injured creatures: 11/12; food sources: 1. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Actions: move: 3674 (51.0%); search: 1987 (27.6%); sleep: 546 (7.6%); explore: 481 (6.7%); drink: 245 (3.4%); eat: 219 (3.0%); fight: 48 (0.7%).

Intentions: satisfy_hunger: 2242 (31.1%); satisfy_thirst: 1498 (20.8%); flee: 1179 (16.4%); rest: 617 (8.6%); avoid_danger: 520 (7.2%); investigate_signal: 515 (7.2%); explore: 481 (6.7%); hunt: 88 (1.2%); warn_danger: 51 (0.7%); announce_resource: 9 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 262; rest → satisfy_hunger: 90; rest → satisfy_thirst: 68; flee → satisfy_hunger: 62; satisfy_hunger → warn_danger: 49.

Final mean hunger/thirst/energy: 0.7413 / 0.8038 / 0.4704; injured creatures: 10/12; food sources: 2. Exhausted travel home: 0 creature-seconds. Memory bound violations: 0; saturated encounter-history steps: 0.

## Comparison with the acute-needs checkpoint

The same seeds, duration and defaults were measured at checkpoint `6d02f21` (fingerprint `5e14deb60a18ded70dc723bedfed66053de6c56a6edc5f089f2e1a44be938acd`). This compares complete evolving trajectories; changes in one decision policy can alter later encounters and evidence. No improvement is assumed.

| Seed              | Hunger ≥.95 creature-s before → now | Thirst ≥.95 creature-s before → now | Energy ≤.05 creature-s before → now |
| ----------------- | ----------------------------------: | ----------------------------------: | ----------------------------------: |
| demo              |               2837.8333 → 2470.2333 |                    555.4667 → 108.9 |                     293.6333 → 48.9 |
| overnight-river   |                  4033.9 → 2768.3667 |               4216.5333 → 1414.4667 |                        1839 → 201.5 |
| overnight-drought |                  3188.9 → 2721.2333 |                  1300.1 → 1766.2667 |                 440.3333 → 184.1333 |

## Determinism and interpretation

Two independent 60-second runs of seed `demo` produced identical complete-state trajectory SHA-256: `1341712af59ed9e716121eb72124bf72a03cb97ba7bf62591733b8c7d88dd055`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Hunger pressure remains high for 34.3–38.4% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.

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
