# Architecture notes

## Current status

The repository has a **seeded bounded habitat**, an **authoritative simulation**
with deterministic creatures, physiological needs, resource-driven goals/actions,
transient arbitrary signals, personal symbol association learning, fixed-step
movement, and Three.js presentation that separates static habitat meshes from
dynamic creature and signal meshes. Creatures can be selected for inspection;
selection is presentation state only.

## Responsibilities present today

| Area                      | Ownership                                             | Notes                                                                       |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| App shell                 | SvelteKit routes under `src/routes/`                  | Desktop page; session simulation state, rAF stepping, creature selection id |
| Determinism               | `src/lib/determinism/`                                | Seeded PRNG and pure seed derivation for independent streams                |
| Habitat model             | `src/lib/habitat/`                                    | Types, seeded generation, geometry validation, diagnostics                  |
| Simulation                | `src/lib/simulation/`                                 | SimulationState, creation, step, needs/decisions/actions                    |
| Behaviour subdomain       | `src/lib/simulation/behaviour/`                       | Needs, decisions, actions, local perception, search, resource targets       |
| Announcement subdomain    | `src/lib/simulation/announcement/`                    | Resource opportunities, kind-level clarity, speaking position, preparation  |
| Communication subdomain   | `src/lib/simulation/communication/`                   | Arbitrary symbols, context-sensitive emission, reception, histories, expiry |
| Learning subdomain        | `src/lib/simulation/learning/`                        | Raw symbol evidence, exclusive lexicon resolution, investigation            |
| Population diagnostics    | `src/lib/simulation/population-symbol-diagnostics.ts` | Observational evidence/lexicon/emission summaries (pure)                    |
| Workbench UI              | `src/lib/workbench/`                                  | Domain-tab shell (Overview…Debug), pure view-models, presentation-only nav  |
| WebGL presentation        | `src/lib/ThreeViewport.svelte`                        | Scene lifecycle, pick ray; never owns authoritative creature state          |
| Habitat presentation      | `src/lib/habitat-presentation.ts`                     | Static habitat mesh build/dispose                                           |
| Creature presentation     | `src/lib/creature-presentation.ts`                    | Dynamic mesh reconcile + action visuals + investigation hop                 |
| Symbol presentation       | `src/lib/symbol-presentation.ts`                      | Shared glyph shape/label/color registry (presentation only)                 |
| Signal presentation       | `src/lib/signal-presentation.ts`                      | Speech bubbles + thin hearing-radius rings + investigation overlay          |
| Listener cue presentation | `src/lib/listener-cue-presentation.ts`                | Neutral `?` on recent hear (brief) or while investigating (held)            |
| Announcement cue          | `src/lib/announcement-cue-presentation.ts`            | Dashed creature→trigger-feature lines (presentation only)                   |
| Habitat camera            | `src/lib/habitat-camera.ts`                           | Near-top-down perspective framing and visibility checks                     |
| Reserved ports            | `src/lib/ports.ts`                                    | Shared by Vite, Playwright and docs                                         |

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
simulation   (SimulationState, create, step, behaviour, communication, learning)
     ↑
routes / workbench  (session orchestration, domain-tab UI, selection, diagnostics)
     ↑
presentation (ThreeViewport + habitat/creature/signal presentation modules)
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

| Concern                             | Module                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| Serializable types                  | `src/lib/simulation/types.ts`                             |
| Create habitat + creatures          | `src/lib/simulation/create-simulation.ts`                 |
| Fixed-step / catch-up advance       | `src/lib/simulation/step-simulation.ts`                   |
| Turn, move, bound, retarget         | `src/lib/simulation/creature-movement.ts`                 |
| Need progression                    | `src/lib/simulation/behaviour/needs.ts`                   |
| Goal evaluation / commitment        | `src/lib/simulation/behaviour/decisions.ts`               |
| Action transitions                  | `src/lib/simulation/behaviour/actions.ts`                 |
| Habitat feature spatial query       | `src/lib/simulation/behaviour/habitat-feature-query.ts`   |
| Local perception + tracking         | `src/lib/simulation/behaviour/perception.ts`              |
| Resource target lookup              | `src/lib/simulation/behaviour/resource-awareness.ts`      |
| Per-creature behaviour step         | `src/lib/simulation/behaviour/step-creature-behaviour.ts` |
| Symbol inventory + emission helpers | `src/lib/simulation/communication/emission.ts`            |
| Lexicon / exploratory symbol select | `src/lib/simulation/communication/symbol-selection.ts`    |
| Local reception                     | `src/lib/simulation/communication/reception.ts`           |
| Communication fixed-step            | `src/lib/simulation/communication/step-communication.ts`  |
| Evidence init / reinforce           | `src/lib/simulation/learning/signal-associations.ts`      |
| Exclusive lexicon resolution        | `src/lib/simulation/learning/lexicon-resolution.ts`       |
| Pending / investigation score       | `src/lib/simulation/learning/signal-investigation.ts`     |
| Learning fixed-step hooks           | `src/lib/simulation/learning/step-signal-learning.ts`     |
| Population symbol diagnostics       | `src/lib/simulation/population-symbol-diagnostics.ts`     |
| Diagnostic formatting               | `src/lib/simulation/diagnostics.ts`                       |
| Public barrel                       | `src/lib/simulation/index.ts`                             |

Simulation advances with a **fixed timestep** (default 30 Hz). The browser
session may use `requestAnimationFrame` with an accumulator; elapsed wall time
is converted into a **bounded** number of fixed steps. The renderer never
advances simulation state.

### Needs, goals, actions and targets

These concepts are distinct on each creature:

| Concept    | Role                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Need**   | Internal condition: `hunger` and `thirst` are **pressure** (0 = sated/quenched, 1 = maximum); `energy` is **satisfaction** (0 = exhausted, 1 = full). Values stay finite and clamped to `[0, 1]`. |
| **Goal**   | Outcome pursued: `seek_food`, `seek_water`, `rest`, `investigate_signal`, or `wander`.                                                                                                            |
| **Action** | Current step: `move`, `investigate` (stop at signal origin), `eat`, `drink`, `sleep`, `wander`, or `search`.                                                                                      |
| **Target** | Habitat feature id/kind or a free-space point for wandering.                                                                                                                                      |

Need rates, thresholds, reconsideration interval, goal-switch margin and recovery
targets live on `SimulationConfig` (not scattered literals).

Decision evidence is structured simulation data (`DecisionRecord`,
`CandidateEvaluation`, bounded `recentTransitions`) produced when goals are
chosen. The inspector formats those records; it must not invent reasons from
need values alone.

### Local sensing, search and brief tracking

Creatures use **local perception**, not global food/water knowledge.

| Knowledge            | Rule                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **Home**             | Innate. Always targetable for rest regardless of sensing distance. Never stored in perception.      |
| **Food / water**     | Selectable only when currently perceived or retained as the single short-lived tracked observation. |
| **Long-term memory** | Not present. No permanent discovered-location map.                                                  |

Sensing:

- Configurable circular **sensing radius** on the ground plane (`sensingRadius`).
- Updates at `perceptionIntervalSeconds` via `behaviour/perception.ts`.
- Nearby features come only through the named query boundary
  `behaviour/habitat-feature-query.ts` (linear scan; circle ∩ authoritative
  footprint). Facing does not restrict sensing. No LOS/occlusion.
- Perception state on each creature is plain serialisable
  (`CreaturePerception`: last update time, perceived food/water ids,
  observation snapshot, optional `tracked`).

Search:

- When `seek_food` / `seek_water` is valid but no usable resource target exists,
  the action is **`search`** (not `wander`), with a deterministic point target
  from the `search` seed stream (`sampleSearchTarget`).
- Perceiving a relevant resource transitions search → `move` toward that feature
  and starts brief tracking.

Brief tracking:

- While pursuing a resource, a single `tracked` observation may remain usable
  for `trackedObservationDurationSeconds` after the feature leaves the radius.
- Expiry without reacquisition keeps the need-driven goal and returns to `search`.

Creatures interact with **simulation footprints** (`featureRect`), not
presentation-only bush meshes. Food and water are not depleted.

The selected-creature **sensing-radius overlay** in the viewport is
presentation-only (reads config radius + selection id); Three.js never computes
authoritative perception.

### Transient signals and local reception

Communication is a named subdomain under simulation (`simulation/communication/`).
It is the first communication substrate: physical emission and local hearing only.

| Concern             | Rule                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symbols**         | Small arbitrary inventory (`glyph-0` …). No global meaning; no hard-coded food/water/danger mapping.                                                                                          |
| **Emission**        | Authoritative transient `SignalEmission` on simulation state (id, symbol, sender, origin, times). Optional hidden `provenance` for announcement diagnostics.                                  |
| **Initial trigger** | Resource-announcement lifecycle: newly perceived food/water feature → opportunity → kind-level clarity (reposition if needed) → emit from creature position. Need-independent.                |
| **Cooldown**        | Configurable per-sender cooldown may delay queued opportunities; does not merge or discard them.                                                                                              |
| **Symbol choice**   | Exact exclusive lexicon assignment for the announced kind when assigned; otherwise deterministic exploratory selection among unassigned symbols. No production floor or speaker feedback.     |
| **Reception**       | Finite circular hearing radius (default **12** on the 20×20 habitat — practical population reach, not structural global); omnidirectional; sender excluded; receivers ordered by creature id. |
| **Heard result**    | Structured `HeardSignal` history only — **no** goal/action/need/target/perception change; never carries trigger feature, clarity or episode id.                                               |
| **Lifetime**        | Active emissions expire by fixed-step clock; bounded recent histories on creatures and simulation.                                                                                            |

### Resource announcement lifecycle

Announcement is a named subdomain (`simulation/announcement/`). It replaces need-gated
discovery emission.

| Concern                 | Rule                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature vs kind**     | Feature id owns episodes, provenance, diagnostics and the dashed cue. Resource kind (`food`/`water`) owns clarity, symbol selection and learning meaning.                                                                                                        |
| **Perception episodes** | Continuous per-feature visibility on the creature; enter creates one episode; stay does not re-create; leave ends episode; re-enter starts a new episode.                                                                                                        |
| **Opportunities**       | One opportunity per episode; distinct same-kind features may each create opportunities; deterministic feature-id order; bounded queue.                                                                                                                           |
| **Clarity**             | Pure kind-level rule: `d_opposite − d_announced ≥ clarityMargin` (or no opposite in scope). Same-kind features never compete. Scope = perception observations ∪ habitat food/water within max(sensing, speaking-search) radius.                                  |
| **Preparation**         | Unclear contexts set goal `prepare_announcement`, move toward a deterministic speaking position; re-evaluate clarity each step; emit when clear and cooldown allows. Committed against ordinary replan (investigation travel still blocks starting preparation). |
| **Signal origin**       | `SignalEmission.origin = creature.position` at emission time (never the resource).                                                                                                                                                                               |
| **Hidden provenance**   | Opportunity id, episode id, trigger feature, clarity evidence on emission/request; not on `HeardSignal`.                                                                                                                                                         |
| **Presentation cue**    | Thin dashed creature→trigger-feature line (`announcement-cue-presentation.ts`); active opportunity only; fades after emit; presentation-only.                                                                                                                    |

### Personal symbol learning and investigation

Learning is a named subdomain under simulation (`simulation/learning/`). It owns
receptive meaning only: raw personal food/water evidence, exclusive lexicon
resolution, pending heard-signal candidates, active investigation state and
bounded learning / lexicon-change histories. There is **no** global symbol
dictionary. Evidence **mutation** remains listening/investigation only.
Emission uses the creature’s resolved exclusive lexicon (learned path) or
deterministic exploratory selection when unassigned — never independent
multi-context weighted sampling, and never speaker-success feedback.

| Concern               | Rule                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Evidence**          | Per-creature `foodStrength` / `waterStrength` per symbol, clamped, start at zero. May be ambiguous/overlapping across meanings. Independent arrays (no shared references).                 |
| **Lexicon**           | Exclusive one-to-one assignment (`food` / `water` → symbol or null). Deterministic max-total-evidence non-duplicating resolve after evidence updates.                                      |
| **Curiosity trait**   | Per-creature `curiosity` sampled at creation via `deriveSeed(seed, 'curiosity', id)` and `curiosityRange`. Serialisable state.                                                             |
| **Pending signals**   | Built from `HeardSignal` only (no `contextDetail`); bounded, deduped by emission id, expire deterministically.                                                                             |
| **Goal / action**     | `investigate_signal` goal: `move` toward recorded origin, then `investigate` (stop, no movement).                                                                                          |
| **Scoring**           | `(curiosity×weight + needs×evidence) × distanceFactor − agePenalty` with `distanceFactor = 1/(1+d/scale)`. Uses raw evidence, not exclusive lexicon.                                       |
| **Explore exemption** | `wander → investigate_signal` skips `goalSwitchMargin` (min commitment still applies). Survival goals keep full hysteresis.                                                                |
| **Travel lock**       | Once committed, rising needs do not interrupt the trip; no active travel timeout. Pending unselected signals may still expire.                                                             |
| **Reinforcement**     | Only on **arrival** at the origin: force local perception, qualify food/water within evidence radius, reinforce at most once, then recompute lexicon.                                      |
| **Completion**        | Clear active investigation and replan immediately after site inspection (food / water / mixed / no_evidence).                                                                              |
| **No-evidence**       | Conservative: leave evidence unchanged by default (optional small reduction via config); still recompute lexicon.                                                                          |
| **Production**        | Communication emits `lexicon[context]` when assigned; otherwise exploratory among symbols not assigned to another meaning. Learning never mutates evidence because someone heard a signal. |

Fixed-step order (authoritative):

1. Behaviour for all creatures (needs, perception episodes, announcement opportunities/preparation, expire pending, decisions including investigation, movement or site inspection+completion, emission requests).
2. Communication: apply emission requests (sorted by sender id), select receivers using **post-behaviour** positions, write histories, expire active emissions.
3. Learning post-reception: convert newly heard signals (`heardAt === timeSeconds`) into pending investigation candidates (may prompt wander reconsider).

**Eligibility:** a signal heard in step _N_ becomes pending at the end of step _N_ and is eligible for investigation scoring from step _N+1_. No Svelte/renderer timing.

**Investigation lifecycle:** hear → pending → choose investigate → travel to origin → stop (`investigate`) → sense → update evidence → resolve exclusive lexicon → clear active → replan.

Behaviour may produce an `EmissionRequest` handoff; it must not implement range, receivers or lifetime. Learning never reads emitter `contextDetail`, sender lexicons or presentation glyph metadata. Three.js and Svelte only present/inspect; they never decide who hears a signal or update evidence/lexicon.

### Context-sensitive emission and population diagnostics

Communication owns deterministic symbol selection
(`communication/symbol-selection.ts`):

- **Learned path:** if `creature.lexicon[context]` is assigned and in inventory, emit that symbol (`mode: learned_lexicon`)
- **Exploratory path:** when unassigned, seeded uniform pick among inventory symbols not assigned to another meaning (if none remain, full inventory); `mode: exploratory`
- Seed stream (exploratory only): `deriveSeed(seed, 'communication', 'context-symbol', creatureId, emissionCount, contextDetail)`
- Each `SignalEmission` stores structured `selectionEvidence` (mode, assigned symbol, candidates, sample); `HeardSignal` stays free of context and selection evidence

Population-level metrics (`population-symbol-diagnostics.ts`) are **pure
derived observations** (raw evidence means, exclusive lexicon assignment
shares, unassigned counts, learned vs exploratory emission counts, emission
concentration/entropy). They never alter evidence, lexicons, selection, or
create a shared dictionary. Workbench panels and text diagnostics must use
observational language (“most assigned for food in lexicon”, “highest mean food
evidence”, “most emitted in window”), never “the food symbol.”

Signal and communication visuals are presentation-only:

- **Shared registry** (`symbol-presentation.ts`) maps each inventory `SymbolId` to an
  arbitrary shape (star/circle/triangle/square), label, and secondary color. Used by
  Three.js signals, speech bubbles, and workbench diagnostics (`SymbolGlyph.svelte`).
  Shape is primary identity; color is reinforcement only. No built-in resource meaning.
- **Speech bubbles** (`signal-presentation.ts`) follow the sender’s current position
  for the active emission lifetime (fallback: emission origin). Billboards face the camera.
- **Thin propagation rings** expand from `SignalEmission.origin` toward configurable
  `hearingRadius`. Opacity uses shared `distanceFalloffFactor` × lifetime fade. The
  ring is an **illustrative** range/falloff cue — hearing remains instantaneous within
  radius at emission time (no propagation delay).
- **Listener `?` cues** (`listener-cue-presentation.ts`) show one neutral mark per
  creature when it has a recent `HeardSignal` (brief pulse) **or** while
  `activeInvestigation` is set (held for the full investigation). Coalesced per
  listener; not a symbol-identity cue.
- **Announcement trigger cues** (`announcement-cue-presentation.ts`) draw a thin
  dashed line from the announcing creature to the opportunity’s trigger feature
  while preparing and briefly after emission. Omniscient diagnostics only.
- **Investigation hop** (`creature-presentation.ts`) is a one-shot vertical
  presentation offset when `activeInvestigation` commitment changes. Authoritative
  position is never modified.
- Selected-creature investigation line/marker remains presentation-only.

### Wandering and commitment

Wandering remains the fallback when no need-driven goal is sufficiently
important. Ordinary reconsideration is periodic (not every step). Goal switching
uses hysteresis (`goalSwitchMargin`) and minimum commitment time so tiny score
differences do not thrash behaviour, **except** the documented explore exemption
for `wander → investigate_signal`. Invalid targets and finished eat/drink/sleep/
investigation actions force immediate replan.

### Persistence

Running simulation state is plain serialisable in-memory data. There is **no**
database, IndexedDB, local storage or schema migration layer. Snapshots and
experiment history are future concerns.

## Static and dynamic presentation

| Concern                      | Module                                     |
| ---------------------------- | ------------------------------------------ |
| Static habitat meshes        | `src/lib/habitat-presentation.ts`          |
| Dynamic creature reconcile   | `src/lib/creature-presentation.ts`         |
| Symbol presentation registry | `src/lib/symbol-presentation.ts`           |
| Dynamic signal reconcile     | `src/lib/signal-presentation.ts`           |
| Heard-listener cue reconcile | `src/lib/listener-cue-presentation.ts`     |
| Announcement trigger cues    | `src/lib/announcement-cue-presentation.ts` |
| Scene / camera / pick        | `src/lib/ThreeViewport.svelte`             |

The static habitat group rebuilds only when habitat data changes. Creature
presentation maintains meshes keyed by creature id, updates transforms in place,
derives action visuals from authoritative `action`, and must not rebuild ground,
home, water or food meshes during ordinary movement.

### Creature selection

Selected creature id lives on the **page / workbench** (presentation state).
Three.js raycasting reports picks; selecting a creature must not alter simulation
behaviour or authoritative state.

## Application target

Desktop web application. Mobile layouts, touch interaction and small-screen product
behaviour are out of scope unless a future issue explicitly expands that target.

## Evolution

When a feature introduces a new durable responsibility, document the ownership split
in the same issue and update this file. Empty placeholder directories and unused
abstractions are forbidden.
