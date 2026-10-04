# Reception history saturation at scale

The committed baseline drops physically received signals before memory and movement learning when more than eight arrive in one fixed step. This already occurs with 12 founders in two seeds; it is not limited to a synthetic stress test.

## Source and method

Baseline: `0a34e0913d74d8196afe87c8d3e1074a9880c663`, archived with `git archive` into ignored `.svelte-kit/hearing-baseline`. Node v24.15.0; portless Vite SSR loading that immutable archive. Its production-source fingerprint is `c80c8bbd5221aea9fab2f6eaba9aedfd51eedf490300b75acda1c0cd1e502f7a` (determinism/habitat/simulation TypeScript, excluding specs, sorted paths and normalized newlines), checked against the archive and unchanged throughout the run.

The table uses only this archived replay. An earlier working-tree probe overlapped staged development and had a different fingerprint; its results are excluded.

Config uses `scenarioSimulationConfig(seed, preset)` at that commit. Baseline cases change only founder count to 12/32/64 and run 120 seconds. Resource-rich cases use the preset unchanged (12 founders, food count 8, maximum active food sources 12, spawn interval 8 seconds, wildlife count 2) and run 900 seconds. Seeds are `demo`, `overnight-river`, `overnight-drought`; fixed step is 1/30, population cap 64, hearing history limit 8, personal memory capacity sampled from 8–16. Exact configurations are retained with the raw results.

For each step, newly emitted active signals are selected by exact `emittedAt === state.timeSeconds`. Positive signal lifetime and no active-emission count cap preserve the complete new set. Exact recipients are reconstructed from emission origins and the surviving post-behaviour population, using the production circular hearing test and sender exclusion. Lifecycle removal/newborn creation happens before communication, so the end-of-step population is the actual reception population; no dead previous-step listener is invented. The probe asserts each creature's retained current history equals the final eight physically delivered events, in delivery order.

## Archived results

“Memory-eligible omissions” means omitted events that would remain after inserting **all** same-step deliveries in the existing deterministic memory order and applying that creature's ordinary capacity. It is not a claim that every delivered event should be retained indefinitely.

| Preset        | Founders | Seed              | Exact receptions | Maximum simultaneous heard | Omitted before cognition | Memory-eligible omissions |
| ------------- | -------: | ----------------- | ---------------: | -------------------------: | -----------------------: | ------------------------: |
| baseline      |       12 | demo              |              646 |                          5 |                        0 |                         0 |
| baseline      |       12 | overnight-river   |            1,095 |                         11 |                       36 |                        25 |
| baseline      |       12 | overnight-drought |              870 |                         11 |                       36 |                        25 |
| baseline      |       32 | demo              |            2,870 |                          8 |                        0 |                         0 |
| baseline      |       32 | overnight-river   |            8,225 |                         31 |                      736 |                       124 |
| baseline      |       32 | overnight-drought |            9,920 |                         31 |                      736 |                       122 |
| baseline      |       64 | demo              |           14,192 |                         13 |                      307 |                       207 |
| baseline      |       64 | overnight-river   |           39,857 |                         63 |                    3,457 |                       252 |
| baseline      |       64 | overnight-drought |           31,429 |                         63 |                    3,520 |                       255 |
| resource-rich |       12 | demo              |            5,486 |                          4 |                        0 |                         0 |
| resource-rich |       12 | overnight-river   |            5,815 |                          2 |                        0 |                         0 |
| resource-rich |       12 | overnight-drought |            2,770 |                          2 |                        0 |                         0 |

Every observed overflow in this archived run is the initial step at 0.033333 seconds; later bursts stayed within eight. At saturation, each listener retained exactly eight current events. The largest burst was 63 deliveries, versus eight retained. Thus this evidence concerns a consequential startup burst, not continuous hearing saturation throughout the experiment.

At 12 founders, river and drought each lose 36 receptions across 12 listeners. In each case 21 omitted events belong to bursts that fit the listener's complete memory capacity, and 25 would survive ordinary memory insertion/eviction. Respectively 16 and 14 omitted entries could even fit currently unused memory slots without evicting anything. For a concrete example, river creature-0 hears 11 events with memory capacity 11 but processes only eight.

All three 900-second resource-rich runs have zero history overflow, despite actual population turnover (births 7/7/4; deaths 13/13/15). Their maximum bursts are 4/2/2. No same-step newborn receptions occurred in these measured cases; reconstruction nevertheless includes newborns whenever they exist before communication.

## Contract and recommendation

The baseline architecture explicitly describes heard memory ingestion from `recentHeard` entries stamped with the current time. It describes the array as bounded communication history, while `CreatureMemory` owns personal retention capacity. It does **not** define a separate eight-signal sensory/attention policy. Therefore the implementation demonstrably makes a history setting an additional cognitive input limit, but the historical documentation does not explicitly promise that `recentHeard` is diagnostic-only.

The smallest coherent correction is an ephemeral authoritative per-receiver reception handoff from communication, parallel to `emittedThisStep`. Memory, immediate local evidence and movement learning should consume all physically delivered current-step records; existing memory/trace capacities continue to bound retention and learning. Keep inspection histories capped and strip sender identity before cognitive ingestion. Increasing the history limit would hide the coupling rather than define ownership. This correction intentionally may change trajectories in overflowing cases; it is not a behavior-preserving performance refactor.

Probe artifacts: `.svelte-kit/hearing-saturation-baseline.mjs`, `.svelte-kit/hearing-saturation-baseline-results.json`, and archived source in `.svelte-kit/hearing-baseline`. These are ignored local reproduction aids. The earlier `hearing-saturation-results.json` is not the source for this report. No production code or ecological parameters were changed by this investigation.
