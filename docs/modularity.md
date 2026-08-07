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

- `types.ts` — serialisable habitat, feature (home vs food/water with amount/capacity) and generation configuration types;
- `geometry.ts` — ground-plane footprint and spacing calculations;
- `place-feature.ts` — pure bounded placement shared by generation and runtime food spawn;
- `generate-habitat.ts` — configuration validation and seeded initial feature placement;
- `diagnostics.ts` — human-readable and structured habitat evidence;
- `index.ts` — explicit public exports only.

Do not move Three.js objects, Svelte state, creatures or browser APIs into this subsystem.
Runtime resource mutation and weather clocks live in `simulation/resources/`, not here.

### Simulation subsystem

`src/lib/simulation/` owns authoritative simulation state and creature behaviour.

Top-level modules:

- `types.ts` — `SimulationState`, `Creature`, needs/goals/actions/decision types and configuration;
- `create-simulation.ts` — deterministic habitat + creature population creation;
- `step-simulation.ts` — fixed-step advance and bounded catch-up (resources phase first);
- `creature-movement.ts` — pure turn, translate, clamp and wander retarget helpers;
- `diagnostics.ts` — simulation and creature inspection text from structured evidence;
- `population-symbol-diagnostics.ts` — pure population association/emission summaries (observational only);
- `index.ts` — explicit public exports only.

Internal resources subdomain (`simulation/resources/`), introduced for finite
renewable resources and minimal rain (FLAME-77):

- `types.ts` — environment/weather state, consumption grants, spawn outcomes;
- `availability.ts` — pure `amount > 0` availability predicate;
- `consumption.ts` — deterministic multi-consumer withdrawal and grants;
- `food-spawn.ts` — time-driven capped food spawn with new feature ids;
- `weather.ts` — clear/rain schedule and basin refill;
- `step-resources.ts` — one fixed-step orchestration (weather → spawn → consumption);
- `index.ts` — exports for simulation siblings.

Do not fold world lifecycle into `behaviour/`. Do not invent a general weather
framework or ecosystem solver here.

Internal behaviour subdomain (`simulation/behaviour/`), needs/action execution
and thin step orchestration (intention selection lives in cognition):

- `needs.ts` — need progression and recovery completion;
- `actions.ts` — intention→action mapping, apply arbitration result, consumptive transitions;
- `apply-arbitration.ts` — run `arbitrate` + map onto execution fields (investigation context);
- `build-arbitration-input.ts` — body/perception/memory snapshot for cognition;
- `habitat-feature-query.ts` — named nearby-feature query (circle ∩ footprint);
- `perception.ts` — sensing interval and current observation snapshot;
- `resource-awareness.ts` — target resolve/arrival/movement helpers; search sampling;
- `step-creature-behaviour.ts` — per-creature fixed-step orchestration (may emit emission requests);
- `index.ts` — exports for simulation siblings (not a separate app subsystem).

This directory is at capacity for implementation files (hard limit 8 excluding
tests and `index.ts`). Cognition owns decision policy; announcement executor lives
in `simulation/announcement/`. Further growth should restate ownership rather than
add thin helpers. Do not move Three.js objects or Svelte components into this
subsystem. Creatures must not live on `Habitat`.

Internal announcement subdomain (`simulation/announcement/`), executor under the
`announce_resource` intention:

- `types.ts` — executor opportunity/outcome/clarity records;
- `clarity.ts` — pure kind-level clarity evaluation;
- `speaking-position.ts` — pure deterministic speaking-position search;
- `opportunity-lifecycle.ts` — outcome construction and diagnostic helpers;
- `step-announcement.ts` — advance clarity/reposition/emit when intention is announce;
- `index.ts` — exports for simulation siblings.

Cognition selects announce; behaviour calls `stepAnnouncement` as executor only.
Communication owns transmission. Do not couple future danger/predator signalling
to resource-announcement preparation.

Internal memory subdomain (`simulation/memory/`), first-class bounded creature
memory (FLAME-74 baseline; FLAME-78 observation + heard-signal kinds):

- `types.ts` — `CreatureMemory`, entry union (announcement / observation / heard), opportunity-decision diagnostics;
- `create-memory.ts` — empty memory + deterministic capacity sampling;
- `query.ts` — pure recall / contains helpers;
- `mutate.ts` — remember (insert/refresh/dedupe), forget, oldest-first eviction;
- `apply-announcement-memory.ts` — post-emission write for successful announcements;
- `apply-sensory-memory.ts` — post-behaviour resource observations + post-reception heard signals;
- `index.ts` — exports for simulation siblings.

Announcement consults memory for suppression; step orchestration applies all
memory writes (observations, announcements, heard signals). Communication must
not become the general memory manager. Do not store memory inside perception or
presentation. Heard_signal memory is the retained hearing model for investigation
candidates. Memory query helpers include newest-first list recall for cognition;
scoring stays out of memory.

Internal cognition subdomain (`simulation/cognition/`), pure memory-aware
intention arbitration — **runtime-authoritative**:

- `types.ts` — intention kinds, candidates, ArbitrationRecord, triggers, config shape;
- `score-constants.ts` — default baselines, continuity bonus, need thresholds;
- `target-selection.ts` — perception-then-memory resource targets; signal/announce picks;
- `build-candidates.ts` — baseline candidate set from body + perception + memory;
- `select-intention.ts` — soft continuity, best-score + explicit tie-break;
- `arbitrate.ts` — single pure entry `arbitrate(input) → ArbitrationRecord`;
- `index.ts` — exports for simulation siblings.

Does not own movement, emission, sensing, or memory writes. Continuity is a score
bonus on the current intention, not locks. Live stepping builds input via behaviour
and applies the record; no second decision path exists.

Internal communication subdomain (`simulation/communication/`), introduced for
transient arbitrary signals and local reception:

- `types.ts` — symbol ids, emissions, heard records, emission requests, selection evidence;
- `emission.ts` — preferred-symbol cold-start helper, cooldown, ids, bounded history helpers;
- `symbol-selection.ts` — learned-lexicon emission or exploratory selection from serialisable lexicon values;
- `reception.ts` — circular hearing radius, sender exclusion, deterministic receiver order;
- `step-communication.ts` — apply requests, selection, reception, expiry within the fixed step;
- `index.ts` — exports for simulation siblings.

Behaviour may request an emission; communication owns transmission, reception,
lifetime, histories and emit-time symbol selection. Communication must not import
learning implementation modules; it only reads lexicon **values** already on
the creature. Do not add speaker-success feedback or evidence mutation here.

Internal learning subdomain (`simulation/learning/`), introduced for personal
symbol evidence, exclusive lexicon resolution and investigation arrival learning
(receptive mutation only):

- `types.ts` — evidence rows, lexicon, active investigation execution context, learning / lexicon history;
- `signal-associations.ts` — empty init, clamp, reinforce, optional no-evidence reduction;
- `lexicon-resolution.ts` — pure exclusive one-to-one meaning↔symbol assignment from evidence;
- `signal-investigation.ts` — investigation execution helpers, evidence qualification;
- `step-signal-learning.ts` — arrival reinforce + lexicon resolve, interrupt history;
- `index.ts` — exports for simulation siblings.

Cognition selects `investigate_signal`; behaviour owns movement toward the origin;
learning owns evidence **updates**, lexicon resolution and investigation execution
helpers. Emission uses resolved lexicon assignments (or exploratory when
unassigned) inside communication — not independent multi-context weight
sampling. Population convention metrics are pure diagnostics under simulation
root (`population-symbol-diagnostics.ts`), not authoritative state.

### Presentation

Three.js presentation is split:

- `habitat-presentation.ts` — habitat mesh construction; food/water reconcile-by-id; ground/home rebuild on layout identity only;
- `rain-presentation.ts` — presentation-only rain cue from weather phase;
- `creature-presentation.ts` — dynamic creature mesh reconcile by id, action visuals, and one-shot investigation hop;
- `symbol-presentation.ts` — pure shared symbol presentation registry (shape/label/color);
- `signal-presentation.ts` — emission speech bubbles, thin hearing-radius rings, selected investigation overlay;
- `listener-cue-presentation.ts` — coalesced neutral `?` cues (brief on hear, held while investigating);
- `announcement-cue-presentation.ts` — dashed creature→trigger-feature lines for active announcements;
- `SymbolGlyph.svelte` — Svelte consumer of the symbol registry for diagnostics;
- `ThreeViewport.svelte` — scene lifecycle, camera framing, pick ray, prop wiring;
- `habitat-camera.ts` — pure framing and visibility calculations.

Do not fold heard cues, hop animation and emission rings into a single growing file
when they have independently testable resource lifecycles. Selection overlays or
heavier interaction should extract further if `ThreeViewport.svelte` approaches
modularity thresholds.

### Workbench and route

`src/lib/workbench/` owns the domain-organised diagnostics workbench (presentation
only). Responsibilities are split by product domain rather than stacked panels:

- `WorkbenchShell.svelte` / `WorkbenchTabs.svelte` — full-height shell, tab chrome,
  compact status strip, presentation-only navigation intents;
- `overview/` — run controls and aggregate wellbeing/behaviour/world snapshots;
- `creatures/` — roster table and selected-creature sections;
- `communication/` — symbol legend, funnel, lexicon matrix, symbol summaries,
  live feed and investigations;
- `world/` — structured habitat/resource tables;
- `events/` — chronological rows from bounded histories with a reusable filter model;
- `debug/` — raw `format*` diagnostics and copy/export helpers;
- `view-models/` — pure structured builders (no Svelte, no prose parsing).

Tab selection, event filters and creature selection are presentation state and
must never enter `SimulationState`. Components consume `$lib/simulation` public
exports and shared `SymbolGlyph` / `symbol-presentation` only.

`src/routes/+page.svelte` owns page-level simulation session state, rAF fixed-step
catch-up, selected creature id and active workbench tab (presentation only), and
composition of the workbench with the viewport. It may remain a small application
orchestrator, but domain algorithms and Three.js resource management must not
migrate into it.

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
