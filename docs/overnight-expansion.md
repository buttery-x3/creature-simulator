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

First slice in progress: physical ecology, bounded local wildlife perception,
utility-driven flee/hunt decisions, injury and encounter costs, day/night rest
weight, visible wildlife/condition, and step/speed controls. This checkpoint is
the clean pre-feature baseline; no completed feature is claimed yet.

The implementation sequence remains physical world, grounded danger language,
relationships/innate expression, lifecycle, then voluntary learned social
communication. Performance, diagnostics, scale and evidence-backed refactoring
follow. Communities, construction, beliefs/idols and moral communication are
later opportunities only after the earlier sequence is complete.

## Verification and review backlog

- Baseline hashes and listener-meaning sources verified.
- No full quality gate run yet in the isolated checkout.
- Each completed slice must record focused tests, full `npm run check`, actual
  browser observations, tunable defaults, and remaining work here.
- No implementation approval pause is required by this run's explicit user
  authorization; local completed checkpoints remain available for later review.

## Launch

From the isolated checkout: `npm run dev` (reserved port 8123). Browser tests use
`npm run test:e2e` and reserved port 8125, following `docs/browser-testing.md`.
