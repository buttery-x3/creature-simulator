# Architecture notes

## Current status

The repository has a **seeded bounded habitat**: plain serialisable world data,
deterministic generation, and Three.js presentation. Creatures and simulation
rules are not present yet.

## Responsibilities present today

| Area               | Ownership                            | Notes                                                      |
| ------------------ | ------------------------------------ | ---------------------------------------------------------- |
| App shell          | SvelteKit routes under `src/routes/` | Desktop page layout; owns active habitat UI state          |
| Habitat model      | `src/lib/habitat/`                   | Types, seeded generation, geometry validation, diagnostics |
| Habitat workbench  | `src/lib/HabitatWorkbench.svelte`    | Seed controls, counts, diagnostic text                     |
| WebGL presentation | `src/lib/ThreeViewport.svelte`       | Reads `Habitat` data; never owns authoritative world state |
| Viewport math      | `src/lib/orthographic-frustum.ts`    | Pure helper; no simulation state                           |
| Reserved ports     | `src/lib/ports.ts`                   | Shared by Vite, Playwright and docs                        |

## Habitat coordinate convention

- Simulation positions use two coordinates `(x, y)` on the **ground plane**.
- World bounds are a rectangle **centred on the origin**:
  `x ∈ [-width/2, width/2]`, `y ∈ [-height/2, height/2]`.
- Feature `position` is the centre of an axis-aligned footprint (`size.width` ×
  `size.height`).
- Three.js maps simulation `(x, y)` onto its **XY plane**. Vertical extent
  (Three.js `z`) is presentation-only (for example bush height) and must not
  affect the habitat model.
- The orthographic camera looks along **-Z** so the full habitat is visible from
  a desktop viewport.

## Dependency direction (current)

```
routes  -->  $lib habitat model (authoritative data)
        -->  $lib HabitatWorkbench (controls / diagnostics)
        -->  $lib ThreeViewport  -->  three (presentation only)
        -->  $lib orthographic-frustum / ports
```

Cross-cutting rules:

- **Three.js is presentation only.** Simulation state, clocks, entities and
  behaviour must not live inside Three.js objects as the system of record.
- Habitat generation uses a **seeded PRNG** only. `Math.random()` is forbidden
  on the generation path (UI may still create a random seed string for the user).
- Cross-subsystem consumers should import habitat through `$lib/habitat` (or the
  re-exports on `$lib`) rather than deep private paths outside that folder.
- Prefer public entry points under `src/lib` and route files over deep ad-hoc trees.
- Do not invent speculative modules for creatures, language, persistence or
  workbench tooling beyond what an active issue requires.

## Habitat generation ownership

| Concern                      | Module                                |
| ---------------------------- | ------------------------------------- |
| Serializable types           | `src/lib/habitat/types.ts`            |
| Seeded RNG                   | `src/lib/habitat/seeded-rng.ts`       |
| Footprint geometry / spacing | `src/lib/habitat/geometry.ts`         |
| Placement + validation       | `src/lib/habitat/generate-habitat.ts` |
| Diagnostic formatting        | `src/lib/habitat/diagnostics.ts`      |
| Public barrel                | `src/lib/habitat/index.ts`            |

Generation places **one home region**, then water regions, then food sources.
Features must stay inside world bounds, respect configurable minimum spacing,
and never overlap the home region. Impossible configurations fail with
`HabitatGenerationError` after bounded attempts; requested counts are never
silently reduced.

## Application target

Desktop web application. Mobile layouts, touch interaction and small-screen product
behaviour are out of scope unless a future issue explicitly expands that target.

## Evolution

When a feature introduces a new durable responsibility, document the ownership split
in the same issue and update this file. Empty placeholder directories and unused
abstractions are forbidden.
