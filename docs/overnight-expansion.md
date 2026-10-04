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

Physical ecology, grounded danger language, acute-need scoring, local rest,
bounded relationships and innate expression are implemented and checked. Lifecycle
and population turnover are implemented and observed, including natural births
and eventual extinction. The next increment is grounded social movement learning.

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

## Checkpoint 3: acute needs remain competitive

Implemented: above 0.9 hunger/thirst, smooth urgency restores up to 80% of the
uncertainty discount. Visible, remembered and unknown targets retain ordered
quality; extreme blind search can now defeat high-curiosity generic information
including continuation. Night rest preference tapers over the top 30% of energy.
A different acute need can request periodic arbitration during recovery without
forcing a switch or bypassing the existing timer.

Focused tests cover both known and mistaken signal interpretations, severe
danger competition, smooth scoring, recovery timing, continued useful drinking
and interruption of sleeping/eating. Ordinary lower-pressure quality remains
unchanged; an old maximum-hunger/visible-water assertion was intentionally
narrowed to subcritical hunger because this is the policy being corrected.

Observation: three 600-second runs remain deterministic with bounded memory and
no movement stalls above 2 seconds. Results are mixed: longest drought thirst
episode fell from 248 to 73 seconds, but river high-thirst time increased from
1201 to 4217 creature-seconds and low-energy time increased from 106 to 1839.
This is a known unfavorable interaction, not a claim of improved ecology.
The next measured question is exhausted home travel and off-home rest.

Structure: pure need-priority scoring and event-trigger selection have explicit
internal owners; public entry points, dependency directions and limits remain
unchanged. The behavior root stays at capacity; further execution policies
belong below its existing execution domain.

Validation: quality gate components passed (486 unit tests, server check, build,
10 browser tests). One initial browser run missed the canvas at startup; the
focused retry and entire browser suite subsequently passed. At 132.8 simulated
seconds in the night browser observation, creature 0 selected hunger with raw
quality 0.350, effective quality 0.870 and score 0.920 over investigation 0.660.
A creature at energy 0.84 had an invalid rest candidate; literal full energy is
covered by the focused test. Screenshots were inspected; no page errors.

Targeted river trace: 744 low-energy rest/travel samples versus 18 rest/sleep
samples. One exhausted creature spent 105 seconds without sleeping while home
remained 2.86–15.9 units away. Movement worked and water was locally known;
mandatory home recovery is the concrete next limitation.

## Checkpoint 4: rest where recovery is possible

The current increment gives the existing rest intention two destination options:
innately known home or the creature's exact current location. Shared local
danger knowledge penalizes travel and lingering exposure before selecting one.
Home has full recovery; outdoor sleep recovers energy at 75% of that rate.
There is no global safe-place search or guaranteed refuge. Exhaustion reduces
willingness to travel for better recovery; all rest choices still compete with
other utility candidates.

Validation: full `npm run check` passed (495 unit tests, server check, production
build, 10 browser tests). Three 600-second runs remain deterministic and bounded.
Exhaustion fell from 294/1839/440 to 49/202/184 creature-seconds across demo, river
and drought; exhausted home travel was zero. Hunger fell in all three runs.
Thirst improved in demo/river but worsened in drought (1300 to 1766 creature-
seconds). No survival or ecological balance is claimed. The maximum stationary
movement proxy was 3 seconds, with no persistent pursuit stall.

Defaults: outdoor recovery multiplier 0.75; home travel effort weight 0.04 per
unit, scaled by fatigue. Rest site scores and recovery multipliers are visible
in saved candidate factors. No global safety inference or safe-location search.

Browser observation at 132.233 simulated seconds showed creature 1 sleeping at
a point outside home, with local score 0.595 versus home 0.527 and recovery 0.750.
Creature 3 simultaneously slept at home with recovery 1.000; creature 11 still
chose travel home. Screenshots were inspected and no page errors occurred.

Structure: rest destination policy and physical recovery geometry have separate
cohesive owners, with shared risk scoring applied once. Both ecology directories
have four implementation modules; behaviour root remains at eight. No public
boundary, dependency-direction or threshold changes. Next: bounded relationships
and innate expression, followed by lifecycle.

## Checkpoint 5: relationships and innate expression

Implemented: local peer identities, up to eight personal relationships,
familiarity from real co-presence, liking from comfortable encounters and
distinct observed dances, and mood derived from welfare/pain/company.
Voluntary approach, dance and cry compete through ordinary arbitration.
Approach stops at one unit or loses contact; displays last one second and
share a twelve-second start cooldown with a 0.004 energy cost. No social-need
meter, automatic help, peer blame, copied dictionary or source-trust shortcut.

Three 600-second natural runs observed 65/8/6 dances and 0/2/0 cries, bounded
relationships (maximum eight), and at most eleven observed peers. No natural
approach was observed in these pressured default runs. Controlled tests cover
approach and survival competition; observations do not prove cooperation.
Full quality gate passed: 528 unit tests, server check, build and 10 browser
tests. Two older trait-only experiments now hold displays on cooldown so they
continue isolating verbosity/curiosity instead of accidentally measuring the
new social alternatives.

Controlled affinity evidence: 120 seconds of actual local contact at fixed
positions (movement and physiological drift disabled for that experiment) builds
familiarity/liking; after movement resumes, the familiar peer is approached and
the matched stranger is not. No relationship value or successful translation is
preset in this comparison. Natural default runs remain reported separately.

Structure: the social domain owns bounded contact, mood and display state;
cognition/social owns optional choice. Wildlife sensing was extracted before
enlarging the sensing coordinator. Peer targets resolve only from fresh local
snapshots. Expression presentation has its own lifecycle owner. Behaviour and
source boundaries retain their direction and limits; the creature inspector
directory now has six implementation files, leaving two slots.

Browser validation: natural demo dances at 0.233s showed gold arcs; at about
32s the inspector showed differing learned familiarity/liking alongside separate
symbol evidence. River creature 10 cried at 594.033s, with visible blue tears and
intensity 0.88. Screenshots were inspected; there were no page errors.

Reproducibility limit discovered during observation: the browser UI and isolated
browser core are byte-identical at initialization, step 1 and step 900. Node and
browser agree initially, then differ in low floating-point bits by step 900
(e.g. x=9.651572396897771 versus 9.65157239689777). By step 17166 their decisions
and positions differ. Browser-core replay reproduces the browser trajectory;
this is not a UI/renderer/config mutation. Headless trace hashes are reproducible
within the tested runtime, not a cross-runtime bit-exact promise. Browser event
times should be observed there rather than copied from Node traces.

Next: complete lifecycle with growth, reciprocal voluntary courtship, independent
offspring learning and actual mortality; remove the temporary injury floor.

## Checkpoint 6: lifecycle and turnover

Implemented: seeded founder ages, juvenile growth, mature reciprocal courtship,
independent newborn assembly, sustained deprivation, ageing and actual death.
Selected courtship approaches a locally observed familiar adult, then requires
three seconds of mutual contact. Either creature can choose another action.
An unanswered contact attempt ends after six seconds and retries no sooner than
fifteen seconds later. Birth consumes 0.2 energy and adds 0.15 hunger to both
parents, with a 120-second reproductive cooldown. Compatible means any pair of
mature, sufficiently well-conditioned creatures; no sex/genetics/childcare model.

Eligibility requires health/energy at least 0.6, hunger/thirst at most 0.5, acquired
familiarity at least 0.2 and liking at least 0.04. These are accelerated configurable
experiment values. Newborn size/physicality grow from half an independent seeded
adult baseline to full size at 90 seconds; founders start 90–240 seconds old.
Deprivation at need>=0.95 has45s hunger/25s thirst grace, then damages health at
0.004/0.006 per second. Exposure decays at2s/s when relieved. Senescence starts
at 540 seconds and damages health at0.004/s; maximum age 900 seconds prevents
sleep healing from making creatures immortal. The injury floor is removed.

The population cap 64 is disclosed as a computational limit. A completed pair at
capacity gets a recorded failure and cooldown; no newborn is secretly removed.
Monotonic IDs survive deaths. The last 32 lifecycle events are observer history,
not all-time counters. Dead creatures leave the living roster, and nearby targets
clear by ordinary sensing; distant personal memories are not erased by omniscience.

Offspring start with independent empty dictionaries, associations, spatial
exploration, memory and relationships. Integration tests demonstrate actual
hearing, voluntary investigation and arrival evidence teaching a newborn water
for the same glyph its parent assigns to food; mixed evidence remains mixed.
No copied dictionary, successful translation or parenting knowledge is injected.

Validation: full npm run check passed 568 unit tests, server check, build and
11 browser tests. The offspring/lost-peer regressions are included.

Natural 600-second Node runs: demo produced 2 births, 10 deaths and 4 survivors;
river and drought produced no births and became extinct at 580.267s and 463.733s.
Highest observed generation was 1. These are genuine outcomes, not guaranteed
population stability. Histories remained bounded, with no memory violations or
saturated lifecycle history. Hunger remained substantial. The dynamic harness
uses integrated alive creature-time, records births/deaths from roster changes,
and reports null mean needs after extinction. Old fixed-population comparisons
were removed because death changes the denominator. Full results/configuration
are in overnight-observation-results.md; same-runtime repeated trajectories match.

Structure: lifecycle is a named internal state-machine boundary with four
implementation modules (defaults/validation, physiology, reproduction and population
orchestration; declaration types are excluded from capacity); cognition owns
courtship policy, creation owns shared assembly, and existing behaviour owns
execution. Public call shapes remain intact; state/config/types extend to carry
lifecycle and bounded observer events. No dependency-direction, threshold or
repository-rule exceptions were required. The simulation barrel remains an
explicit export list with its already documented headroom pressure. The substantial
creature inspector adds composition only; its directory reaches seven files, with
identity/perception extraction the next concrete split point if it grows again.

Browser observation used normal paused Step controls with no state injection.
Natural child 12 (parents 3+5) at 20.233s had age 9.533s and size 0.4223; at 80.233s
it had age 69.533s and size 0.6769, with visibly larger body and matching inspector.
Founder 0 died by 380.233s; selected identity and follow mode cleared, the camera
returned to overview, and the inspector showed no stale selection. Population
was 4 at 600.233s and 0 by 800.233s. At 900.233s the bounded history retained 2 births,
14 deaths and 2 failed courtships; empty-population age displayed a dash. Four
screenshots were inspected and there were no page errors. These are browser
observations, not assumed copies of Node timing. Growth render uses authoritative
body size; UI callbacks did not create births or restore the population.

Function headroom: pursuit execution 141 code lines, simulation step 98, shared
creature assembly 87 and reproduction resolution 110; no function limits raised.

Next frontier: one grounded learned social movement concept, followed by deeper
interactions, observation clarity and scale work. Come/go/stop are not yet learned
meanings; courtship and innate displays do not confer those translations.

## Checkpoint 7: consistent meaning evidence

Preparation for temporal social learning replaces repeated food/water/danger
strength/count fields with an evidence record keyed by the existing meaning list.
Learning histories use before/after records, partial reinforcement changes only
requested meanings, and exclusive resolution enumerates the declared meanings
in the same deterministic order. Inspector and population diagnostics iterate the
same list. There is no new meaning or behavioral policy in this checkpoint.

This addresses concrete pressure from adding approach next and possible go/stop
later. Learning retains evidence ownership, cognition selects intentions, and
presentation reads the simulation public entry point. No new module, dependency
direction, threshold or directory-capacity exception is introduced. Exported
association/history data shapes change; all current consumers are migrated.
The substantial population diagnostics module only changes field access; it does
not acquire another responsibility. Further diagnostic policy growth should
separate aggregation from report formatting before expanding that file.

Validation: full npm run check passed 573 unit tests, server check, build and 11
browser tests. Three extra evidence tests cover independent nested records,
frozen-source partial reinforcement, history snapshot independence and count
preservation under confidence reduction; two workbench regressions cover meaning
iteration and aggregation. Normalized full-state replay against committed lifecycle
8d05fba matched at every step from initialization through 60 seconds for demo,
river and drought (1800 steps each). Only association/history representation fields
were normalized; decisions, learning, positions, offspring and histories matched.
The archived-source comparison and hashes are retained in the ignored local
.svelte-kit/evidence-migration directory. This is evidence for the representation
migration, not a cross-runtime reproducibility claim.
