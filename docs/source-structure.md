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
        habitat/
            index.ts
            types.ts
            seeded-rng.ts
            geometry.ts
            generate-habitat.ts
            diagnostics.ts
            *.spec.ts

        HabitatWorkbench.svelte
        ThreeViewport.svelte
        habitat-camera.ts
        habitat-camera.spec.ts
        ports.ts
        index.ts

    routes/
        +page.svelte
        page.e2e.ts
```

Obsolete files should not remain in this topology merely because they were created during bootstrap. When a capability is replaced and has no remaining consumer, delete its implementation, tests and exports.

## Current ownership

| Area                      | Owns                                                                                                    | Does not own                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/habitat/`        | Authoritative serialisable habitat data, seeded generation, geometry validation and habitat diagnostics | Three.js objects, Svelte state, creature behaviour, browser controls |
| `ThreeViewport.svelte`    | Current Three.js scene lifecycle and habitat presentation                                               | Authoritative habitat state or generation rules                      |
| `habitat-camera.ts`       | Pure camera-framing and visibility calculations                                                         | Scene construction, simulation state or UI controls                  |
| `HabitatWorkbench.svelte` | Habitat controls and presentation of habitat diagnostics                                                | Habitat generation algorithms or renderer lifecycle                  |
| `src/routes/+page.svelte` | Page composition and current application-level habitat state                                            | Domain algorithms, geometry rules or Three.js resource ownership     |
| `ports.ts`                | Reserved application and test ports                                                                     | Runtime simulation configuration                                     |
| `src/lib/index.ts`        | Deliberate app-level public exports                                                                     | Private implementation logic or universal re-export of every module  |

## Dependency direction

The current dependency direction is:

```text
habitat model and generation
        ↓
page-level application state
        ↓
workbench UI and Three.js presentation
```

More explicitly:

```text
routes              -> habitat public entry point
routes              -> workbench and viewport components
workbench           -> habitat public entry point
viewport            -> habitat public entry point
viewport            -> habitat-camera
habitat-camera      -> habitat types
habitat subsystem   -> no Svelte, Three.js or route modules
```

Rules:

- `src/lib/habitat/` must remain independent of Svelte, Three.js and browser presentation.
- Presentation may read authoritative habitat data but must not modify or replace the domain model with mesh state.
- UI components may request generation through public habitat capabilities but must not duplicate generation logic.
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

Cross-boundary consumers of habitat functionality should import through:

```ts
import { generateHabitat, type Habitat } from '$lib/habitat';
```

They should not deep-import implementation files such as:

```ts
import { generateHabitat } from '$lib/habitat/generate-habitat';
```

Private modules within `src/lib/habitat/` may import sibling implementation files directly.

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

## Adding new domain areas

Do not pre-create empty directories for creatures, simulation clocks, language, relationships, persistence or diagnostics.

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
