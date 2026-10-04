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
and eventual extinction. Grounded approach learning and reproducible scenario presets
are implemented and observed, including voluntary visible companionship/following.
Personal meanings are observable by living generation. The measured empty-hearing
fast path is implemented with exact trajectory checks. Useful-companionship discovery credit is deferred: all four observed resource
handoffs across three rich 900s runs led to already-known resources. Current work
separates physical reception from bounded display history for crowded calls. The
verified quiet-communication shortcut and on-demand diagnostic capture are
implemented and checked. The need-search continuity correction is implemented and checked: ongoing search
points survive same-need reconsideration without suppressing interrupts. Next is
a measured larger-world scenario assessment with the existing local knowledge
and computational limits explicit.

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
at 540 seconds and damages health at 0.004/s; maximum age 900 seconds prevents
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

## Checkpoint 8: learned local approach

Implemented a fourth meaning, approach: a personally learned prediction of local
closing interaction, not a universal come/follow command. A heard glyph is paired
only with a uniquely visible peer near its origin; no hidden sender identity,
intention or emission label enters the learner. The peer's own closing movement
and comfortable contact must be observed. Two distinct retained encounters are
required for assignment. Listener-only movement, absent hearing and ambiguous
source controls do not teach successful approach. Missing or incomplete sight is
unobserved, while fully watched stationary/withdrawing context gives approach-only
counterevidence. Food/water/danger evidence stays independent and may compete.

Cognition owns both a modest learned-response bonus and a silent-versus-calling
movement plan. The actual score factors expose those choices. Affiliation and own
condition still matter; urgent thirst or danger can win. Responses expire from
original hearing, are spent on arrival/loss/interruption, and cannot extend through
call spam. Learned approach does not chase a stale sound origin. Calls occur only
under a selected plan, once per selected approach/court episode plus 12s cooldown;
a response to that peer cannot echo a call back. The same actually trained learner
later re-emits its acquired arbitrary glyph through real communication in a test.

Defaults: 16 encounter records, 4 pending traces, 4s observation/response window,
12s absence to end an encounter, 0.25 origin-binding radius, 0.35 peer closing travel,
1 unit contact distance, 0.5s comfortable contact at own comfort>=0.65. Confirmations
reinforce by the existing 0.25; contradiction reduces approach strength by 0.1.
Response bonus is capped at 0.12 before confidence/condition/affiliation factors;
calling benefit 0.06×verbosity×affiliation minus 0.01 effort remains in ordinary
utility. Overall approach/court optional score remains capped at 0.6 before existing
continuity/risk rules. All bounds and numeric states passed extended observation.

Natural 600s Node runs (demo/river/drought): 22/11/9 approach calls, of which 0/0/2
used the sender's learned approach glyph. Observed sequence outcomes were
24/11/28 confirmed, 94/54/81 contradicted and 258/212/243 unobserved. Peak assigned
approach carriers were 2/1/4; none remained assigned at the end. These outcomes
include learning from any heard glyph paired with motion, not only sender-labelled
approach calls. Final populations were 5/1/0, births 3/1/2, highest generations 2/1/1;
drought became extinct at 587.733s. Surviving demo generations 1 and 2 held personally
learned water/danger meanings. No transmission or stable convention is guaranteed.
Max encounters 13/11/11 and pending 4; no bound violation or saturated recorded history.

Browser: all four trace outcomes and bound/ambiguous/unseen sources occurred
naturally. At 4.267s creature 2 had a confirmed observation of creature 1, closing
0.36327 units, closest distance 0.27000 and comfortable contact 0.50s; its lexicon
still remained unassigned, correctly separating one observation from a meaning.
At 50.267s creature 0 showed approach=glyph2, strength 0.750 and count 3. Seven
screenshots were inspected; the fourth column fitted and no page errors occurred.
The binding label now says Latest local binding so it is not confused with an
expanded older peer trace.

Structure: learning/movement is a named bounded observation-state subdomain with
four implementation modules. Movement policy and execution each have explicit
owners; the main sensory/step coordinators only invoke them. No file limits,
directory limits, dependencies or repository rules were raised. The sequence
coordinator is about 300 code lines; new independent motion concepts should split
policy there before repeated growth. Existing CreatureLanguage remains cohesive
at 305 lines; no eighth inspector file was added. Population diagnostics became
meaning-driven and shrank. Public simulation call shapes remain unchanged; new
serialized movement state/types and the fourth meaning are exposed deliberately.

Validation: full npm run check passed 606 unit tests, server check, build and
11 browser tests. All three 600s runs held memory/sequence bounds and the repeated
60s full-state trajectory matched. Next: deepen the
observed learning/turnover interactions and make reproducible observation scenarios
easier to run; go/stop and extended following remain future supported concepts.

## Checkpoint 9: reproducible observation presets

Added Baseline, More food/fewer predators, and Population stress (32) presets.
They share one configuration factory between browser and headless runs. Rich
conditions change only initial food to 8, food cap to 12, spawn interval to 8s and
wildlife count to 2. Crowded changes only founder count to 32. The population cap
remains 64. Choosing a preset stages it; Regenerate applies it, Random seed uses
it, and Reset restores the active run's seed and preset. Playback, stepping,
viewport and diagnostics all use the active configuration. Failed regeneration
leaves the current run intact.

Three rich 900s observations finished with 6/1/3 creatures, 9/3/7 births and highest
generations 3/2/2. Learned approach calls numbered 18/36/34, with 3/1/2 assigned
survivors. Three crowded 600s observations finished with 3/0/1 creatures and
1/0/1 births; river became extinct at 584.967s. This is pressure evidence, not a
promise of balanced survival. Both preset batches passed bounded-state checks
and identical 60s full-state repeats. Full configuration, methodology and results
are in overnight-resource-rich-observations.md and overnight-crowded-observations.md.
The earlier baseline report remains a separate recorded experiment.

Validation: full npm run check passed 620 unit tests, server check, build and
13 browser tests. New tests cover exact preset overrides, independent nested
configs, deterministic creation, food cadence and active-vs-draft controls.
Three browser screenshots were inspected with no page errors. Actual playback
and single-step both followed the selected 8s spawn cadence.

Structure: creation gains one cohesive configuration module (four implementation
files total), exposed by the existing simulation barrel. Existing route and
workbench control contracts gain scenario inputs; no new subsystem, dependency
rule, threshold or topology exception. Route creation paths were consolidated;
its implementation shrank. Simulation behavior is unchanged apart from explicit
starting configuration. Next: voluntary visible companionship/following grounded
in recent encounters, plus clearer observation of personal meanings across generations.

## Checkpoint 10: bounded physical following

Added follow_peer as an optional physical intention after a familiar, liked
companion is directly observed in comfortable stationary contact and then departing.
It uses no new symbol meaning, hidden target, private needs or shared resource map.
One recent contact, one active episode and one last outcome bound retention.
Following participates in ordinary utility and danger-route scoring. A selected
visible resource action or urgent competing need can interrupt immediately.

Defaults: contact within 1 unit for at least 0.5s with both creatures moving at
most 0.2 units/s, own comfort >=0.65 at both observation endpoints, acquired
familiarity >=0.2 and liking >=0.04. A peer must move outward at least 0.35 within
4s of qualified contact. Crossing that departure threshold requests one event-based
reconsideration. Following keeps 1.5 units separation and requires visible peer
distance <=3. It ends after 8s, 6 units of own travel, sight loss, visible turn-back,
a visible predecessor ahead of the peer, or no 0.2-unit peer progress for 1.5s.
A 12s cooldown prevents immediate restart. The 0.44 utility ceiling includes
continuity. These are reversible design defaults, not scripted successful cooperation.
Local geometry cannot detect an unseen global chain; finite duration/path and
cooldown prevent indefinite continuation regardless. Repeated contact cannot
refresh an active episode's deadline.

Natural observations: rich 900s runs produced 7/3/2 follow episodes, with final
populations 6/6/1 and highest generations 4/2/2. Four episodes ended when a visible
resource won arbitration. That outcome code (resource_found) does not establish
new discovery or causal help. Baseline 600s produced 1/0/6 episodes; crowded 600s
produced none. All nine runs had zero follow, movement-memory and general memory
bound violations, and each scenario's 60s complete-state repeat matched. Reports
are overnight-follow-rich-observations.md, overnight-follow-baseline-observations.md
and overnight-follow-crowded-observations.md. Population declines and extinctions
remain possible; the mechanism is not tuned to guarantee survival.

Browser: rich/demo creature 5 followed creature 4 at 35s, with a selected score
of 0.315 over exploration 0.300. The episode started at 34.7s and ended at 37.9s
on visible turn-back, after 0.831 units; cooldown lasted until 49.9s. Four screenshots
(contact, active, ended, arbitration) were inspected with no page errors. The
social inspector shows acquired contact/departure, actual score factors, episode
clock/path and end reason. No follow glyph is presented as learned.

Tests include actual acquisition of familiarity through local encounters; own
movement and first sight of a moving group cannot fabricate qualified departure.
A fixed-water runtime case first lets only the peer sense the basin. After a local
encounter, the peer selects its own remembered water location, the follower with
no water knowledge voluntarily follows its observed motion, enters sight range,
and selects the now-visible basin. A matched no-qualified-contact control does
not follow. This is a controlled mechanism test, distinct from natural-run evidence.
Further tests cover needs/danger, hidden-position invariance after sight loss,
spacing, expiry, path limits, no progress, visible chain/turn-back and cooldown.

Structure: social/companionship has three behavior modules plus types and its
barrel. Cognition adds one follow policy; behaviour adds one physical executor.
Existing sensing/arbitration coordinators invoke these owners. The public simulation
barrel exposes observation types/defaults; stepping signatures and learned lexicon
remain unchanged. No threshold, dependency or repository-rule changes. The existing
replanFromArbitration (157 code lines) and pursueAction (152) cross the 150-line review
trigger but only add domain delegation, keeping independent policy in its owner.
Further action/state lifecycles should split physical dispatch from announcement/
arrival coordination before growing these functions. CreatureSocial remains a
cohesive social inspector around 260 lines with no eighth directory component.

Validation: full npm run check passed 650 unit tests in 79 files, the server
check, build and 13 browser tests. The Linux deployment fixture remains skipped
on this Windows host. Three scenario batches and natural browser observation
passed as recorded above. Next: show current personal glyph variation grouped
by living generation, without mistaking a survivor snapshot for transmission history.

## Checkpoint 11: living-generation language view

The Language panel now shows living cohorts in numeric generation order, with all
personal glyph assignment counts and explicit unassigned counts for every meaning.
The individual matrix includes generation and retains creature navigation/filtering.
Filtering one individual does not change the clearly labelled population cohorts.
Dead creatures and absent cohorts leave this current snapshot; it is not a record
of teaching, inheritance or lifetime transmission success.

The original matrix is extracted into communication/PopulationLexicons.svelte
alongside cohort presentation. Pure population-lexicon-view-model owns grouping,
ordering and independent matrix snapshots; communication-view-model composes it.
CommunicationTab falls to 306 code lines, the new component is 181 and builder 67.
Existing communication aggregation is 329. The view-model directory reaches six
implementation files, with coherent distinct adapters and two slots before its
hard capacity. Future independent language adaptations should form a communication
view-model subdomain. No simulation state/API, dependency or threshold change.

Tests cover conflicting glyphs, repeated counts, unassigned denominators, all four
meanings, numeric generation order, deterministic symbol order, input immutability,
independent snapshots, removal of dead members/cohorts, empty populations and
filtered individual rows alongside full cohort counts.

Browser verification used the rich/demo preset through 900s. At 300/600s living
cohorts were generations 0/1/2; at 900s only generations 1/2 remained, three members
each. Every displayed glyph and unassigned count matched current debug state,
and matrix links selected the correct creature. Four screenshots at 600/900s
were inspected without page errors. This browser trajectory did not reach the
Node run's generation 4; cross-engine long-run equivalence is not claimed.

Validation: full npm run check passed 657 unit tests in 81 files, server check,
build and 13 browser tests. Next is the measured empty-hearing fast path: the
64-founder profile found that most movement-learning calls have no current signal,
but still scan/sort peers. Its behavior must match complete per-step trajectories.

## Checkpoint 12: empty-hearing work reduction

The 64-founder CPU profile identified movement hearing as avoidable work on quiet
ticks: 89–95% of calls had no current signal but still filtered and sorted retained
peer observations. The change filters current events before looking at peers and
returns unchanged state when there is no hearing work. Sensing continues to own
trace/response expiry; real current signals keep their existing ordering/binding.

This extends the existing learning/movement hearing responsibility with no new
module, state, public entry point, threshold or dependency direction. The function's
input and output data contract is preserved; unchanged creatures can retain their
object identity. All 16,200 complete post-step serialized states matched the prior
implementation across three seeds and 12/32/64 founder populations over 60s.
Warmed alternating A/B pairs measured median time reductions of 4.20%/7.04%/7.60%;
these are local wall-time results, not guaranteed frame-rate gains. See
overnight-scale-performance.md for configurations, fingerprints, ranges and limits.

Validation: full npm run check passed 660 unit tests in 81 files, server check,
build and 13 browser tests. Three focused regressions protect quiet hearing,
sensing-owned expiry and mixed stale/current ordering. Next: inspect actual
resource handoffs after following before deciding whether a bounded personal
helpful-experience update has enough observable evidence.

## Checkpoint 13: reception independent of diagnostic history

Crowded simultaneous calls could overflow recentHeard before the memory and
learning phases saw them. The default keeps eight diagnostic entries while
personal memory ranges from eight to sixteen. An immutable pre-fix replay found
this at the first step of both twelve-founder river/drought baselines, and more
strongly at thirty-two and sixty-four founders. See overnight-reception-scale.md
for measured omissions and the distinction between raw reception and retention.

Communication now hands off every physical reception this step, with only event
id, symbol, origin and hearing time. Memory keeps its existing deterministic
capacity/eviction policy; danger learning still requires retained hearing and
fresh local evidence; movement learning keeps its encounter and pending budgets.
The map is ephemeral, not additional creature state. Bounded display histories
remain available for inspection and no longer limit cognition. No attention or
sound masking model has been introduced.

Structure: existing communication step owns delivery and its public result gains
receivedThisStep plus two input types. Existing sensory-memory and local danger
learning functions require the explicit handoff, preventing fallback to display
history. Movement hearing reuses the same restricted signal shape. The main
orchestrator only wires these consumers. No new production file, directory,
threshold exception, dependency direction or persistent-state change is needed;
existing memory/learning modules retain their responsibility and headroom. The
simulation public barrel remains a reviewed surface with deliberate type exports.

Useful-companionship discovery credit remains deferred: a separate three-seed
rich900 probe observed twelve follow episodes and four resource handoffs, all to
already-known resources. Eating or drinking after following alone is insufficient
evidence of a new discovery caused by a companion.

Validation: full npm run check passed 665 unit tests in 82 files, server check,
build and 13 browser tests. Five new regressions cover physical reception/range,
input immutability/privacy, deterministic capacity eviction, danger episode
deduplication and separate movement trace budgets. A normal river run compares
all state at each of 1,800 steps for history limits one versus sixty-four,
excluding only the diagnostic history arrays; the trajectories match exactly.
The first gate attempt caught a test-fixture SymbolId typing error, corrected
before the successful gate. An additional managed browser observation confirmed
the natural river first step: creature-0 heard eleven calls, retained eleven in
capacity eleven, and still displayed only eight diagnostic history entries. Three
retained events were absent from that display history. Both hearing/language and
bounded-memory inspector screenshots were reviewed with all eleven memory rows,
no sender identity/context in retained fields, and no page errors. Port 8125 was
released. Next: a measured quiet-communication fast path, only if full trajectory
comparison and paired timing support it.

Post-fix 600-second observations (source af9ab61, after the behavior-preserving
quiet shortcut) are saved separately in overnight-reception-baseline-observations.md
and overnight-reception-crowded-observations.md. Baseline final populations across
demo/river/drought are 2/4/0, births 2/0/0; drought extinction occurs at 473.3s.
Crowded final populations are 3/0/0, births 1/0/1; river/drought extinctions occur
at 523.367/530.733s. Memory, encounter, pending-trace and following limits hold,
all need/health values stay finite, and 60-second complete-trajectory repeats
match within this Node runtime. All six runs have at most two consecutive sampled
seconds of stationary movement. These outcomes do not establish better survival;
startup reception changes alter later choices. Historical reports remain intact.

## Checkpoint 14: quiet communication orchestration

After communication has expired active signals and produced its current-step
handoffs, an empty pair of handoffs now returns that state directly. Earlier
world, behaviour, memory observation, social and lifecycle phases still run.
This skips no-op announcement/heard memory, danger/movement learning and
reconsideration passes. No new module, API, state, configuration or responsibility
boundary is introduced; step-simulation remains the existing phase coordinator.
No threshold, topology or dependency changes. Independent expiry stays with its
existing owners rather than moving into this optimization.

The isolated candidate matched all initial and 16,200 complete post-step states
across three seeds, 12/32/64 founders and 60 simulated seconds. Paired warmed
timings were faster in 25/27 pairs, with median reductions 7.65%/6.96%/7.67%.
Two slower 32-founder pairs and ranges are recorded in overnight-scale-performance.md;
this is local wall time, not a guaranteed browser improvement. The applied source
has identical transpiled output to the measured candidate (only source whitespace
differs). A focused regression confirms quiet ticks expire existing emissions and
continue age, time and hunger progression. The reception-independence replay also
continues to pass. Full npm run check passed 666 unit tests in 82 files, server
check, build and 13 browser tests. No visual behavior or presentation change.

## Checkpoint 15: exact diagnostic run capture

Debug now captures the full simulation and exact active configuration together,
with capture time and browser user agent. WorkbenchShell retains one serialized
capture across tab changes and run regeneration; explicit recapture replaces it,
and page reload discards it. Download keeps a JSON file. Capture labels retain the
old seed/time so the saved run is distinct from current live state. Copy/download
failures give visible alternatives, and temporary Blob URLs are cleaned up.

The separate raw live snapshot and captured preview render only while opened.
This avoids continuously serializing the large raw snapshot behind a closed
Debug disclosure; inactive tabs already unmount Debug. No whole-app performance
claim is made. This is diagnostic export, with no importer, restore/migration
contract or invented source-build identity.

Structure: existing workbench/debug now has three cohesive production files:
DebugTab (235) code lines composes diagnostics, RunCapture (172) owns capture controls
and browser resource lifecycle, and run-capture (40) owns exact bundle serialization.
WorkbenchShell (208 code lines) owns one UI capture alongside its existing observer state.
No simulation/public Workbench API, threshold or dependency change. Topology and
Persistence documentation are updated; no new global view-model entry is needed.

Validation: full npm run check passed 671 unit tests in 84 files, server check,
build and 14 browser tests. Five new unit/rendering tests protect complete
round-trip precision, immutable retained capture, filename bounds and closed
preview behavior. The browser regression downloads an actual live rich run,
advances it, changes tabs and regenerates, then verifies the same captured bytes;
a replacement matches the new paused state and active configuration. Additional
inspected screenshots verify preserved old-run labelling and visible clipboard
failure fallback; no page errors, and the managed test port was released.

Next finding: the crowded demo 600-second run tracing shows short rest periods restore energy
and then yield normally to hunger, but peer-triggered reconsideration resets
unreached need-search destinations. Creature 29 changed the point 226 times in one
98.7s hunger/rest episode, 221 from peer changes, despite choosing the same need.
The next correction should preserve valid continuing search execution, while
still allowing resource/danger/other-need choices and arrival to change targets.

## Checkpoint 16: preserve ongoing need-search destinations

Repeated peer or hearing events could reset a hungry/thirsty creature's random
search point even when arbitration chose the same need again. The existing
arbitration-to-execution mapper now keeps a valid ongoing search point in this
case. Cognition still has a null target for unknown resources. Arrival advances
the search sequence, while changed needs, known resources, danger and invalid
points remain free to redirect execution. No utility, ecology or perception
settings changed; separate four-corner exploration behavior is preserved.

This is a minimal correctness fix in behaviour/apply-arbitration.ts, with no
new production module, API, state, topology, dependency direction or threshold
exception. The file has 204 code lines and its replan function 167: the function
remains under review pressure, and future independently changing execution
lifecycles should be split by ownership rather than added to this mapper.

The matched crowded 600-second experiment eliminates 15,360/8,894/12,403
unfinished same-search target replacements across demo/river/drought. Arrival
retargets continue and net hunger/thirst relief increases in these cases; final
populations change 3/0/0 to 2/0/0, so this is no survival guarantee. Exact metric
exclusions, fingerprints and results are in overnight-search-continuity.md.
Current baseline600 populations are 4/1/5; crowded600 are 2/0/0. Rich900 finishes
4/4/4, with 6/5/7 births and maximum generation 3 in every seed. Personal approach
meanings remain in 2/3/2 survivors, with no dictionary inheritance. All nine runs
respect memory/movement/follow bounds and finite need values; same-runtime
60-second full-trajectory repeats match. The three overnight-search observation
reports preserve configuration and measurement limitations.

Integrated browser evidence: natural crowded/demo creature-3 at 55.200→55.233s
reconsidered on peer perception, kept its unknown-resource cognitive target null,
kept search index 1 and the physical waypoint, and reduced distance from 4.0835 to
4.0515. Hunger's actual score 0.8432 beat the competing candidates. Target and
utility screenshots were inspected without page errors. This browser case is
independent of the Node trajectories above.

Eleven new runtime cases plus existing step/exploration cases passed (37 focused
tests), including periodic/peer triggers, arrival, changed needs, resources,
danger, invalid points and immutable inputs. Types and scoped lint passed.
Full npm run check passed 682 unit tests in 85 files, server check, build and
14 browser tests.
