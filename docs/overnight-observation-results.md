# Overnight physical ecology observation

Run on October 4, 2026 at 10:52 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `3ca127c257e65f16de1e62c4d1f775e650d142d8`; working-source SHA-256: `5e14deb60a18ded70dc723bedfed66053de6c56a6edc5f089f2e1a44be938acd`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.

Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run covers the current physical ecology and danger-behaviour slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.

## Results

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    1.3762 |             16 / 71 |                      8 / 23 |                        355 / 2.9459 |                       3 / 0 |
| overnight-river   |    1.4763 |             2 / 543 |                      2 / 56 |                        104 / 0.8616 |                       5 / 0 |
| overnight-drought |    1.2038 |            10 / 302 |                     11 / 38 |                        321 / 2.6595 |                       3 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1121–1 |       0.1109–1 |       0–0.9066 |         0.05–1 |                   16 / 16 |
| overnight-river   |       0.1118–1 |       0.1115–1 |       0–0.9067 |         0.05–1 |                   15 / 15 |
| overnight-drought |       0.1117–1 |        0.111–1 |       0–0.9066 |         0.05–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                          2837.8333 / 277.3 |                         555.4667 / 66.6333 |               293.6333 |       1270 / 295 |                         2 |
| overnight-river   |                             4033.9 / 170.3 |                       4216.5333 / 212.3667 |                   1839 |      2347 / 1204 |                         1 |
| overnight-drought |                             3188.9 / 232.7 |                           1300.1 / 72.8667 |               440.3333 |       1903 / 773 |                         1 |

### demo

Actions: move: 4062 (56.4%); search: 1661 (23.1%); explore: 506 (7.0%); sleep: 417 (5.8%); drink: 308 (4.3%); eat: 207 (2.9%); fight: 39 (0.5%).

Intentions: satisfy_hunger: 2609 (36.2%); rest: 1863 (25.9%); satisfy_thirst: 924 (12.8%); investigate_signal: 875 (12.2%); explore: 506 (7.0%); flee: 242 (3.4%); hunt: 82 (1.1%); avoid_danger: 54 (0.8%); announce_resource: 34 (0.5%); warn_danger: 11 (0.2%).

Most frequent rapid transition pairs: warn_danger → flee: 56; announce_resource → explore: 20; flee → satisfy_hunger: 16; satisfy_thirst → satisfy_hunger: 15; explore → rest: 11.

Final mean hunger/thirst/energy: 0.7227 / 0.523 / 0.5705; injured creatures: 9/12; food sources: 0. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Actions: move: 4442 (61.7%); search: 2093 (29.1%); sleep: 307 (4.3%); eat: 144 (2.0%); drink: 131 (1.8%); explore: 76 (1.1%); fight: 7 (0.1%).

Intentions: satisfy_hunger: 1863 (25.9%); rest: 1708 (23.7%); flee: 1503 (20.9%); satisfy_thirst: 1414 (19.6%); investigate_signal: 323 (4.5%); avoid_danger: 214 (3.0%); warn_danger: 81 (1.1%); explore: 76 (1.1%); hunt: 15 (0.2%); announce_resource: 3 (0.0%).

Most frequent rapid transition pairs: warn_danger → flee: 442; flee → satisfy_hunger: 68; flee → rest: 62; rest → warn_danger: 59; satisfy_hunger → warn_danger: 54.

Final mean hunger/thirst/energy: 0.9358 / 0.9696 / 0.1078; injured creatures: 12/12; food sources: 3. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Actions: move: 4253 (59.1%); search: 1870 (26.0%); sleep: 396 (5.5%); drink: 269 (3.7%); eat: 192 (2.7%); explore: 172 (2.4%); fight: 48 (0.7%).

Intentions: satisfy_hunger: 2435 (33.8%); rest: 1457 (20.2%); flee: 990 (13.8%); satisfy_thirst: 979 (13.6%); investigate_signal: 767 (10.7%); avoid_danger: 267 (3.7%); explore: 172 (2.4%); hunt: 84 (1.2%); warn_danger: 42 (0.6%); announce_resource: 7 (0.1%).

Most frequent rapid transition pairs: warn_danger → flee: 242; flee → satisfy_hunger: 55; satisfy_hunger → warn_danger: 42; rest → warn_danger: 32; satisfy_hunger → flee: 23.

Final mean hunger/thirst/energy: 0.8098 / 0.8516 / 0.1923; injured creatures: 11/12; food sources: 3. Memory bound violations: 0; saturated encounter-history steps: 0.

## Comparison with the physical checkpoint

The historical measurements were recorded with the same seeds, duration and defaults and retained in commit `c73806b` (source fingerprint `214932dedb5419bf5cdb0e00abae5af10eeba2c785fbdbac8464d51d78620139`). This compares complete evolving systems, including communication changes; it does not isolate danger memory as the sole cause. Reduced immediate flee/rest reversals can coexist with worse thirst or food access.

| Seed              | Rapid switches before → now | Rapid flee↔rest before → now | Hunger ≥.95 creature-s before → now | Thirst ≥.95 creature-s before → now |
| ----------------- | --------------------------: | ---------------------------: | ----------------------------------: | ----------------------------------: |
| demo              |                   258 → 295 |                      42 → 10 |               2696.0667 → 2837.8333 |                      7.7 → 555.4667 |
| overnight-river   |                  767 → 1204 |                     281 → 91 |                     2578.2 → 4033.9 |                321.5667 → 4216.5333 |
| overnight-drought |                  1423 → 773 |                     444 → 29 |                     2671.4 → 3188.9 |                    72.0667 → 1300.1 |

## Determinism and interpretation

Two independent 60-second runs of seed `demo` produced identical complete-state trajectory SHA-256: `b486209c55c05872af218890212d90c3cce96c98c52fb3a0aea129b62480ae3c`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Hunger pressure remains high for 39.4–56.0% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.

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
