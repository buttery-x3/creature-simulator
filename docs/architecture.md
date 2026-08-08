# Architecture notes

## Current status

The repository has a **seeded bounded habitat**, an **authoritative simulation**
with deterministic creatures, physiological needs, unified intention arbitration
and low-level actions, transient arbitrary signals, personal symbol association
learning, fixed-step movement, and Three.js presentation that separates static
habitat meshes from dynamic creature and signal meshes. Creatures can be selected
for inspection; selection is presentation state only.

## Responsibilities present today

| Area                      | Ownership                                             | Notes                                                                                 |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| App shell                 | SvelteKit routes under `src/routes/`                  | Desktop page; session simulation state, rAF stepping, creature selection id           |
| Determinism               | `src/lib/determinism/`                                | Seeded PRNG and pure seed derivation for independent streams                          |
| Habitat model             | `src/lib/habitat/`                                    | Types (incl. food/water amount/capacity), seeded generation, placement, diagnostics   |
| Simulation                | `src/lib/simulation/`                                 | SimulationState, creation, step, needs/intentions/actions                             |
| Resources subdomain       | `src/lib/simulation/resources/`                       | Availability, consumption grants, food spawn, minimal rain weather                    |
| Behaviour subdomain       | `src/lib/simulation/behaviour/`                       | Needs, action execution, perception, search, thin step orchestration                  |
| Announcement subdomain    | `src/lib/simulation/announcement/`                    | Executor under announce_resource: clarity, speaking position, emission handoff        |
| Memory subdomain          | `src/lib/simulation/memory/`                          | First-class bounded creature memory; observations, heard signals, announcement recall |
| Cognition subdomain       | `src/lib/simulation/cognition/`                       | Runtime-authoritative memory-aware intention arbitration                              |
| Communication subdomain   | `src/lib/simulation/communication/`                   | Arbitrary symbols, context-sensitive emission, reception, histories, expiry           |
| Learning subdomain        | `src/lib/simulation/learning/`                        | Raw symbol evidence, exclusive lexicon, investigation arrival learning                |
| Population diagnostics    | `src/lib/simulation/population-symbol-diagnostics.ts` | Observational evidence/lexicon/emission summaries (pure)                              |
| Workbench UI              | `src/lib/workbench/`                                  | Domain-tab shell (Overview…Debug), pure view-models, presentation-only nav            |
| WebGL presentation        | `src/lib/ThreeViewport.svelte`                        | Scene lifecycle, pick ray; never owns authoritative creature state                    |
| Habitat presentation      | `src/lib/habitat-presentation.ts`                     | Static habitat mesh build/dispose                                                     |
| Creature presentation     | `src/lib/creature-presentation.ts`                    | Dynamic mesh reconcile + action visuals + investigation hop                           |
| Symbol presentation       | `src/lib/symbol-presentation.ts`                      | Shared glyph shape/label/color registry (presentation only)                           |
| Signal presentation       | `src/lib/signal-presentation.ts`                      | Speech bubbles + thin hearing-radius rings + investigation overlay                    |
| Listener cue presentation | `src/lib/listener-cue-presentation.ts`                | Neutral `?` on recent hear (brief) or while investigating (held)                      |
| Habitat camera            | `src/lib/habitat-camera.ts`                           | Near-top-down perspective framing and visibility checks                               |
| Reserved ports            | `src/lib/ports.ts`                                    | Shared by Vite, Playwright and docs                                                   |

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
simulation   (SimulationState, create, step, resources, behaviour, announcement, memory, communication, learning)
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
- Memory capacity uses `deriveSeed(seed, 'memory-capacity', creatureId)`.
- Verbosity uses `deriveSeed(seed, 'verbosity', creatureId)` (independent of placement).
- Closure-owned RNG state is never stored on `SimulationState`.

## Habitat generation ownership

| Concern                      | Module                                |
| ---------------------------- | ------------------------------------- |
| Serializable types           | `src/lib/habitat/types.ts`            |
| Footprint geometry / spacing | `src/lib/habitat/geometry.ts`         |
| Placement + validation       | `src/lib/habitat/generate-habitat.ts` |
| Pure place-candidate helper  | `src/lib/habitat/place-feature.ts`    |
| Diagnostic formatting        | `src/lib/habitat/diagnostics.ts`      |
| Public barrel                | `src/lib/habitat/index.ts`            |

Generation places **one home region**, then water regions, then food sources.
Features must stay inside world bounds, respect configurable minimum spacing,
and never overlap the home region. Impossible configurations fail with
`HabitatGenerationError` after bounded attempts; requested counts are never
silently reduced. Food and water start at full `amount = capacity`; home has no
quantity fields. Runtime food spawn reuses pure placement (`tryPlaceFeature`).

## Simulation ownership

| Concern                                 | Module                                                            |
| --------------------------------------- | ----------------------------------------------------------------- |
| Serializable types                      | `src/lib/simulation/types.ts`                                     |
| Create habitat + creatures              | `src/lib/simulation/create-simulation.ts`                         |
| Runtime resources + rain                | `src/lib/simulation/resources/`                                   |
| Fixed-step / catch-up advance           | `src/lib/simulation/step-simulation.ts`                           |
| Turn, move, bound, retarget             | `src/lib/simulation/creature-movement.ts`                         |
| Need progression                        | `src/lib/simulation/behaviour/needs.ts`                           |
| Apply arbitration + action transitions  | `src/lib/simulation/behaviour/apply-arbitration.ts`, `actions.ts` |
| Habitat feature spatial query           | `src/lib/simulation/behaviour/habitat-feature-query.ts`           |
| Local perception                        | `src/lib/simulation/behaviour/perception.ts`                      |
| Resource target lookup                  | `src/lib/simulation/behaviour/resource-awareness.ts`              |
| Per-creature behaviour step             | `src/lib/simulation/behaviour/step-creature-behaviour.ts`         |
| Unified intention arbitration           | `src/lib/simulation/cognition/`                                   |
| Announcement executor (clarity/emit)    | `src/lib/simulation/announcement/`                                |
| Symbol inventory + emission helpers     | `src/lib/simulation/communication/emission.ts`                    |
| Lexicon / exploratory symbol select     | `src/lib/simulation/communication/symbol-selection.ts`            |
| Local reception                         | `src/lib/simulation/communication/reception.ts`                   |
| Communication fixed-step                | `src/lib/simulation/communication/step-communication.ts`          |
| Evidence init / reinforce               | `src/lib/simulation/learning/signal-associations.ts`              |
| Exclusive lexicon resolution            | `src/lib/simulation/learning/lexicon-resolution.ts`               |
| Investigation execution helpers         | `src/lib/simulation/learning/signal-investigation.ts`             |
| Learning fixed-step hooks               | `src/lib/simulation/learning/step-signal-learning.ts`             |
| Memory types / create / query / mutate  | `src/lib/simulation/memory/`                                      |
| Announcement-memory post-emission write | `src/lib/simulation/memory/apply-announcement-memory.ts`          |
| Population symbol diagnostics           | `src/lib/simulation/population-symbol-diagnostics.ts`             |
| Diagnostic formatting                   | `src/lib/simulation/diagnostics.ts`                               |
| Public barrel                           | `src/lib/simulation/index.ts`                                     |

Simulation advances with a **fixed timestep** (default 30 Hz). The browser
session may use `requestAnimationFrame` with an accumulator; elapsed wall time
is converted into a **bounded** number of fixed steps. The renderer never
advances simulation state.

### Finite renewable resources and rain (FLAME-77)

| Concern                | Rule                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Food**               | Finite `amount`/`capacity`. Eating withdraws quantity. At zero the feature is **removed**. New food spawns later at new valid positions with **new ids**, time-driven and capped by `maxActiveFoodSources` (not hunger-driven). |
| **Water**              | Fixed basin geography/ids. Drinking withdraws amount; at zero the basin **remains** but is unavailable until rain refills all basins to capacity.                                                                               |
| **Availability**       | Shared pure rule: `available ⇔ amount > 0`. Perception, targets, announcement clarity, and investigation evidence use available resources only.                                                                                 |
| **Consumption grants** | Multi-consumer allocation is deterministic (creature-id order). Need recovery from eat/drink is bounded by actual grants (1:1 with recovery units).                                                                             |
| **Weather**            | Minimal `clear` \| `rain` on `SimulationState.environment`. Rain start refills water; rain is presentation-visible only as a cue.                                                                                               |
| **Ownership**          | `simulation/resources/` owns runtime lifecycle; habitat owns geometry/placement; behaviour does not mutate habitat.                                                                                                             |

Authoritative fixed-step order:

1. Resources/weather (rain, food spawn, eat/drink consumption grants)
2. Behaviour (needs apply grants; perception; unified arbitration; action execution)
3. Resource-observation memory (sensing pass only; empty water via geography query)
4. Communication
5. Successful-announcement memory
6. Heard-signal memory (from this step’s reception; no sender identity)
7. Request reconsideration for listeners that gained heard_signal this step

### Needs, intentions, actions and targets

These concepts are distinct on each creature:

| Concept       | Role                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Need**      | Internal condition: `hunger` and `thirst` are **pressure** (0 = sated/quenched, 1 = maximum); `energy` is **satisfaction** (0 = exhausted, 1 = full). Values stay finite and clamped to `[0, 1]`. |
| **Intention** | What the creature is trying to accomplish: `satisfy_hunger`, `satisfy_thirst`, `rest`, `investigate_signal`, `announce_resource`, `wander`. Selected only by cognition.                           |
| **Action**    | Current step: `move`, `investigate` (stop at signal origin), `eat`, `drink`, `sleep`, `wander`, or `search`.                                                                                      |
| **Target**    | Habitat feature id/kind or a free-space point.                                                                                                                                                    |

Need rates, thresholds, reconsideration interval, continuity/baselines and recovery
targets live on `SimulationConfig` (not scattered literals). There is no
goal-switch margin or min-commitment gate — continuity is a soft score bonus in
cognition.

Decision evidence is structured simulation data (`ArbitrationRecord`, candidates
with factors/reason codes, bounded `recentTransitions`) produced when intentions
are chosen. The inspector formats those records; it must not invent reasons from
need values alone.

### Local sensing, search and memory-driven targets

Creatures use **local perception** plus **retained memory**, not global omniscience.

| Knowledge            | Rule                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**             | Innate. Always targetable for rest regardless of sensing distance. Never stored in perception.                                                                                                     |
| **Food / water**     | Cognition may select currently perceived usable resources or newest usable resource_observation memory. Missing knowledge → `search` fallback.                                                     |
| **Long-term memory** | First-class `creature.memory` (bounded capacity). Kinds: resource announcements, resource observations (position + water empty), heard signals (symbol + origin). Authoritative for investigation. |

Sensing:

- Configurable circular **sensing radius** on the ground plane (`sensingRadius`).
- Updates at `perceptionIntervalSeconds` via `behaviour/perception.ts`.
- Nearby features come only through the named query boundary
  `behaviour/habitat-feature-query.ts` (linear scan; circle ∩ authoritative
  footprint). Facing does not restrict sensing. No LOS/occlusion.
- Perception always runs (no investigation freeze). Perception state is plain
  serialisable (`CreaturePerception`: last update time, perceived food/water ids,
  observation snapshot). No tracked-observation secondary memory.
- Resource perception changes **request arbitration**; they do not directly seize action.

Search:

- When `satisfy_hunger` / `satisfy_thirst` is selected with **no** destination
  (search fallback), the action is **`search`** (not `wander`), with a deterministic
  point from the `search` seed stream (`sampleSearchTarget`).
- Remembered resource beliefs use a **point** at the stored observation position and
  **`move`** toward it; sensing/memory updates correct stale beliefs only when near.
- Currently perceived resources use authoritative **feature** targets (depletion can
  invalidate mid-pursuit).

Creatures interact with **simulation footprints** (`featureRect`), not
presentation-only bush meshes. Food and water have finite quantities (see
resource lifecycle above); empty water basins are not selectable as available
resources.

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
| **Initial trigger** | Cognition may select `announce_resource` for a currently perceived unannounced resource; the announcement **executor** then evaluates clarity, may reposition, and requests emission.         |
| **Cooldown**        | Configurable per-sender cooldown may delay emission while execution is active; it does not create or retain a queue of deferred announcements.                                                |
| **Symbol choice**   | Exact exclusive lexicon assignment for the announced kind when assigned; otherwise deterministic exploratory selection among unassigned symbols. No production floor or speaker feedback.     |
| **Reception**       | Finite circular hearing radius (default **12** on the 20×20 habitat — practical population reach, not structural global); omnidirectional; sender excluded; receivers ordered by creature id. |
| **Heard result**    | Structured `HeardSignal` history only — **no** intention/action change; never carries trigger feature or clarity. Writes `heard_signal` memory and may request reconsideration only.          |
| **Lifetime**        | Active emissions expire by fixed-step clock; bounded recent histories on creatures and simulation.                                                                                            |

### Resource announcement execution

Announcement is a named subdomain (`simulation/announcement/`). It is an
**executor** under the cognition-selected `announce_resource` intention — not a
discovery-driven opportunity lifecycle.

Authoritative path:

```text
currently perceived unannounced resource
→ cognition may generate announce_resource candidate
→ unified arbitration may select it
→ announcement executor handles clarity / reposition / emission handoff
```

| Concern                 | Rule                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature vs kind**     | Feature id owns provenance, diagnostics and the dashed cue. Resource kind (`food`/`water`) owns clarity, symbol selection and learning meaning.                                                                                                                        |
| **Execution state**     | At most one `activeAnnouncementExecution` per creature while intention is `announce_resource` (feature, kind, evaluating/repositioning, speaking target, initial clarity). Not a behavioural lock; ordinary arbitration may replace the intention and clear execution. |
| **No discovery queue**  | Perception changes request arbitration only. Cognition evaluates all valid intentions; unselected resources are not retained as deferred announcement tasks.                                                                                                           |
| **Announcement memory** | Successful accepted emissions write `resource_announcement` on `creature.memory` (feature id + emission id, not position). Suppresses later announce candidates for that feature while retained. Oldest-first eviction.                                                |
| **Clarity**             | Pure kind-level rule: `d_opposite − d_announced ≥ clarityMargin` (or no opposite in scope). Same-kind features never compete. Local scope only = perception observations ∪ habitat food/water within max(sensing, speaking-search) radius.                             |
| **Reposition**          | Unclear contexts set execution state `repositioning`, move toward a deterministic local speaking position; re-evaluate clarity each step; request emission when clear and cooldown allows. Interruptible via ordinary arbitration.                                     |
| **Signal origin**       | `SignalEmission.origin = creature.position` at emission time (never the resource).                                                                                                                                                                                     |
| **Hidden provenance**   | Trigger feature (+ optional position/clarity) on emission/request for diagnostics and memory; not on `HeardSignal`.                                                                                                                                                    |
| **Memory boundary**     | `resource_announcement` is written only after communication accepts the emission (`applySuccessfulAnnouncementMemories`). Successful same-step emit defers `action_complete` arbitration until the next behaviour step so cognition sees that memory.                  |

Do not rebuild discovery-episode or accepted/rejected opportunity ownership.
Investigation remains hear → memory → reconsider → (maybe) `investigate_signal`.

### Personal symbol learning and investigation

Learning is a named subdomain under simulation (`simulation/learning/`). It owns
receptive meaning only: raw personal food/water evidence, exclusive lexicon
resolution, execution-local investigation context and bounded learning /
lexicon-change histories. There is **no** global symbol dictionary. Evidence
**mutation** remains listening/investigation only. Emission uses the creature’s
resolved exclusive lexicon (learned path) or deterministic exploratory selection
when unassigned — never independent multi-context weighted sampling, and never
speaker-success feedback.

| Concern           | Rule                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Evidence**      | Per-creature `foodStrength` / `waterStrength` per symbol, clamped, start at zero. May be ambiguous/overlapping across meanings. Independent arrays (no shared references).                 |
| **Lexicon**       | Exclusive one-to-one assignment (`food` / `water` → symbol or null). Deterministic max-total-evidence non-duplicating resolve after evidence updates.                                      |
| **Selection**     | Cognition may select `investigate_signal` from `heard_signal` memory (no pending queue, no curiosity gate).                                                                                |
| **Execution**     | Slim `activeInvestigation` holds emission/symbol/origin while travelling/inspecting. Not a lock — ordinary arbitration may replace the intention.                                          |
| **Reinforcement** | Only on **arrival** at the origin: ephemeral local inspection of food/water within evidence radius (learning-only), reinforce at most once, then recompute lexicon.                        |
| **Completion**    | Clear active investigation and re-arbitrate immediately after site inspection (food / water / mixed / no_evidence).                                                                        |
| **No-evidence**   | Conservative: leave evidence unchanged by default (optional small reduction via config); still recompute lexicon.                                                                          |
| **Production**    | Communication emits `lexicon[context]` when assigned; otherwise exploratory among symbols not assigned to another meaning. Learning never mutates evidence because someone heard a signal. |
| **Out of scope**  | Curiosity/confidence weighting (later issue).                                                                                                                                              |

### Creature memory

Memory is a named subdomain (`simulation/memory/`). It is **not** perception,
announcement execution state, communication history, or lexicon evidence.

| Concern          | Rule                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Container**    | `creature.memory`: `capacity`, monotonic `nextSequence`, `entries[]`. Plain JSON-serialisable.                                                                                                                                                                                            |
| **Capacity**     | Integer sampled at creation from `memoryCapacityRange` via independent seed stream. ≥ 1. Not intelligence-derived. All kinds share one capacity.                                                                                                                                          |
| **Entry kinds**  | `resource_announcement`, `resource_observation` (feature + position + water `empty`), `heard_signal` (symbol + origin + emissionId; no sender).                                                                                                                                           |
| **Ops**          | Pure `remember` / `recall` / `evictToCapacity` — callers do not hand-edit `entries`. Oldest-sequence-first eviction when full. Observations refresh by featureId; heard signals dedupe by emissionId.                                                                                     |
| **Write timing** | Observations after behaviour when a sensing pass ran; announcements after successful emissions; heard signals after reception this step.                                                                                                                                                  |
| **Recall**       | Cognition consults `hasResourceAnnouncementMemory(featureId)` to suppress re-announce candidates. Pure cognition also recalls observations and heard signals for candidate targets/scores (`listResourceObservations`, `listHeardSignalMemories`, `findNewestUsableResourceObservation`). |
| **Not in scope** | Salience curves, probabilistic forgetting, sender provenance, confidence, time-decay models.                                                                                                                                                                                              |

### Cognition / intention arbitration (runtime-authoritative)

Cognition is a named subdomain (`simulation/cognition/`). It is **pure** and
**runtime-authoritative**: given a body + perception + memory + current-intention
snapshot it builds a small candidate set, scores simply, applies soft continuity,
and returns an `ArbitrationRecord`. Behaviour applies that record; no other
subsystem selects intentions.

| Concern            | Rule                                                                                                                                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Placement**      | `simulation/cognition/` — not more helpers under capacity-full `behaviour/`.                                                                                                                                                                                                                                                      |
| **Runtime status** | **Authoritative.** Single decision system; legacy goal/lock/opportunity machinery removed.                                                                                                                                                                                                                                        |
| **Candidates**     | `satisfy_hunger`, `satisfy_thirst`, `rest`, `investigate_signal`, `announce_resource`, `wander`. No predator/social/mating types.                                                                                                                                                                                                 |
| **Need targets**   | Perception first (feature target), then newest usable resource memory as a **point** at the stored position (water skips `empty: true`), else `target: null` + `search_fallback`. Remote habitat changes do not invalidate remembered points.                                                                                     |
| **Need scores**    | `pressure × targetQuality` where quality is config-driven: **visible > remembered > search**. Factors expose raw pressure and `target_quality` multiplier. Blind search is materially discounted so actionable alternatives can win.                                                                                              |
| **Signal**         | From `heard_signal` memory only (newest sequence). Point target at origin. No lexicon or confidence. Modest baseline + simple sequence recency; tuned to beat **blind** need search without symbol meaning.                                                                                                                       |
| **Announce**       | Perceived available resource not suppressed by `resource_announcement` memory. Score = `announceBaseline × verbosity` (preference only; validity unchanged). Full-talkative baseline sits above wander/max signal and below bare-threshold _visible_ need. Deterministic feature-id pick. Clarity/speaking-position are executor. |
| **Verbosity**      | Lifetime-stable per-creature scalar in `[0, 1)`, sampled at creation from an independent seed channel. Generic speech preference — first consumer is `announce_resource` scoring only. Not a personality framework; not mutated over time; does not gate eligibility, hearing, or investigation.                                  |
| **Continuity**     | Soft score bonus on the current non-wander intention (modest anti-thrash only). Wander gets no continuity stickiness. No min-commitment, switch-margin, investigation/announcement locks.                                                                                                                                         |
| **Triggers**       | `ArbitrationTrigger` values request reconsideration only; they never force an intention.                                                                                                                                                                                                                                          |
| **Evidence**       | Structured `ArbitrationRecord` / factors / reason codes (incl. target quality) — workbench formats factors; UI strings are not authority.                                                                                                                                                                                         |

Fixed-step order (authoritative):

1. Resources/weather: advance rain schedule (refill basins on rain start), food-spawn opportunities, resolve eat/drink consumption grants against habitat (deterministic creature-id order).
2. Behaviour for all creatures (needs apply consumption grants; perception always; request/run unified arbitration; execute intention via actions/movement; announcement executor when intention is announce; arrival learning when investigating).
3. Memory: `resource_observation` writes/refreshes for creatures whose perception sensing ran this step (available food from snapshot; water via `availableOnly: false` geography query; forget food when re-sensing proves feature gone).
4. Communication: apply emission requests (sorted by sender id), select receivers using **post-behaviour** positions, produce authoritative `emittedThisStep`, write bounded histories, expire active emissions.
5. Memory: write `resource_announcement` entries from **`emittedThisStep` only** (not from bounded `recentEmissions` / diagnostic retention).
6. Memory: write `heard_signal` entries from `recentHeard` with `heardAt === timeSeconds` (no sender identity).
7. Request reconsideration (`pendingArbitrationTrigger = new_heard_signal_memory`) for listeners that gained heard_signal this step.

**Eligibility:** a signal heard in step _N_ is remembered at the end of step _N_ and is investigable from step _N+1_ via ordinary arbitration. No Svelte/renderer timing.

**Investigation lifecycle:** hear → `heard_signal` memory → request arbitration → (if selected) investigate intention → travel to origin → stop (`investigate`) → sense → update evidence → resolve exclusive lexicon → **consume that emission’s `heard_signal` memory** → clear execution context → re-arbitrate. Successful arrival inspection consumes the actionable chirp (including `no_evidence`); interruption before inspection retains the memory so it may be selected again.

**Announcement lifecycle:** cognition selects `announce_resource` → executor evaluates clarity / speaking position / emit → no behaviour lock; stronger needs interrupt via ordinary continuity scoring.

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
  `hearingRadius`. Opacity uses shared `distanceFalloffFactor` × lifetime fade with
  presentation-only `investigationDistanceScale`. The ring is an **illustrative**
  range/falloff cue — hearing remains instantaneous within radius at emission time
  (no propagation delay). Distance falloff does **not** affect investigation eligibility.
- **Listener `?` cues** (`listener-cue-presentation.ts`) show one neutral mark per
  creature when it has a recent `HeardSignal` (brief pulse) **or** while
  `activeInvestigation` is set (held for the full investigation). Coalesced per
  listener; not a symbol-identity cue.
- **Investigation hop** (`creature-presentation.ts`) is a one-shot vertical
  presentation offset when `activeInvestigation` commitment changes. Authoritative
  position is never modified.
- Selected-creature investigation line/marker remains presentation-only.

### Wandering and reconsideration

Wandering remains the fallback when no other valid intention scores higher.
Ordinary reconsideration is periodic (not every step). Continuity is a **soft
score bonus** on the current non-wander intention only — no min-commitment gate
or goal-switch margin. Event triggers (`pendingArbitrationTrigger`) request
reconsideration without prescribing the winner. Invalid targets and finished
eat/drink/sleep/investigation actions force immediate replan. Consumptive
eat/drink/sleep suppress ordinary periodic reconsideration until recovery
completion (deliberately atomic physical actions).

### Persistence

Running simulation state is plain serialisable in-memory data. There is **no**
database, IndexedDB, local storage or schema migration layer. Snapshots and
experiment history are future concerns.

## Static and dynamic presentation

| Concern                      | Module                                 |
| ---------------------------- | -------------------------------------- |
| Static habitat meshes        | `src/lib/habitat-presentation.ts`      |
| Dynamic creature reconcile   | `src/lib/creature-presentation.ts`     |
| Symbol presentation registry | `src/lib/symbol-presentation.ts`       |
| Dynamic signal reconcile     | `src/lib/signal-presentation.ts`       |
| Heard-listener cue reconcile | `src/lib/listener-cue-presentation.ts` |
| Scene / camera / pick        | `src/lib/ThreeViewport.svelte`         |

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
