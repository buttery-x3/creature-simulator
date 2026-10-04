# Hearing fast-path scale measurements

This measures a narrow allocation/work reduction: movement hearing filters current-step signals before preparing nearby peers and returns the original creature when none remain. Signal order, binding, evidence and expiry ownership remain unchanged; actual sensing still handles expiry. No population, ecological or cognition policy is tuned.

## Reproduction

- Baseline simulation: commit `3c9a791c50178a698f04382f74a67079baf33cad`, archived into ignored `.svelte-kit/scale-baseline` with `git archive`. The simulation source is also unchanged in UI checkpoint `5b98e1253e687e10d1861b9d7818e2b104611bcc`, the parent of this change.
- Node `v24.15.0` on the local Windows machine; Vite SSR middleware with no listening port, browser, rendering, or Svelte application compilation. Baseline and changed APIs load separately in the same process.
- Config: `defaultSimulationConfig(seed)` at the named source, changing only `creatureCount` to 12, 32 or 64. Seeds: `demo`, `overnight-river`, `overnight-drought`. Population cap stays 64, resources and needs use defaults. Each run advances 1,800 fixed steps (`fixedDt=1/30`), exactly 60 simulated seconds.
- Correctness replay compares the complete `JSON.stringify(state)` after every step, including diagnostics, rather than comparing only final population or a selected summary. Initial states are compared too. Timing runs are separate and exclude state creation, JSON serialization and hashing.
- After replay and one additional discarded warm-up per size and implementation, measure three repetitions of every size/seed pair. Alternate baseline/changed order between pairs and rotate population order between repetitions. The timed loop includes only simulation steps and an alive-creature-step accumulator. These are wall-clock measurements, not isolated pure CPU times; repeated local measurements still have scheduling, GC and JIT variation.
- A separate inspector CPU profile at requested 1 ms sampling covers six warmed 64-founder runs, two per seed. Profile scope includes small creation/final-hash costs outside each inner timed loop. Inclusive sampled percentages overlap and are not additive or guaranteed speedups.

## Initial investigation

The preceding read-only probe (same baseline and runtime, three seeds and three repetitions) measured median wall times of 270/1,005/2,441 ms for 12/32/64 founders, or 12.05/17.46/21.19 microseconds per alive creature-step. This identifies density-related cost; it does not establish one scaling mechanism.

The baseline profile attributed 8.24% inclusive sampled time to `hearMovementLearning` (aggregating same-named frames), and 6.69% to `freshPeers`, shared with actual observation. In separate count-only 64-founder runs, 95.19%/90.56%/88.67% of hearing calls had no new signal. Those calls unnecessarily processed 1,552,875/1,540,523/1,357,635 retained peer entries per seed. This supports the small fast path before considering broader spatial or cognition refactors.

## Results

All **16,200 complete post-step serialized states** match exactly across the nine population/seed cases, as do initial states. No first divergence occurred. Timed A/B pairs also have identical final-state digests.

Production-source SHA-256 (determinism, habitat and simulation `.ts`, excluding specs, paths sorted and CRLF normalized):

- Baseline: `98d63ef332a1fb0357062bbdf49c2bd343c808735787abb42792bee70da3d47b`.
- Changed: `c80c8bbd5221aea9fab2f6eaba9aedfd51eedf490300b75acda1c0cd1e502f7a`.

| Founders | Baseline median wall ms | Changed median wall ms | Median paired reduction | Baseline/changed median µs per alive creature-step |
| -------- | ----------------------: | ---------------------: | ----------------------: | -------------------------------------------------: |
| 12       |                 246.905 |                230.485 |                   4.20% |                                    11.122 / 10.604 |
| 32       |                 970.930 |                897.941 |                   7.04% |                                    16.489 / 15.436 |
| 64       |               2,347.159 |              2,205.155 |                   7.60% |                                    20.375 / 19.142 |

Each row pools nine runs per implementation (three repetitions of each seed). Paired reduction is computed per matched run and then medianed; it is not the ratio of independently selected medians. Baseline/changed wall-time ranges: 12 founders 233.519–273.526 / 223.718–265.246 ms; 32 founders 905.419–1,004.188 / 824.964–937.132 ms; 64 founders 2,038.229–2,806.773 / 1,916.960–2,416.906 ms.

Alive creature steps per seed (demo/river/drought): 12 founders 24,068/21,600/21,600, ending at 14/12/12 creatures; 32 founders 57,600/57,551/59,055, ending at 32/31/33; 64 founders 115,200 each, ending at 64 each. Normalization therefore includes actual births and deaths rather than assuming founder count stays constant.

Separate baseline/changed sampled profile scopes lasted 14.962/13.240 seconds with 9,277/8,237 samples. Aggregated inclusive hearing share fell from 8.24% to 1.06%; shared `freshPeers` share fell from 6.69% to 1.05%. Garbage-collector self share was 3.70%/3.48%. Profiles were separate runs, so these shares support the mechanism but are not a paired speed estimate.

Three focused regressions cover quiet hearing without peer reads or expiry, stale/future-only inputs, and mixed current/stale ordering without input mutation. The 23 focused movement unit/runtime tests pass. The change stays inside the existing hearing algorithm; no public boundary, dependency direction, topology or configuration changes are introduced.

## Local artifacts and limits

Exact configurations, per-run wall times, final-state and per-step trajectory digests: ignored `.svelte-kit/scale-ab-results.json`. Reproduction driver: `.svelte-kit/scale-ab.mjs`. Sampled profiles: `.svelte-kit/scale-64.cpuprofile` (baseline investigation) and `.svelte-kit/scale-optimized.cpuprofile`. Original probe/count scripts and results use the `.svelte-kit/scale-probe-*` and `.svelte-kit/scale-empty-hearing.json` paths. These machine-local artifacts are reproducible aids, not required application files.

The experiment covers the first 60 seconds for these nine configurations. It does not prove equal behavior for every possible configuration, compare browser frame rates, or guarantee an identical percentage improvement on another machine. Focused quiet/stale/mixed-signal regressions supplement the trajectory comparisons.
