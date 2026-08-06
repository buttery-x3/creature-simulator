# Module design and growth policy

## Purpose and authority

This document turns the general modularity requirements in `AGENTS.md` into repository-specific implementation guidance.

It complements:

- `architecture.md`, which owns conceptual responsibilities and the separation between authoritative application data, presentation and UI;
- `source-structure.md`, which owns filesystem placement, subsystem boundaries and import rules;
- `workflow.md`, which owns commands, quality gates and review workflow.

This document owns responsibility boundaries, decomposition triggers, growth thresholds and the evidence required when production code is reorganised.

## Core rule

A production module should have one primary reason to change.

The simplest implementation is the simplest implementation that preserves coherent ownership—not necessarily the implementation with the fewest files or smallest diff.

Closely related feature work may still contain separate responsibilities. For example, rendering a habitat can involve:

- component and renderer lifecycle;
- construction of static habitat presentation;
- camera framing;
- dynamic entity presentation;
- animation scheduling;
- resource disposal.

Those responsibilities may collaborate without all belonging in one growing Svelte component.

Private helper functions do not create a meaningful boundary when an independently testable policy, algorithm or lifecycle remains embedded inside an unrelated orchestrator.

## Responsibility categories

Use these categories when assessing a production file:

| Category                | Typical responsibility                                            |
| ----------------------- | ----------------------------------------------------------------- |
| Domain model            | Authoritative serialisable state and domain vocabulary            |
| Generation or algorithm | Deterministic placement, geometry or state calculation            |
| Orchestration           | Sequences subsystem calls or owns a lifecycle                     |
| Policy                  | Chooses, classifies or resolves outcomes according to named rules |
| Validation              | Rejects invalid data or impossible configurations                 |
| Diagnostics             | Records or formats evidence without changing authoritative state  |
| Presentation adaptation | Converts authoritative data into visual representation            |
| Resource lifecycle      | Creates, updates and disposes Three.js or browser resources       |
| UI interaction          | Handles controls and presents user-facing application state       |

A file may contain small supporting details from another category, but it should not become the primary implementation home for several independently changing categories.

## Decomposition triggers

Perform a decomposition check before adding production functionality when any of the following applies:

- a production file exceeds 350 non-blank, non-comment lines;
- a proposed change would add approximately 100 or more lines;
- a change introduces a new responsibility category into an existing file;
- a file combines orchestration with an independently testable algorithm, policy, validator, diagnostic builder or resource manager;
- a production function exceeds 150 non-blank, non-comment lines;
- the proposed change would make a function exceed that threshold;
- a directory contains six of its eight permitted implementation files;
- three or more implementation files serve one newly introduced state machine or named domain concept.

The decomposition check must identify:

1. the file’s current responsibilities;
2. the responsibility being introduced;
3. the smallest coherent ownership boundary with reasonable headroom;
4. any public API or component contract that must remain stable;
5. the focused tests that protect the change.

A decomposition check does not require creating another issue. When the active feature provides concrete evidence for a boundary, perform the smallest coherent extraction within that issue.

## Hard growth limits

Unless a documented exception has been approved:

- hand-written production `.ts` and `.svelte` files must not exceed 500 non-blank, non-comment lines;
- production functions must not exceed 200 non-blank, non-comment lines;
- public `index.ts` entry points must contain no implementation logic and should remain below 100 non-blank, non-comment lines.

Tests, generated files and declaration-heavy type modules may receive a documented exception where splitting would reduce clarity.

These limits are smoke alarms, not design targets. A 450-line file with several independently changing responsibilities is still poorly structured.

“The file remains below the limit” is not sufficient justification for adding another responsibility.

A file already above a hard limit may receive a minimal correctness fix. It must not receive a new independent responsibility without being decomposed in the same issue.

Threshold increases or exceptions require repository-owner approval and a responsibility-based explanation.

## Current repository application

### Determinism subsystem

`src/lib/determinism/` owns shared seeded pseudo-random generation and pure seed derivation.

- `seeded-rng.ts` — Mulberry32 PRNG and seed hashing;
- `seed-derivation.ts` — independent stream seeds from a base seed + channel parts;
- `index.ts` — explicit public exports only.

Do not store closure-owned RNG state on authoritative simulation or habitat models.

### Habitat subsystem

`src/lib/habitat/` owns the authoritative bounded habitat model and deterministic generation.

Current responsibilities are separated as follows:

- `types.ts` — serialisable habitat, feature and generation configuration types;
- `geometry.ts` — ground-plane footprint and spacing calculations;
- `generate-habitat.ts` — configuration validation and seeded feature placement;
- `diagnostics.ts` — human-readable and structured habitat evidence;
- `index.ts` — explicit public exports only.

Do not move Three.js objects, Svelte state, creatures or browser APIs into this subsystem.

### Simulation subsystem

`src/lib/simulation/` owns authoritative simulation state and creature behaviour.

Top-level modules:

- `types.ts` — `SimulationState`, `Creature`, needs/goals/actions/decision types and configuration;
- `create-simulation.ts` — deterministic habitat + creature population creation;
- `step-simulation.ts` — fixed-step advance and bounded catch-up;
- `creature-movement.ts` — pure turn, translate, clamp and wander retarget helpers;
- `diagnostics.ts` — simulation and creature inspection text from structured evidence;
- `index.ts` — explicit public exports only.

Internal behaviour subdomain (`simulation/behaviour/`), introduced for the
needs/goal/action state machine and temporary global resource awareness:

- `needs.ts` — need progression and recovery completion;
- `decisions.ts` — candidate evaluation, hysteresis/commitment, decision records;
- `actions.ts` — goal/action transitions and bounded history;
- `resource-awareness.ts` — temporary global habitat resource target lookup;
- `step-creature-behaviour.ts` — per-creature fixed-step behaviour orchestration;
- `index.ts` — exports for simulation siblings (not a separate app subsystem).

Do not move Three.js objects or Svelte components into this subsystem. Creatures must not live on `Habitat`.

### Presentation

Three.js presentation is split:

- `habitat-presentation.ts` — static habitat mesh construction and disposal;
- `creature-presentation.ts` — dynamic creature mesh reconcile by id and action visuals;
- `ThreeViewport.svelte` — scene lifecycle, camera framing, pick ray, prop wiring;
- `habitat-camera.ts` — pure framing and visibility calculations.

Selection overlays or heavier interaction should extract further if
`ThreeViewport.svelte` approaches modularity thresholds.

### Workbench and route

`HabitatWorkbench.svelte` owns seed/simulation controls, diagnostics and the
creature inspector presentation (formats structured simulation evidence).

`src/routes/+page.svelte` owns page-level simulation session state, rAF fixed-step
catch-up, selected creature id (presentation only), and composition of the
workbench with the viewport. It may remain a small application orchestrator, but
domain algorithms and Three.js resource management must not migrate into it.

## Extraction rules

A decomposition should:

- preserve observable behaviour before adding the requested feature;
- keep or narrow existing public APIs and component contracts;
- move existing tests rather than duplicate them;
- add focused tests for newly isolated behaviour where useful;
- avoid temporary compatibility wrappers unless a real consumer requires them;
- delete obsolete aliases and dead modules when their compatibility purpose is gone;
- update architecture and source-structure documentation when ownership or entry points change.

Do not create catch-all modules or directories named:

- `helpers`;
- `utils`;
- `common`;
- `shared`;
- `misc`;
- `core`.

Name a module after the domain concept, policy or lifecycle it owns.

Do not split code into arbitrary fragments solely to lower line counts. A new module must have a primary reason to change that can be stated clearly.

## Review evidence

When a decomposition trigger applies, the completion report must include:

- responsibilities present before the change;
- the final responsibility of each affected module;
- the API or component contract preserved or changed;
- focused tests run;
- the full `npm run check` result;
- any remaining structural pressure;
- confirmation that no substantial file acquired an unrelated responsibility.

For every non-trivial issue, report whether:

- subsystem boundaries changed;
- public entry points changed;
- dependency direction changed;
- thresholds were approached or exceeded;
- no structural changes were required.

## Mechanical enforcement

The thresholds in this document are currently review policy.

ESLint does not yet enforce file or function length, and no architecture checker currently enforces directory capacity or dependency direction. Agents must not claim mechanical enforcement that does not exist.

A future issue may add proportional checks when repository growth makes them useful. Adding such checks is not required during unrelated feature work.
