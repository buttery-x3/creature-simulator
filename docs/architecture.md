# Architecture notes

## Current status

The repository has a **seeded bounded habitat**, an **authoritative simulation**
with deterministic creatures and fixed-step bounded wandering, and Three.js
presentation that separates static habitat meshes from dynamic creature meshes.

## Responsibilities present today

| Area                  | Ownership                            | Notes                                                               |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| App shell             | SvelteKit routes under `src/routes/` | Desktop page layout; owns session simulation state and rAF stepping |
| Determinism           | `src/lib/determinism/`               | Seeded PRNG and pure seed derivation for independent streams        |
| Habitat model         | `src/lib/habitat/`                   | Types, seeded generation, geometry validation, diagnostics          |
| Simulation            | `src/lib/simulation/`                | SimulationState, creature creation, fixed-step movement             |
| Habitat workbench     | `src/lib/HabitatWorkbench.svelte`    | Seed controls, pause/resume/reset, habitat + creature diagnostics   |
| WebGL presentation    | `src/lib/ThreeViewport.svelte`       | Scene lifecycle; never owns authoritative world or creature state   |
| Habitat presentation  | `src/lib/habitat-presentation.ts`    | Static habitat mesh build/dispose                                   |
| Creature presentation | `src/lib/creature-presentation.ts`   | Dynamic creature mesh reconcile by id                               |
| Habitat camera        | `src/lib/habitat-camera.ts`          | Near-top-down perspective framing and visibility checks             |
| Reserved ports        | `src/lib/ports.ts`                   | Shared by Vite, Playwright and docs                                 |

## Habitat coordinate convention

- Simulation positions use two coordinates `(x, y)` on the **ground plane**.
- World bounds are a rectangle **centred on the origin**:
  `x ∈ [-width/2, width/2]`, `y ∈ [-height/2, height/2]`.
- Feature `position` is the centre of an axis-aligned footprint (`size.width` ×
  `size.height`).
- Three.js maps simulation `(x, y)` onto its **XY plane**. Vertical extent
  (Three.js `z`) is presentation-only (bush height, creature capsules) and must
  not affect habitat or simulation models.
- Creature `facing` is radians on the ground plane (`0` faces `+x`, positive
  toward `+y`). Presentation applies that as rotation about Three.js `Z`.
- The presentation camera is a **near-top-down perspective** (~80° elevation from
  the ground, slight single-axis tilt, no side yaw) so upright volumes read as
  3D while the layout stays map-like. Framing (`habitat-camera.ts`) pulls the
  camera back until every habitat corner (ground + presentation height) stays
  inside the viewport with a small NDC margin.

## Dependency direction (current)

```
determinism  (seeded RNG + seed derivation; no domain state)
     ↑
habitat      (layout generation only)
     ↑
simulation   (SimulationState, create, step, movement)
     ↑
routes / workbench  (session orchestration, controls, diagnostics)
     ↑
presentation (ThreeViewport + habitat/creature presentation modules)
```

Cross-cutting rules:

- **Three.js is presentation only.** Simulation state, clocks, entities and
  behaviour must not live inside Three.js objects as the system of record.
- Habitat generation and simulation decisions use a **seeded PRNG** only.
  `Math.random()` is forbidden on those paths (UI may still create a random seed
  string for the user).
- **Habitat does not own creatures.** `Habitat` is environmental layout;
  `SimulationState` composes `habitat` and `creatures`.
- Cross-subsystem consumers should import through public entry points
  (`$lib/determinism`, `$lib/habitat`, `$lib/simulation`) rather than deep
  private paths outside those folders.
- Prefer public entry points under `src/lib` and route files over deep ad-hoc trees.
- Do not invent speculative modules for language, persistence or relationships
  beyond what an active issue requires.

## Determinism ownership

| Concern         | Module                                   |
| --------------- | ---------------------------------------- |
| Seeded PRNG     | `src/lib/determinism/seeded-rng.ts`      |
| Seed derivation | `src/lib/determinism/seed-derivation.ts` |
| Public barrel   | `src/lib/determinism/index.ts`           |

Stream isolation:

- Habitat generation uses the **raw** simulation seed with `createSeededRng` so
  existing habitat layouts for current seeds remain stable.
- Creature creation uses `deriveSeed(seed, 'creatures')`.
- Each wander retarget uses `deriveSeed(seed, 'wander', creatureId, decisionIndex)`.
- Closure-owned RNG state is never stored on `SimulationState`.

## Habitat generation ownership

| Concern                      | Module                                |
| ---------------------------- | ------------------------------------- |
| Serializable types           | `src/lib/habitat/types.ts`            |
| Footprint geometry / spacing | `src/lib/habitat/geometry.ts`         |
| Placement + validation       | `src/lib/habitat/generate-habitat.ts` |
| Diagnostic formatting        | `src/lib/habitat/diagnostics.ts`      |
| Public barrel                | `src/lib/habitat/index.ts`            |

Generation places **one home region**, then water regions, then food sources.
Features must stay inside world bounds, respect configurable minimum spacing,
and never overlap the home region. Impossible configurations fail with
`HabitatGenerationError` after bounded attempts; requested counts are never
silently reduced.

## Simulation ownership

| Concern                       | Module                                    |
| ----------------------------- | ----------------------------------------- |
| Serializable types            | `src/lib/simulation/types.ts`             |
| Create habitat + creatures    | `src/lib/simulation/create-simulation.ts` |
| Fixed-step / catch-up advance | `src/lib/simulation/step-simulation.ts`   |
| Turn, move, bound, retarget   | `src/lib/simulation/creature-movement.ts` |
| Diagnostic formatting         | `src/lib/simulation/diagnostics.ts`       |
| Public barrel                 | `src/lib/simulation/index.ts`             |

Simulation advances with a **fixed timestep** (default 30 Hz). The browser
session may use `requestAnimationFrame` with an accumulator; elapsed wall time
is converted into a **bounded** number of fixed steps. The renderer never
advances simulation state.

Creatures spawn inside the home region, face and gradually turn toward wander
targets, move along their facing, and stay inside world bounds. Movement does
not snap facing instantly to the destination.

## Static and dynamic presentation

| Concern                    | Module                             |
| -------------------------- | ---------------------------------- |
| Static habitat meshes      | `src/lib/habitat-presentation.ts`  |
| Dynamic creature reconcile | `src/lib/creature-presentation.ts` |
| Scene / camera / rAF paint | `src/lib/ThreeViewport.svelte`     |

The static habitat group rebuilds only when habitat data changes. Creature
presentation maintains meshes keyed by creature id, updates transforms in place,
and must not rebuild ground, home, water or food meshes during ordinary movement.

## Application target

Desktop web application. Mobile layouts, touch interaction and small-screen product
behaviour are out of scope unless a future issue explicitly expands that target.

## Evolution

When a feature introduces a new durable responsibility, document the ownership split
in the same issue and update this file. Empty placeholder directories and unused
abstractions are forbidden.
