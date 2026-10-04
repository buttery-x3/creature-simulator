# Larger single-home world assessment

## Configuration and method

One candidate was assessed on local checkpoint `78fc7a95453f78bee6423e84f53bea41be9e9bec`, before exposing it as
`larger-world`. No survival-tuning sweep was performed. Node v24.15.0 ran three
seeds for 600 simulated seconds each at fixedDt 1/30 (18,000 steps per seed).
The existing observation collector was adapted in the ignored
`.svelte-kit/larger-single-home-probe.mjs`; exact configuration and measured results
remain in `.svelte-kit/larger-single-home-results.json` locally.

The candidate scales resource-rich world area, founders and initial resources by
four: 48 founders, 40×28 world, 32 food sources, 8 water sources, 8 wildlife,
food cap 48 and a food attempt every 2 seconds. The single home's width and height
ranges double because founders spawn inside its footprint. The population cap
is 128, an explicit computational limit. Movement, sensing radius 3, hearing
radius 12, personal memory range 8–16, learning, need scoring, rain and lifecycle
rules are unchanged. The separate 2-unit exploration grid grows from 70 to 280
cells per creature; it still requires simultaneous sensing of all four corners.

Source SHA-256 (production TypeScript under determinism/habitat/simulation, sorted
paths, normalized newlines, excluding specs) stayed unchanged during assessment:
`89e700dfc53a26cd696e3339ec7f2464417242d35f8d615bd08706d201de89da`.

Population births/deaths use stepwise identity changes. Need-pressure percentages
are weighted by living creature time, with hunger/thirst >=0.95 and energy <=0.05.
Retained outcome histories can undercount events; absence of history saturation
is evidence for these runs, not a general event-log guarantee. Emissions count
fresh active events rather than the bounded diagnostic history. Following's
`resource_found` outcome means a visible resource won arbitration; it does not
prove a new discovery, helpful intent or causal benefit from a signal.

## Observed outcomes

All seeds placed the intended founders, resources and wildlife around one home.

| Seed              | Population min–max / final | Births / deaths | Maximum generation | High hunger / thirst (% living time) | Approach carriers final / max |
| ----------------- | -------------------------- | --------------- | ------------------ | ------------------------------------ | ----------------------------- |
| demo              | 33–53 / 33                 | 6 / 21          | 1                  | 14.33 / 5.04                         | 14 / 24                       |
| overnight-river   | 24–49 / 24                 | 2 / 26          | 1                  | 5.49 / 9.94                          | 17 / 31                       |
| overnight-drought | 36–57 / 36                 | 10 / 22         | 2                  | 6.46 / 8.15                          | 19 / 36                       |

Low energy occupied 0.22%, 0.19% and 0.05% of living time respectively. Positive
approach evidence counts were 149/202/260; learned approach calls were 13/25/35.
These remain personal associations, not an inherited or shared dictionary.
Physical follows began 7/5/4 times, with one visible-resource handoff in each run.
No helpfulness or discovery credit is inferred from those handoffs.

All 54,000 physical validation steps passed finite-value and world-bound checks.
Personal memory never exceeded 16 entries, relationships 8, perceived peers 16,
movement encounters 16, or pending traces 4. Memory/movement/follow violations
were zero. Maximum sampled stationary movement was 3/4/5 seconds, and stationary
search one second in each seed (one-second samples, displacement below 0.02).
Unfinished same-need search waypoint replacements were zero.

The configured population cap was never approached: observed peak was 57.
This experiment does not establish performance at 128 creatures, ecological
stability beyond ten minutes, universal survival, or semantic convergence.

## Timing and repeatability

Local step timing surrounds only stepSimulation, outside observation checks.
These single-run values are not browser frame rates or a comparative benchmark.

| Seed              | Median step (ms) | p95 (ms) | Maximum (ms) |
| ----------------- | ---------------- | -------- | ------------ |
| demo              | 0.398            | 3.426    | 21.101       |
| overnight-river   | 0.315            | 3.290    | 11.153       |
| overnight-drought | 0.408            | 3.045    | 12.598       |

Two demo runs compared complete initial state and every post-step state for 60
seconds in the same Node runtime, with matching trajectory hash:
`2377d087d238b2aa95ac01dd528202084a0611492533d05d9b2fcad35bdf5e60`.
Initial-state hash: `10b214b833bb42886b593a3fc52c8498b1b050b8cd66c22caa9a2e63a1409bef`.
Cross-engine floating-point equivalence is not claimed.

After exposing the preset, its production factory was compared with the frozen
candidate: all three complete configurations and initial-state hashes match.
The implementation adds only the scenario option; simulation dynamics are unchanged.

## Exact assessed demo configuration

Other seeds replace only the seed field.

```json
{
	"ecology": {
		"wildlifeCount": 8,
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
		"populationCap": 128,
		"eventHistoryLimit": 32
	},
	"habitat": {
		"worldWidth": 40,
		"worldHeight": 28,
		"foodCount": 32,
		"waterCount": 8,
		"homeSize": {
			"minWidth": 4.4,
			"maxWidth": 6.4,
			"minHeight": 3.6,
			"maxHeight": 5.2
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
	"creatureCount": 48,
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
	"maxActiveFoodSources": 48,
	"foodSpawnIntervalSeconds": 2,
	"rainIntervalMinSeconds": 45,
	"rainIntervalMaxSeconds": 75,
	"rainDurationSeconds": 4,
	"seed": "demo"
}
```
