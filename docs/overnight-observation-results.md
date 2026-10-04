# Overnight physical ecology observation

Run on October 4, 2026 at 10:45 p.m. with `node scripts/overnight-observation.mjs`. Source HEAD: `c73806b2a5533c16a43ad19f1606aec4e62693bf`; working-source SHA-256: `1ee9804d0929fe76bb8bce323fd7400d1b934a3a471ac85bd57e5a31f3e87a70`.

## Method

Three fixed seeds, default configuration and fixed timestep, 600 simulated seconds per seed. Vite SSR loads the authoritative simulation in middleware mode without opening a listening port. Runtime includes stepping and measurement, excludes module loading. Action/intention distributions sample each creature once per simulated second; extrema, need-duration and encounter totals are accumulated every step.

Encounter counters select records whose timestamp equals the current step, rather than counting the same bounded history repeatedly. A saturated history step makes totals a lower bound. Hunt/flee entries count actual intention changes into those states. “Rapid switches” means successive intention changes within two seconds; it is a diagnostic proxy, not proof of pathological oscillation. “Stationary movement” means consecutive one-second observations moving less than 0.02 units while action is move/search/explore; it can include turning or edge effects.

This run covers the current physical ecology and danger-behaviour slice: population is fixed and creature health is injury-only. These results do not measure mortality, reproduction, lifespan or population survival. High need pressure is reported directly; no ecological success criterion is imposed.

## Results

| Seed              | Runtime s | Hunt / flee entries | Creature / wildlife attacks | Carcass consumption events / amount | Living wildlife / carcasses |
| ----------------- | --------: | ------------------: | --------------------------: | ----------------------------------: | --------------------------: |
| demo              |    1.1829 |             24 / 20 |                     22 / 19 |                        769 / 6.3895 |                       0 / 2 |
| overnight-river   |    1.1593 |            29 / 227 |                     17 / 36 |                        477 / 3.9659 |                       3 / 0 |
| overnight-drought |    1.4065 |            20 / 197 |                     18 / 28 |                        624 / 5.1873 |                       2 / 0 |

| Seed              | Hunger min–max | Thirst min–max | Energy min–max | Health min–max | Memory max / max capacity |
| ----------------- | -------------: | -------------: | -------------: | -------------: | ------------------------: |
| demo              |       0.1118–1 |       0.1109–1 |            0–1 |         0.05–1 |                   16 / 16 |
| overnight-river   |       0.1001–1 |        0.111–1 |            0–1 |         0.05–1 |                   15 / 15 |
| overnight-drought |       0.1121–1 |       0.1109–1 |            0–1 |         0.05–1 |                   15 / 15 |

| Seed              | Hunger ≥.95 creature-s / longest episode s | Thirst ≥.95 creature-s / longest episode s | Energy ≤.05 creature-s | Switches / rapid | Stationary movement max s |
| ----------------- | -----------------------------------------: | -----------------------------------------: | ---------------------: | ---------------: | ------------------------: |
| demo              |                       2437.2333 / 173.4667 |                                17.9 / 17.9 |                10.8333 |       1286 / 264 |                         2 |
| overnight-river   |                       2760.5333 / 171.8667 |                            1201 / 135.8333 |               106.0667 |       1735 / 623 |                         2 |
| overnight-drought |                          3326.7667 / 230.1 |                          1608.3 / 248.4333 |                  255.6 |       1869 / 767 |                         1 |

### demo

Actions: move: 5042 (70.0%); sleep: 722 (10.0%); explore: 538 (7.5%); drink: 346 (4.8%); search: 272 (3.8%); eat: 216 (3.0%); fight: 64 (0.9%).

Intentions: rest: 2418 (33.6%); investigate_signal: 1781 (24.7%); satisfy_hunger: 1165 (16.2%); satisfy_thirst: 1023 (14.2%); explore: 538 (7.5%); hunt: 144 (2.0%); flee: 81 (1.1%); avoid_danger: 24 (0.3%); announce_resource: 22 (0.3%); warn_danger: 4 (0.1%).

Most frequent rapid transition pairs: explore → rest: 28; rest → satisfy_hunger: 25; rest → satisfy_thirst: 21; satisfy_hunger → rest: 20; announce_resource → explore: 17.

Final mean hunger/thirst/energy: 0.6398 / 0.3566 / 0.7249; injured creatures: 4/12; food sources: 0. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-river

Actions: move: 5991 (83.2%); sleep: 479 (6.7%); drink: 285 (4.0%); eat: 195 (2.7%); explore: 142 (2.0%); fight: 55 (0.8%); search: 52 (0.7%); investigate: 1 (0.0%).

Intentions: rest: 2083 (28.9%); investigate_signal: 1990 (27.6%); satisfy_thirst: 882 (12.3%); satisfy_hunger: 818 (11.4%); flee: 779 (10.8%); avoid_danger: 318 (4.4%); explore: 142 (2.0%); hunt: 136 (1.9%); warn_danger: 40 (0.6%); announce_resource: 12 (0.2%).

Most frequent rapid transition pairs: warn_danger → flee: 188; avoid_danger → rest: 32; flee → rest: 22; avoid_danger → investigate_signal: 20; rest → avoid_danger: 18.

Final mean hunger/thirst/energy: 0.8298 / 0.3806 / 0.5802; injured creatures: 7/12; food sources: 3. Memory bound violations: 0; saturated encounter-history steps: 0.

### overnight-drought

Actions: move: 5140 (71.4%); sleep: 672 (9.3%); search: 538 (7.5%); explore: 353 (4.9%); drink: 271 (3.8%); eat: 158 (2.2%); fight: 68 (0.9%).

Intentions: rest: 2054 (28.5%); investigate_signal: 1535 (21.3%); satisfy_hunger: 1240 (17.2%); flee: 772 (10.7%); satisfy_thirst: 728 (10.1%); explore: 353 (4.9%); avoid_danger: 351 (4.9%); hunt: 125 (1.7%); warn_danger: 31 (0.4%); announce_resource: 11 (0.2%).

Most frequent rapid transition pairs: warn_danger → flee: 165; satisfy_hunger → rest: 67; rest → satisfy_hunger: 65; rest → warn_danger: 30; avoid_danger → rest: 29.

Final mean hunger/thirst/energy: 0.6619 / 0.3843 / 0.732; injured creatures: 5/12; food sources: 2. Memory bound violations: 0; saturated encounter-history steps: 0.

## Comparison with the physical checkpoint

The historical measurements were recorded with the same seeds, duration and defaults and retained in commit `c73806b` (source fingerprint `214932dedb5419bf5cdb0e00abae5af10eeba2c785fbdbac8464d51d78620139`). This compares complete evolving systems, including communication changes; it does not isolate danger memory as the sole cause. Reduced immediate flee/rest reversals can coexist with worse thirst or food access.

| Seed              | Rapid switches before → now | Rapid flee↔rest before → now | Hunger ≥.95 creature-s before → now | Thirst ≥.95 creature-s before → now |
| ----------------- | --------------------------: | ---------------------------: | ----------------------------------: | ----------------------------------: |
| demo              |                   258 → 264 |                       42 → 2 |               2696.0667 → 2437.2333 |                          7.7 → 17.9 |
| overnight-river   |                   767 → 623 |                     281 → 29 |                  2578.2 → 2760.5333 |                     321.5667 → 1201 |
| overnight-drought |                  1423 → 767 |                     444 → 26 |                  2671.4 → 3326.7667 |                    72.0667 → 1608.3 |

## Determinism and interpretation

Two independent 60-second runs of seed `demo` produced identical complete-state trajectory SHA-256: `e7da3ea822977bbc74dcf69da6ed93ad38c9af40e95f50835f9464596cd1a02d`. Summary metrics also matched after excluding wall-clock runtime.

All per-step need/health values remained finite and within [0,1]. See the pressure episodes and switching counts above when judging stability: repeatability alone does not establish that creatures meet their needs or that competing intentions are well tuned.

Hunger pressure remains high for 33.9–46.2% of total creature-time. This is substantial unmet need despite hunting; it warrants resource/decision follow-up rather than claiming a balanced ecosystem. Local wildlife can be depleted and severe injuries occur. The rapid-transition pair counts identify competing intentions worth inspecting; they do not justify adding scripted emergency overrides.

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
