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

Physical ecology and grounded danger language are implemented and checked.
The next increment corrects an observed acute-need utility trap before adding
relationships and innate expression. See the completed checkpoints below.

The implementation sequence remains physical world, grounded danger language,
relationships/innate expression, lifecycle, then voluntary learned social
communication. Performance, diagnostics, scale and evidence-backed refactoring
follow. Communities, construction, beliefs/idols and moral communication are
later opportunities only after the earlier sequence is complete.

## Verification and review backlog

- Baseline hashes and listener-meaning sources verified.
- Full quality gates are recorded per checkpoint below.
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

## Checkpoint 2: grounded danger language

Implemented: danger joins exclusive personal food/water
lexicons, locally grounded reception learning, mixed evidence, episode/event
deduplication, warning emission while retreating, voluntary learned avoidance,
and fading warning/direct danger knowledge. Known warnings never automatically
invite approach to their origin. The same heard form can be unknown or learned
as food by another creature. Fresh known warnings can interrupt sleep; urgent
known water can still win. A full-memory replacement hearing bug is fixed so
newly heard evidence triggers reconsideration even when memory count is unchanged.

Observation extends personal/population evidence to danger and adds a follow
selected creature camera option. The optional feature addendum was read as
guidance: keep one starting group and small semantics, deepen local interactions,
and pursue safety/help only once available actions can ground them.

Defaults: both warning decision lifetime and direct hazard memory lifetime are
12 seconds. Episode provenance is bounded; sender intent remains observer-only.
Short matched runtime tests learn from actual reception/arrival before comparing
known, unknown, conflicting and stale cases; no successful translation is preset.
Longer-run comparisons currently show fewer rapid flee/rest reversals but worse
thirst pressure in some seeds. This is an observed tradeoff, not a causal claim
that communication improves survival.

Validation: full `npm run check` passed (470 unit tests, server test, build,
10 browser tests; Linux-only deployment fixture skipped). Continuous sightings
retain their episode onset independently of bounded memory eviction; capacities
1 and 2 and expired/reacquired encounters have regression coverage.
Three updated 600-second runs and duplicate 60-second full-state traces remained
bounded and deterministic. Thirst pressure in river/drought increased; targeted
traces found full-energy nighttime rest and generic investigation outranking
maximal blind thirst search. The next checkpoint addresses this utility defect.

Structure: reception learning owns its distinct evidence window; bounded danger
memories and cognition risk policies extend existing domains. Communication
formatting and follow-camera geometry have extracted owners. No threshold or
dependency-direction changes. Population-symbol diagnostics remains a reviewed
aggregation responsibility at about 365 code lines; future independent evidence
formats should use the diagnostics subdomain.

Next frontier: acute-need scoring and recovery reconsideration, then relationships
and innate expression. Off-home rest remains a measured follow-up.

Browser observation: Chromium demo reached 149.033 simulated seconds at 8x.
The population panel showed five creatures with assigned danger forms and seven
unassigned; creature 0 had distinct food/water/danger forms. Sender context was
explicitly labeled observer-only. Follow mode centered the selected creature
without advancing paused simulation time; disabling it restored full framing.
Screenshots were inspected; no page errors or apparent stalls were observed.
