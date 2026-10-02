# Listener-meaning experiment (FLAME-133)

## Purpose and baseline

This controlled experiment checks whether the listener's exclusive lexicon now
changes which retained signal it investigates, and whether that can bring useful
local evidence and initial need recovery sooner. The baseline is
`542f6310947b0829c6aaa19829f50fb95c989653`.

The script checks all 107 baseline files under `src/lib/determinism`,
`src/lib/habitat`, and `src/lib/simulation` against their Git blob hashes at that
revision before loading any baseline code. Both implementations receive clones
of the same state and configuration created by the baseline. No dependencies or
lockfiles are changed. The current implementation is run twice per scenario;
summary results and SHA-256 hashes of every full state in each trajectory must
match.

## Controlled setup

- Seed: `flame-133-matched-listener`; one listener; 30 fixed steps/second; 20 seconds
- Listener starts at `(0, 0)`, facing right, moving at 2 units/second
- Older `glyph-1` origin: `(-5, 0)`; newer `glyph-2` origin: `(5, 0)`
- Primary fixtures contain the needed resource at the older origin and the
  opposite resource at the newer origin: food/water placement reverses for the
  thirst scenario
- Resource footprints are 0.4 × 0.4 with amount/capacity 10; spawning and rain are
  placed beyond the observation window
- Hunger scenario starts at hunger 0.8, thirst 0.05, curiosity 0.5; thirst scenario
  starts at hunger 0.05, thirst 0.8, curiosity 0; both start at energy 0.99 and
  verbosity 0
- Matching, swapped, and cleared initial lexicons are interventions on the
  resolved lexicon only; raw associations remain identical. This isolates use of
  existing interpretation rather than testing how that interpretation was learned
- Supplementary fixtures leave the newer origin empty. Their measured first
  discovery and consumption timings match the primary fixtures below

The actual `stepSimulation` implementation owns movement, perception,
arbitration, learning and consumption. There is no browser or GUI step.

## Primary results

All times are simulated seconds, rounded to three decimals. Both primary need
scenarios have the same discovery and consumption timings.

| Initial listener lexicon | Baseline first origin | FLAME-133 first origin | First useful local evidence, baseline → current | First eat/drink action, baseline → current |
| ------------------------ | --------------------- | ---------------------- | ----------------------------------------------- | ------------------------------------------ |
| Matching older symbol    | `(5, 0)`              | `(-5, 0)`              | 6.433 → 1.900                                   | 7.633 → 3.000                              |
| Swapped                  | `(5, 0)`              | `(5, 0)`               | 6.433 → 6.433                                   | 7.633 → 7.633                              |
| Cleared                  | `(5, 0)`              | `(5, 0)`               | 6.433 → 6.433                                   | 7.633 → 7.633                              |

The script asserts that both discovery and consumption times actually exist
before checking improvement. A missing event cannot pass as an earlier event.

Need pressure for matching lexicons:

| Time | Hunger, baseline → current | Thirst, baseline → current |
| ---- | -------------------------- | -------------------------- |
| 5 s  | 0.860000 → 0.336000        | 0.870000 → 0.282000        |
| 10 s | 0.299933 → 0.168933        | 0.244200 → 0.175600        |
| 15 s | 0.167800 → 0.228933        | 0.177000 → 0.245600        |
| 20 s | 0.227800 → 0.288933        | 0.247000 → 0.315600        |

At 20 seconds, hunger has changed by −0.572200 in the baseline and −0.511067 in
the current implementation; thirst has changed by −0.553000 and −0.484400,
respectively. The current listener consumed earlier, so its need pressure has
had longer to rise again. The result demonstrates earlier useful discovery and
initial recovery, not permanently lower need pressure.

## Evidence and limits

“Useful local evidence” means the first retained `resource_observation` of the
needed resource. It is **not** symbol-association reinforcement. In matching
runs, visible useful resources interrupt investigation at 1.900 seconds before
origin inspection. The interrupted heard signal remains in memory. In primary
swapped/cleared runs, the listener first inspects the opposite resource and
records its actual kind, then later discovers the needed resource.

Separate runtime regression tests cover lexicon-only changes, zero-curiosity
thirst, repeated stability, retarget identity alignment, interruption retention,
and food/water consumption. Contradictory, mixed and empty arrival inspections
remain grounded in the world. Another fixture changes hidden speaker context,
speaker lexicon and live speaker movement while listener memory stays fixed;
listener decisions remain identical. Existing communication tests verify that
later emissions still use the emitter's resolved exclusive lexicon and do not
mutate it or raw evidence.

These are small controlled fixtures. They do not establish population language
convergence, survival benefit, or uniform long-term need improvement. Browser
validation is outside this experiment.

## Reproduce

From the issue checkout after dependencies are installed and SvelteKit has
created `.svelte-kit/tsconfig.json`:

```sh
baseline=$(mktemp -d)
git archive 542f6310947b0829c6aaa19829f50fb95c989653 | tar -x -C "$baseline"
mkdir -p "$baseline/.svelte-kit"
cp .svelte-kit/tsconfig.json "$baseline/.svelte-kit/tsconfig.json"
node scripts/flame-133-listener-comparison.mjs "$baseline" /tmp/flame-133-listener-comparison.json
npm run test:unit -- --run \
  src/lib/simulation/behaviour/listener-meaning.runtime.spec.ts \
  src/lib/simulation/communication/step-communication.spec.ts \
  src/lib/simulation/communication/symbol-selection.spec.ts
```

The generated tooling configuration is not simulation source. Vite runs only in
middleware/SSR mode with both HMR and WebSocket serving disabled. The JSON output
contains source-pin verification, configuration, all 12 scenario results,
trajectory hashes, learning events, need checkpoints and final need changes;
it is intentionally an external experiment artifact rather than tracked source.
