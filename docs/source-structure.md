# Source structure and subsystem boundaries

## Purpose and authority

This document describes the filesystem representation of the creature simulator’s current architecture.

It complements:

- `architecture.md`, which owns conceptual responsibilities and the authoritative-data/presentation boundary;
- `modularity.md`, which owns responsibility and growth policy;
- `workflow.md`, which owns commands, ports, testing and review workflow.

This document owns:

- current source placement;
- subsystem entry points;
- cross-boundary import rules;
- directory growth rules;
- the process for introducing new source areas when concrete responsibilities appear.

The current topology is a map of implemented responsibilities, not a frozen prediction of every future subsystem.

## Current topology

```text
src/
    lib/
        determinism/
            index.ts
            seeded-rng.ts
            seed-derivation.ts
            *.spec.ts

        habitat/
            index.ts
            types.ts
            geometry.ts
            generate-habitat.ts
            diagnostics.ts
            *.spec.ts

        simulation/
            index.ts
            types.ts
            create-simulation.ts
            step-simulation.ts
            creature-movement.ts
            diagnostics.ts
            *.spec.ts
            behaviour/
                index.ts
                needs.ts
                decisions.ts
                actions.ts
                habitat-feature-query.ts
                perception.ts
                resource-awareness.ts
                step-creature-behaviour.ts
                *.spec.ts
            communication/
                index.ts
                types.ts
                emission.ts
                symbol-selection.ts
                reception.ts
                step-communication.ts
                *.spec.ts
            learning/
                index.ts
                types.ts
                signal-associations.ts
                signal-investigation.ts
                step-signal-learning.ts
                *.spec.ts
            population-symbol-diagnostics.ts
            population-symbol-diagnostics.spec.ts

        workbench/
            index.ts
            workbench-types.ts
            WorkbenchShell.svelte
            WorkbenchTabs.svelte
            view-models/
                overview-view-model.ts
                creature-detail-view-model.ts
                communication-view-model.ts
                events-view-model.ts
                *.spec.ts
            overview/
            creatures/
            communication/
            world/
            events/
            debug/

        SymbolGlyph.svelte
        ThreeViewport.svelte
        habitat-presentation.ts
        creature-presentation.ts
        symbol-presentation.ts
        signal-presentation.ts
        listener-cue-presentation.ts
        habitat-camera.ts
        habitat-camera.spec.ts
        creature-presentation.spec.ts
        symbol-presentation.spec.ts
        signal-presentation.spec.ts
        listener-cue-presentation.spec.ts
        ports.ts
        index.ts

    routes/
        +page.svelte
        page.e2e.ts
```

Obsolete files should not remain in this topology merely because they were created during bootstrap. When a capability is replaced and has no remaining consumer, delete its implementation, tests and exports.

## Current ownership

| Area                               | Owns                                                                                                                                                 | Does not own                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/determinism/`             | Seeded PRNG and pure seed derivation for independent streams                                                                                         | Habitat layout, creature behaviour, UI                               |
| `src/lib/habitat/`                 | Authoritative serialisable habitat data, seeded generation, geometry validation and habitat diagnostics                                              | Creatures, Three.js objects, Svelte state, browser controls          |
| `src/lib/simulation/`              | Authoritative simulation state, creature creation, fixed-step advance, public diagnostics                                                            | Three.js resources, Svelte components, browser rAF ownership         |
| `simulation/behaviour/`            | Needs, goal decisions, actions, local perception, habitat-feature query, search, resource targets, per-creature behaviour step                       | Transmission/reception of signals, association updates, presentation |
| `simulation/communication/`        | Arbitrary symbols, emission construction, lexicon/exploratory selection, hearing radius, reception records, emission expiry, communication histories | Evidence/lexicon mutation, listener semantics, presentation meshes   |
| `simulation/learning/`             | Raw symbol evidence, exclusive lexicon resolution, pending investigation candidates, reinforcement, learning/lexicon history                         | Emission construction, reception range, goal selection, presentation |
| `population-symbol-diagnostics.ts` | Pure observational population evidence/lexicon/emission summaries                                                                                    | Authoritative creature state, selection policy                       |
| `habitat-presentation.ts`          | Static habitat mesh construction and disposal                                                                                                        | Creature meshes, simulation stepping                                 |
| `creature-presentation.ts`         | Dynamic creature mesh reconcile by id, action-derived visuals, presentation-only investigation hop                                                   | Authoritative creature state, habitat rebuilds                       |
| `symbol-presentation.ts`           | Shared symbol→shape/label/color registry for viewport and UI                                                                                         | Simulation semantics, Three.js resources                             |
| `SymbolGlyph.svelte`               | Svelte icon + stable id from the shared registry                                                                                                     | Domain algorithms                                                    |
| `signal-presentation.ts`           | Emission speech bubbles + thin hearing-radius rings + selected investigation overlay                                                                 | Authoritative reception, emission lifetime, association updates      |
| `listener-cue-presentation.ts`     | Coalesced neutral `?` from recent hear (brief) and/or active investigation (held)                                                                    | Investigation decisions, emission construction                       |
| `ThreeViewport.svelte`             | Three.js scene lifecycle, camera framing, creature picking, wiring habitat/creature/signal/listener presentation                                     | Authoritative habitat or creature state                              |
| `habitat-camera.ts`                | Pure camera-framing and visibility calculations                                                                                                      | Scene construction, simulation state or UI controls                  |
| `src/lib/workbench/`               | Domain-organised workbench UI: tab shell, Overview run controls, Creatures roster/detail, Communication, World, Events, Debug; pure view-models      | Authoritative simulation state, Three.js resources                   |
| `src/routes/+page.svelte`          | Page composition, session simulation state, rAF catch-up, pause/reset, selected creature id                                                          | Domain algorithms, geometry rules or Three.js resource ownership     |
| `ports.ts`                         | Reserved application and test ports                                                                                                                  | Runtime simulation configuration                                     |
| `src/lib/index.ts`                 | Deliberate app-level public exports                                                                                                                  | Private implementation logic or universal re-export of every module  |

## Dependency direction

```text
determinism
        ↓
habitat model and generation
        ↓
simulation (creatures + behaviour + communication + learning + fixed-step advance)
        ↓
page-level application state (incl. selection id)
        ↓
workbench UI and Three.js presentation
```

More explicitly:

```text
routes              -> simulation public entry point
routes              -> habitat public entry point
routes              -> workbench and viewport components
workbench           -> habitat + simulation public entry points; SymbolGlyph / symbol-presentation
viewport            -> habitat public entry point
viewport            -> simulation Creature / SignalEmission types
viewport            -> habitat-presentation, creature-presentation, signal-presentation, habitat-camera
habitat-camera      -> habitat types
habitat subsystem   -> determinism
simulation          -> determinism + habitat
simulation/behaviour -> simulation sibling modules + habitat (private to simulation); may construct EmissionRequest only; thin hooks into learning
simulation/communication -> simulation types + determinism (private to simulation); reads association values from creature state only; no learning implementation imports
simulation/learning -> simulation types + habitat Vec2 + communication SymbolId/HeardSignal shapes; no presentation
population-symbol-diagnostics -> simulation state/types + communication emission shapes; pure; no mutation
determinism         -> no Svelte, Three.js, habitat or simulation modules
habitat subsystem   -> no Svelte, Three.js or route modules
simulation          -> no Svelte, Three.js or route modules
```

Rules:

- `src/lib/determinism/`, `src/lib/habitat/` and `src/lib/simulation/` must remain independent of Svelte, Three.js and browser presentation.
- Presentation may read authoritative habitat and creature data but must not modify or replace the domain model with mesh state.
- UI components may request creation through public simulation/habitat capabilities but must not duplicate generation or movement logic.
- Camera calculations may depend on plain habitat bounds but must not import Svelte components or application state.
- Routes may compose public capabilities but must not become the implementation home for domain algorithms.
- Circular dependencies are forbidden.

## Public entry points

A named subsystem consumed outside itself should expose a deliberate `index.ts`.

Entry points must:

- use explicit named exports;
- contain no implementation logic;
- expose supported capabilities rather than all private internals;
- remain small enough to review as an API surface;
- avoid wildcard exports.

Cross-boundary consumers should import through:

```ts
import { generateHabitat, type Habitat } from '$lib/habitat';
import { createSimulation, stepSimulation, type SimulationState } from '$lib/simulation';
import { createSeededRng, deriveSeed } from '$lib/determinism';
```

They should not deep-import implementation files such as:

```ts
import { generateHabitat } from '$lib/habitat/generate-habitat';
import { stepCreature } from '$lib/simulation/creature-movement';
```

Private modules within a subsystem may import sibling implementation files directly.

The root `src/lib/index.ts` may expose deliberately app-wide capabilities, but it must not become a universal barrel that erases ownership boundaries.

## Svelte components and presentation files

Svelte components should own component-specific markup, styling and interaction orchestration.

Extract behaviour when a component begins to own an independently testable:

- domain algorithm;
- presentation builder;
- reconciliation policy;
- animation or timing controller;
- resource lifecycle;
- diagnostic transformation.

Do not create a separate module for every mesh or button. Extract only when the behaviour has a coherent reason to change independently.

Three.js geometry and material objects are presentation resources. Their creation, updating and disposal must remain on the presentation side of the dependency boundary.

Static habitat construction and dynamic creature reconciliation are separate responsibilities and must not grow as one expanding block inside `ThreeViewport.svelte`.

## Adding new domain areas

Do not pre-create empty directories for language, relationships, persistence or future systems not required by active work.

Introduce a named source area when active work creates a durable responsibility that no existing area can own coherently.

A new area must have:

- a specific domain name;
- a stated responsibility;
- a documented dependency relationship;
- an explicit public entry point when consumed across boundaries;
- production files that genuinely belong to that responsibility.

Possible future names must be chosen by the issue that supplies concrete evidence. This document does not reserve or mandate them in advance.

Update this document and `architecture.md` in the same issue whenever:

- a new named subsystem is introduced;
- ownership moves between source areas;
- a new cross-subsystem dependency is permitted;
- a public entry point is introduced, removed or materially changed.

## Directory growth

A directory may contain at most eight production implementation files at one level, excluding:

- `index.ts`;
- unit-test files;
- type-only declaration files where appropriate.

At six implementation files, perform a headroom and subdomain assessment.

Create a nested subdomain only when the files share a specific concept, lifecycle or state machine. Do not satisfy the limit through arbitrary nesting.

Catch-all directories named `helpers`, `utils`, `common`, `shared`, `misc` or `core` require repository-owner approval and a narrowly documented responsibility.

## Test placement

Unit tests currently use co-located files:

```text
geometry.ts
geometry.spec.ts
```

Keep focused unit tests beside the production module they protect unless a named subdomain becomes large enough that a local `__tests__/` directory would improve readability.

Do not mix placement styles arbitrarily within one subsystem.

Browser tests currently use `*.e2e.ts` under the relevant route area and must follow `browser-testing.md`, including the reserved browser-test port and server lifecycle.

Tests crossing a subsystem boundary should normally use its public entry point. Tests may directly import a private sibling module when they specifically protect that module’s internal algorithm or invariant.

## Structural changes

When moving or creating production files:

1. identify the owning subsystem;
2. state the file’s primary reason to change;
3. identify its public entry point, if any;
4. verify every dependency follows the documented direction;
5. move or update relevant tests;
6. remove obsolete files and exports;
7. update architecture documentation in the same issue;
8. run focused tests and `npm run check`.

Do not leave documentation, imports, exports or tests referring to paths that no longer exist.

## Mechanical enforcement

No source-structure checker currently enforces these rules.

Agents must inspect and follow this document manually. Do not add architecture scripts, import restrictions or directory-capacity checks during unrelated feature work.

Mechanical enforcement may be introduced by a dedicated issue when repository complexity justifies its maintenance cost.
