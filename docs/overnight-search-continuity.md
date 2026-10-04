# Need-search continuity correction

## Observation

A targeted 600-second crowded `demo` run reproduced the reception checkpoint's
286 rapid rest → satisfy_hunger transitions and 79 warn_danger → flee transitions.
The simulation source fingerprint remained
`c7454cbbc64ef382cbb002f8c7fccd75aba157f09758d5f188519962604ac1cc`.
The observer recorded maximal uninterrupted rest/hunger episodes, movement,
need recovery, arbitration scores and target changes without modifying simulation state.

The three longest alternating episodes were:

| Creature | Interval (seconds) | Path length | Sleep / cumulative energy gained | Actual net food relief | Unreached search destinations replaced |
| -------- | ------------------ | ----------: | -------------------------------- | ---------------------: | -------------------------------------: |
| 29       | 249.07–347.77      |       70.32 | 6s / 0.90                        |                      0 |                                    226 |
| 19       | 264.00–343.87      |       41.70 | 6s / 0.90                        |                      0 |                                    163 |
| 12       | 98.93–176.80       |       47.22 | 4.6s / 0.69                      |                 0.0083 |                                    186 |

Short rests restored energy before urgent foraging resumed. For creature 29,
rest initially scored 0.92757 against hunger's 0.92000; after 1.5 seconds of sleep,
hunger's 0.87000 beat rest's 0.73912. These are useful recovery intervals, not
evidence of a rest-selection defect. The rapid-transition diagnostic counts a
short preceding intention, so it does not distinguish a useful nap from oscillation.
Warning followed by flight was counted separately.

Within the foraging intervals, however, reconsideration repeatedly replaced valid
distant search points while the same hunger intention remained selected.
Peer-perception changes accounted for 221, 161 and 175 replacements respectively.
For example, creature 29 replaced targets with 4.98 and 8.68 units still remaining
at 249.37 and 249.57 seconds. It had neither arrived nor acquired a resource target.

## Cause and correction

Cognition correctly represents unknown resources with a null selected target.
Applying that selection discarded the existing executor search point, causing
`ensureSearchTarget` to advance the deterministic search stream on reconsideration.
Nearby peer changes could therefore continually redirect a hungry searcher.

The correction belongs to `behaviour/apply-arbitration.ts`: its existing mapping
preserves a valid ongoing point only when the previous and selected actions are
search, the need intention is unchanged, and cognition still selects no destination.
The authoritative search contract is documented in
[architecture.md](architecture.md#local-sensing-search-and-memory-driven-targets).
No new state, public API, module, configuration or dependency boundary is introduced.
This is a narrow correctness change in the existing execution-continuity responsibility.
The substantial replan function remains a review-pressure point for future independently
changing execution lifecycles; this fix adds no such lifecycle or threshold exception.

Focused runtime regressions cover repeated actual peer/periodic reconsideration,
movement toward the retained point, exactly one arrival resample, changed needs,
visible and remembered resources, sensed danger, invalid points, immutable inputs,
and the separate exploration-cell lifecycle.

## Limits

The initial trace covers one crowded seed in one JavaScript runtime. It identifies
a reproducible execution defect, not a causal estimate of mortality or a guarantee
of food discovery. Resource scarcity, local knowledge, competition, injury and
deprivation remain part of the simulation. No need scores or ecological parameters
were tuned.

## Matched 600-second comparison

The archived source at commit `2f42d466d6cea685018f5ddfb1194e6fc05f465b` and the
corrected working source each ran the crowded preset for `demo`, `overnight-river`
and `overnight-drought`: 32 founders, 18,000 steps at 1/30 second, Node v24.15.0.
The complete configurations were checked for equality within each seed pair.
Vite SSR loaded both implementations without opening a listening port. Fingerprint
guards verified that neither source changed during the six runs:

- Archived: `c7454cbbc64ef382cbb002f8c7fccd75aba157f09758d5f188519962604ac1cc`.
- Corrected: `89e700dfc53a26cd696e3339ec7f2464417242d35f8d615bd08706d201de89da`.

An **unfinished same-need replacement** requires search actions and point targets
on both sides of the step, the same hunger or thirst intention, a finite previous
point, and a changed destination. The count excludes any recorded same-step
intention interruption and any movement segment entering the previous point's
arrival radius (0.35 units, with a 1e-9 comparison tolerance). Arrival-eligible
retargets count that latter case separately. Thus ordinary arrival resampling,
changed needs, invalid points and interrupted/re-entered searches do not inflate
the defect count. Births and deaths are identified from live ID additions/removals.

| Seed              | Unfinished replacements, before → after | Arrival-eligible retargets, before → after |
| ----------------- | --------------------------------------: | -----------------------------------------: |
| demo              |                              15,360 → 0 |                                   51 → 726 |
| overnight-river   |                               8,894 → 0 |                                   19 → 381 |
| overnight-drought |                              12,403 → 0 |                                   36 → 466 |

Net need relief sums positive per-step decreases in hunger or thirst for creatures
present in both snapshots. It measures observed net recovery, not gross resource
intake: same-step costs can offset recovery, and creatures dying within the step
are absent from the post-step measurement. Totals are unnormalised and also depend
on how long the changing population remains alive.

| Seed              | Net hunger relief, before → after | Net thirst relief, before → after | Final population, before → after | Births, before → after |
| ----------------- | --------------------------------: | --------------------------------: | -------------------------------: | ---------------------: |
| demo              |                     57.22 → 59.74 |                   120.15 → 146.04 |                            3 → 2 |                  1 → 0 |
| overnight-river   |                     38.85 → 48.61 |                     73.21 → 85.24 |                            0 → 0 |                  0 → 0 |
| overnight-drought |                     40.15 → 49.28 |                    83.34 → 107.80 |                            0 → 0 |                  1 → 1 |

These observations validate destination continuity in the tested trajectories:
the classified unfinished replacements disappear while arrival-based resampling
continues. Need relief increased in these runs, but survival did not uniformly
improve: the demo population finished smaller, and both other populations still
became extinct. This is not a general ecological success claim.

The ignored probe and full configuration/results are retained as
`.svelte-kit/search-continuity-probe.mjs` and
`.svelte-kit/search-continuity-results.json`. Broader corrected-source context is
available in the [baseline observation report](overnight-search-baseline-observations.md)
and [crowded observation report](overnight-search-crowded-observations.md).
