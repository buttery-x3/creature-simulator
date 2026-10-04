# Overnight expansion recovery checkpoint

## Working agreement and baseline

- Local experiment branch: `codex/overnight-expansion`.
- Isolated checkout: `C:/Users/user/.codex/worktrees/overnight-expansion/creature-simulator`.
- Baseline: `02196ad` (includes listener-meaning extension `63a5004`). The initial
  local checkout was older; the owner pulled main and the experiment fast-forwarded
  before implementation began.
- Original checkout `D:/dev/creature-simulator` retains the owner's uncommitted
  food spawn interval change from 18 to 14 seconds. It is not included here.
- No pushes, merges into main, deployment, Linear changes, or AGENTS edits.
- Dependencies installed from the existing lockfile with `npm ci`.

## Current work

First slice in progress: physical ecology, bounded local wildlife perception,
utility-driven flee/hunt decisions, injury and encounter costs, day/night rest
weight, visible wildlife/condition, and step/speed controls. This checkpoint is
the clean pre-feature baseline; no completed feature is claimed yet.

The implementation sequence remains physical world, grounded danger language,
relationships/innate expression, lifecycle, then voluntary learned social
communication. Performance, diagnostics, scale and evidence-backed refactoring
follow. Communities, construction, beliefs/idols and moral communication are
later opportunities only after the earlier sequence is complete.

## Verification and review backlog

- Baseline hashes and listener-meaning sources verified.
- No full quality gate run yet in the isolated checkout.
- Each completed slice must record focused tests, full `npm run check`, actual
  browser observations, tunable defaults, and remaining work here.
- No implementation approval pause is required by this run's explicit user
  authorization; local completed checkpoints remain available for later review.

## Launch

From the isolated checkout: `npm run dev` (reserved port 8123). Browser tests use
`npm run test:e2e` and reserved port 8125, following `docs/browser-testing.md`.

## Checkpoint 1: physical ecology

Implemented: seeded local wildlife, condition-dependent hunt/flee utilities,
finite carcass food, cooldown-based injury/combat, physical effort costs,
180-second daylight cycle and bounded nighttime home/rest preference. Danger
can interrupt eating, drinking, sleeping and announcement preparation. Moving
prey is pursued only while locally observed. The UI exposes wildlife, daylight,
physical condition, local sightings, actual competing utilities, observer-only
encounter records, pause/single-step and 0.25x–8x speed.

Validation: full `npm run check` passed (433 unit tests, 1 server test passed,
1 Linux-only deployment fixture skipped on Windows, build, 10 browser tests).
An earlier Chromium attempt failed with host network access denied; installed
Edge passed and the subsequent ordinary Chromium full gate also passed.
Three 600-second runs show bounded memory, repeatable state and no persistent
movement stalls; resource scarcity is substantial (see observation report).

Defaults: 6 wildlife, contact radius 0.65, attack cooldown 2s, damage scale 0.12,
encounter history 32, night rest bonus at most 0.42. Physical costs and ecology
values are editable in ecology/body.ts; utility weights in
cognition/ecology/physical-candidates.ts. Creature injury has a temporary 0.05
floor until the planned lifecycle slice; wildlife death is already finite.

Structure: ecology and creation are named internal domains; sensing and physical
action execution were extracted from the long behavior orchestrator. Viewport
scene/resource lifecycle and animal presentation have explicit ownership. No
threshold or dependency-direction changes. CreaturesTab and the existing public
simulation barrel remain review-pressure points; future panels belong in their
respective domains. No new unrelated responsibility was added to those files.

Next: use measured transition patterns to correct oscillation if causal evidence
supports a fix, then grounded danger language with stale/mistaken warning tests.

Browser observation: demo reached 131.667 simulated seconds at 8x (17.4s wall),
with legible nighttime habitat, 12 creatures and 6 living wildlife. World
encounter history and selected local observation panels rendered and scrolled;
no page errors or apparent movement stalls were observed in that run.
