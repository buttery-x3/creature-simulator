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
            place-feature.ts
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
            arbitration-diagnostics.ts
            arbitration-diagnostics.spec.ts
            *.spec.ts
            resources/
                index.ts
                types.ts
                availability.ts
                consumption.ts
                food-spawn.ts
                weather.ts
                step-resources.ts
                *.spec.ts
            behaviour/
                index.ts
                needs.ts
                actions.ts
                apply-arbitration.ts
                build-arbitration-input.ts
                habitat-feature-query.ts
                perception.ts
                resource-awareness.ts
                step-creature-behaviour.ts
                *.spec.ts
            announcement/
                index.ts
                types.ts
                clarity.ts
                speaking-position.ts
                execution-state.ts
                step-announcement.ts
                *.spec.ts
            memory/
                index.ts
                types.ts
                create-memory.ts
                query.ts
                mutate.ts
                apply-announcement-memory.ts
                apply-sensory-memory.ts
                *.spec.ts
            cognition/
                index.ts
                types.ts
                score-constants.ts
                speech-weight.ts
                target-selection.ts
                build-candidates.ts
                select-intention.ts
                arbitrate.ts
                *.spec.ts
                investigation/
                    signal-candidate.ts
                    curiosity-weight.ts
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
            exploration/
                index.ts
                types.ts
                create-exploration.ts
                update-exploration.ts
                select-exploration-target.ts
                diagnostics.ts
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
                signal-evaluation-view-model.ts
                communication-view-model.ts
                population-lexicon-view-model.ts
                events-view-model.ts
                *.spec.ts
            overview/
            creatures/
                CreaturesTab.svelte
                CreatureRoster.svelte
                CreatureBehaviour.svelte
            communication/
                CommunicationTab.svelte
                PopulationMeaningSummary.svelte
                PopulationLexicons.svelte
            world/
            events/
            debug/
                DebugTab.svelte
                RunCapture.svelte
                run-capture.ts
                *.spec.ts

        SymbolGlyph.svelte
        ThreeViewport.svelte
        habitat-presentation.ts
        rain-presentation.ts
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

| Area                               | Owns                                                                                                                                                 | Does not own                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/determinism/`             | Seeded PRNG and pure seed derivation for independent streams                                                                                         | Habitat layout, creature behaviour, UI                                     |
| `src/lib/habitat/`                 | Authoritative serialisable habitat data (incl. food/water amount/capacity), seeded generation, pure placement, geometry validation and diagnostics   | Creatures, Three.js objects, Svelte state, browser controls                |
| `src/lib/simulation/`              | Authoritative simulation state, creature creation, fixed-step advance, public diagnostics                                                            | Three.js resources, Svelte components, browser rAF ownership               |
| `simulation/resources/`            | Runtime resource availability, consumption grants, food spawn, minimal rain weather                                                                  | Creature intentions, communication, presentation meshes                    |
| `simulation/behaviour/`            | Needs, action execution, apply arbitration, local perception, habitat-feature query, search, thin per-creature step orchestration                    | Intention scoring (cognition), transmission/reception, association updates |
| `simulation/announcement/`         | Announce-resource executor: kind-level clarity, speaking-position search, emission handoff provenance                                                | Intention selection, memory storage semantics, transmission range          |
| `simulation/memory/`               | First-class bounded creature memory container, pure remember/recall/evict, capacity sampling, announcement + observation + heard-signal writes       | Perception ownership, intention selection, transmission, lexicon learning  |
| `simulation/cognition/`            | Runtime-authoritative memory/lexicon-aware intention arbitration (candidates, scores, continuity, ArbitrationRecord)                                 | Movement, emission, perception sensing, memory writes                      |
| `simulation/communication/`        | Arbitrary symbols, emission construction, lexicon/exploratory selection, hearing radius, reception records, emission expiry, communication histories | Evidence/lexicon mutation, memory storage, presentation meshes             |
| `simulation/learning/`             | Raw symbol evidence, exclusive lexicon resolution, investigation arrival learning, learning/lexicon history                                          | Emission construction, reception range, intention selection, presentation  |
| `population-symbol-diagnostics.ts` | Pure observational population evidence/lexicon/emission summaries                                                                                    | Authoritative creature state, selection policy                             |
| `habitat-presentation.ts`          | Habitat mesh build + food/water reconcile-by-id; ground/home rebuild on layout change only                                                           | Creature meshes, simulation stepping                                       |
| `rain-presentation.ts`             | Presentation-only rain drop cue from weather phase                                                                                                   | Authoritative weather or refill                                            |
| `creature-presentation.ts`         | Dynamic creature mesh reconcile by id, action-derived visuals, presentation-only investigation hop                                                   | Authoritative creature state, habitat rebuilds                             |
| `symbol-presentation.ts`           | Shared symbol→shape/label/color registry for viewport and UI                                                                                         | Simulation semantics, Three.js resources                                   |
| `SymbolGlyph.svelte`               | Svelte icon + stable id from the shared registry                                                                                                     | Domain algorithms                                                          |
| `signal-presentation.ts`           | Emission speech bubbles + thin hearing-radius rings + selected investigation overlay                                                                 | Authoritative reception, emission lifetime, association updates            |
| `listener-cue-presentation.ts`     | Coalesced neutral `?` from recent hear (brief) and/or active investigation (held)                                                                    | Investigation decisions, emission construction                             |
| `ThreeViewport.svelte`             | Three.js scene lifecycle, camera framing, creature picking, wiring habitat/creature/signal/listener presentation                                     | Authoritative habitat or creature state                                    |
| `habitat-camera.ts`                | Pure camera-framing and visibility calculations                                                                                                      | Scene construction, simulation state or UI controls                        |
| `src/lib/workbench/`               | Domain-organised workbench UI: tab shell, Overview run controls, Creatures roster/detail, Communication, World, Events, Debug; pure view-models      | Authoritative simulation state, Three.js resources                         |
| `src/routes/+page.svelte`          | Page composition, session simulation state, rAF catch-up, pause/reset, selected creature id                                                          | Domain algorithms, geometry rules or Three.js resource ownership           |
| `ports.ts`                         | Reserved application and test ports                                                                                                                  | Runtime simulation configuration                                           |
| `src/lib/index.ts`                 | Deliberate app-level public exports                                                                                                                  | Private implementation logic or universal re-export of every module        |

## Dependency direction

```text
determinism
        ↓
habitat model and generation
        ↓
simulation (creatures + resources + behaviour + announcement + memory + cognition + communication + learning + fixed-step advance)
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
viewport            -> habitat-presentation, creature-presentation, signal-presentation, listener-cue-presentation, habitat-camera
habitat-camera      -> habitat types
habitat subsystem   -> determinism
simulation          -> determinism + habitat
simulation/resources -> determinism + habitat (placement, resource features); no behaviour/presentation
simulation/behaviour -> simulation sibling modules + habitat (private to simulation); may construct EmissionRequest only; thin hooks into learning/announcement; reads availability via resources
simulation/announcement -> simulation types + habitat + behaviour habitat-feature-query + memory query (private); pure clarity/speaking search; emission requests only
simulation/memory -> simulation types + communication emission shapes + determinism (capacity); pure ops; no presentation
simulation/cognition -> simulation types (CreatureTarget) + memory query + type-only learning/types (CreatureLexicon values); pure snapshot arbitration; no learning algorithms/evidence mutation or presentation
simulation/cognition/investigation -> cognition input/types + memory query; listener-local retained-signal ranking and curiosity weight
arbitration-diagnostics -> simulation types; observational saved arbitration/alternative text; no selection policy
simulation/communication -> simulation types + determinism (private to simulation); reads association values from creature state only; no learning/memory manager role
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

Cognition keeps `arbitrate`, candidate construction and the existing curiosity
function exports at its entry point; only the obsolete newest-only
`selectSignalInvestigationTarget` export is removed. `ArbitrationInput.lexicon` is
required. `IntentionCandidate.signalEvaluations` carries the bounded diagnostic
snapshot through the existing simulation public type; presentation uses that type
rather than deep-importing cognition internals. The internal `investigation/`
files are consumed only by cognition and require no separate app-facing entry.

`arbitration-diagnostics.ts` owns saved arbitration/candidate/retained-signal text;
`diagnostics.ts` composes it into the unchanged public `formatCreatureInspection`.
`creatures/CreatureBehaviour.svelte` owns the selected-creature behaviour and
arbitration section; `view-models/signal-evaluation-view-model.ts` adapts captured
signal rows without scoring or reordering. Both Workbench files depend on the
simulation public entry point only.

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

## Production transport

`server/app.mjs` owns compiled-file HTTP handling and `server/static-server.mjs`
owns its listener lifecycle. Tests live beside the transport. `scripts/deploy.sh`
and `scripts/deploy-remote.mjs` own release operations; they do not import `src/lib`.
See [deployment.md](deployment.md) for build and proxy configuration.

## Overnight experiment topology extensions

These are implemented internal boundaries under the existing simulation and
presentation subsystems; all cross-subsystem imports still use public barrels.

| Location                                                      | Responsibility and dependency                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| simulation/creation/config.ts                                 | Default configuration; imports existing domain defaults                                                        |
| simulation/creation/validation.ts                             | Creation constraints and SimulationCreationError                                                               |
| simulation/creation/creatures.ts                              | Seeded population assembly and traits                                                                          |
| simulation/ecology/{body,wildlife,encounters}.ts              | Body/daylight, local animal motion, physical contact outcomes; habitat/determinism/plain simulation types only |
| simulation/cognition/ecology/physical-candidates.ts           | Pure flee/hunt/night utility from local snapshots; uses pure ecology ability/daylight functions                |
| simulation/behaviour/sensing/sense-creature.ts                | Sensing orchestration, local animal snapshots, exploration updates                                             |
| simulation/behaviour/execution/pursue-action.ts               | Selected physical movement/arrival and announcement completion                                                 |
| viewport/{scene,resources}.ts                                 | Presentation snapshot reconciliation and scene/resource lifecycle, exposed through viewport/index.ts           |
| ecology-presentation/wildlife.ts                              | Animal meshes and daylight adaptation, exposed through ecology-presentation/index.ts                           |
| workbench/creatures/{CreatureEcology,CreatureLanguage}.svelte | Selected physical/local observation panel and existing learned language evidence                               |
| workbench/world/WorldEcology.svelte                           | Observer-only world/encounter panel                                                                            |

Simulation's public entry point additionally exports daylightAt and ecology
types. CreatureTarget gains an explicit wildlife identity variant. Existing
creation exports remain intact. No dependency-direction or threshold exceptions
are introduced. New unit tests are co-located; ecology.e2e.ts uses the route test
convention.

### Grounded danger additions

- cognition/danger/warning-candidates.ts owns warning emission utility, learned
  avoidance utility and freshness policy.
- cognition/ecology/danger-policy.ts owns shared retreat geometry and local or
  remembered route-risk evidence, including stationary exposure for rest.
- behaviour/execution/danger-expression.ts constructs a selected warning request;
  it never assigns symbol meanings or selects an intention.
- learning/reception-learning.ts owns listener-local coincident evidence and calls
  existing evidence/lexicon resolution.
- memory types/mutate/query extend the existing bounded container with local
  danger observations and per-heard-event evidence bookkeeping.
- diagnostics/communication-inspection.ts owns raw communication and learning
  text extracted from the larger selected-creature formatter.
- workbench/communication/PopulationMeaningSummary.svelte presents the per-meaning
  population summary; viewport/camera.ts owns overview/follow camera framing.

No new top-level domain or dependency reversal is introduced. Cognition reads
plain personal association snapshots; communication continues to read lexicon
values without importing learning algorithms.

Acute physiological priority adds `cognition/ecology/need-priority.ts` for the
pure urgency curve and resource-need scoring. `behaviour/execution/reconsideration.ts`
owns event/periodic trigger selection, preserving `stepCreatureBehaviour` as the
orchestrator and the existing public simulation API.

Local rest adds `ecology/rest.ts`, which owns home-footprint distance and physical
recovery by location using habitat geometry and plain data. The independent
destination policy lives in `cognition/ecology/rest-candidate.ts`: it compares
home and current-point utility through the existing danger policy before returning
one candidate. Behaviour supplies innate home geometry to cognition and actual
location recovery to needs; it continues to execute the selected target. These
are internal simulation modules with no new public barrel exports.

### Innate expression presentation topology

- src/lib/expression-presentation/expressions.ts owns shared arc/drop geometry,
  per-creature cue reconciliation, simulation-time animation and disposal.
- src/lib/expression-presentation/index.ts explicitly exports
  createExpressionPresentation. Viewport consumers use this entry point.
- viewport/resources.ts creates/disposes the layer; viewport/scene.ts supplies
  creature snapshots and simulation time.
- workbench/creatures/CreatureSocial.svelte owns the social inspection section,
  composed by CreaturesTab. It reads Creature and deriveMood through the public
  simulation entry point.

This presentation subsystem depends on Three.js and public simulation types only.
It does not import simulation internals, and simulation has no reverse dependency.
Co-located expressions.spec.ts protects expiry, pause-stable animation, reconciliation
and disposal. Existing creature-presentation retains action colors and body/hop
transforms; expression timing does not move into that module.

Social behavior introduces `simulation/social/`: `types.ts` owns serializable
identities and displays, `defaults.ts` retention/timing values, `observe-peers.ts`
local snapshots, `relationships.ts` bounded contact evidence, and `expressions.ts`
derived mood, experienced pain and selected display execution. Its `index.ts`
exports explicit internal APIs; the simulation barrel exposes observation types,
defaults and `deriveMood` for presentation. `cognition/social/candidates.ts` owns
all social decision policy. `behaviour/sensing/wildlife-perception.ts` extracts
existing animal sensing and encounter provenance while `sense-creature.ts`
coordinates resource, animal, peer and exploration sensing. No new dependency
direction or top-level catch-all directory is introduced.

### Lifecycle experiment extension

- simulation/lifecycle/types.ts declares life/config/event/birth-request data.
- defaults.ts owns lifecycle tunables and their validation; physiology.ts owns age,
  juvenile growth, accumulated deprivation and own reproductive eligibility.
- reproduction.ts owns reciprocal contact progress and bounded outcome requests;
  population.ts composes mortality, reproduction and the shared creation factory.
  index.ts exposes only the domain operations needed internally. Four implementation
  files leave four slots; no new top-level subsystem or import exception is needed.
- creation/creatures.ts owns common independent founder/newborn assembly and separate
  seeded spawn streams. It neither copies knowledge nor resolves mating policy.
- cognition/lifecycle/courtship-candidate.ts owns optional courtship utility; social
  observation adds visible maturity, while execution continues under behaviour/.
- workbench/creatures/CreatureLifecycle.svelte and overview/PopulationLifecycle.svelte
  own individual lifecycle and bounded observer event presentation. The simulation
  public barrel exports the life/config/event types and isMature for these consumers.

Tests are co-located. Existing thresholds and dependency direction remain unchanged.
The creature inspector directory now has seven implementation files; future growth in
its substantial composition component should separate identity/perception presentation
at a coherent responsibility boundary before adding more inline sections.

### Evidence format extension preparation

Existing learning/types.ts owns per-meaning evidence/history records, and
signal-associations.ts owns typed record construction and partial reinforcement.
lexicon-resolution.ts owns ordered assignment enumeration. Existing communication,
cognition, diagnostic and workbench consumers use those declared meanings rather
than replicating strength/count fields. No production file, directory or dependency
boundary is added by this representation change. Public symbol-association and
learning-history types change shape; every in-repository consumer is migrated.

### Learned movement extension

- simulation/learning/movement is a named internal sensory-sequence subdomain:
  types/defaults declare bounded records and timing; observations owns hearing
  origin binding, trace progression and response lifetime; evidence applies actual
  outcomes through existing association and lexicon APIs. Four implementation files
  leave capacity before the six-file review trigger. Additional independent motion
  concepts must reassess observation-policy ownership before growing this module.
- cognition/social/movement-policy.ts compares movement call plans and learned
  response bonuses. Existing social and courtship candidate builders call it before
  selecting their best local peer. It owns no transmission or temporal evidence.
- behaviour/execution/movement-expression.ts executes selected calls and releases
  interrupted responses. Sensing and fixed-step communication coordinators invoke
  learning hooks, using only the recipient's actual current observations/heard data.
- Existing CreatureLanguage.svelte owns the sequence inspector inside its learning
  responsibility (about 305 code lines). No eighth creature-inspector file is added;
  further independent language displays should reassess a named inspector boundary.
- Public simulation exports add movement state/trace/response types and defaults.
  External consumers still use the simulation barrel. Existing population diagnostics
  now construct/format all declared meanings through one record-based path.

No threshold, import-direction or repository-rule exceptions are required. Tests
remain colocated, including sequence controls, actual learning/response/re-emission,
call-plan execution and Svelte evidence-panel rendering.

### Observation scenario configuration

Existing simulation/creation owns scenarios.ts as its fourth implementation file:
fixed preset metadata and fresh configuration composition, with no runtime policy.
The simulation public barrel exports scenarioSimulationConfig, SimulationScenarioId
and SIMULATION_SCENARIOS. Tests remain colocated. The route composes run replacement
and maintains active configuration; existing workbench overview controls only stage
and display choices. The observation script consumes the same simulation entry point.
No new subsystem, dependency direction or threshold exception is needed. Creation
has room before its six-file review trigger. Route replacement removes duplicated
creation paths; UI files retain their established control/composition responsibilities.

### Visible companionship extension

`simulation/social/companionship` owns the bounded contact/departure observation
and selected follow episode. This named internal domain separates sensory history
and episode lifetime from relationship accumulation and innate expression.
`cognition/social/follow-candidate.ts` owns follow utility and eligibility, while
`behaviour/execution/follow-action.ts` owns selected movement spacing. Existing
sensing/arbitration/behaviour coordinators invoke these operations. CreatureSocial
extends its existing social-state inspector; no eighth creature component is added.
Tests remain colocated and cross-subsystem consumers use the simulation barrel.
No subsystem dependency direction, repository rule or threshold exception changes.

### Living-generation lexicon observation

The workbench communication presentation adds PopulationLexicons.svelte, extracting
its existing individual matrix from CommunicationTab before adding cohort summaries.
The pure population-lexicon-view-model.ts owns matrix and generation adaptation;
communication-view-model.ts composes it while preserving existing view contracts.
No simulation entry point, authoritative state or learning policy changes.

The view-models directory reaches its six-implementation-file review trigger.
These are six explicit domain-view adaptations, and this change extracts a coherent
population-lexicon responsibility instead of growing the communication aggregate.
There is capacity before the eight-file hard limit. Further independent language
adaptations would justify a communication view-model subdomain; no speculative
layer or threshold exception is introduced now. Communication presentation has
three modules. Unit and rendering tests remain colocated.

### Diagnostic run capture

WorkbenchShell owns a single observer-only serialized capture so it survives tab
navigation and run regeneration. workbench/debug/RunCapture.svelte owns capture,
clipboard/download controls, feedback and temporary browser resource cleanup;
run-capture.ts owns the pure diagnostic bundle serializer. DebugTab owns the
conditional live raw snapshot display. All three debug files depend on simulation
public types/entry points only; no simulation state, storage, replay or import
boundary is added. Capture semantics are documented in architecture.md, Persistence.
