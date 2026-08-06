# Architecture notes

## Current status

This repository is at the **environment bootstrap** stage. There is no settled
simulation architecture yet.

## Responsibilities present today

| Area               | Ownership                            | Notes                               |
| ------------------ | ------------------------------------ | ----------------------------------- |
| App shell          | SvelteKit routes under `src/routes/` | Desktop page layout only            |
| WebGL presentation | `src/lib/ThreeViewport.svelte`       | Static placeholder scene            |
| Viewport math      | `src/lib/orthographic-frustum.ts`    | Pure helper; no simulation state    |
| Reserved ports     | `src/lib/ports.ts`                   | Shared by Vite, Playwright and docs |

## Dependency direction (current)

```
routes  -->  $lib presentation helpers  -->  three (rendering)
```

Cross-cutting rules:

- **Three.js is presentation only.** Future simulation state, clocks, entities and
  behaviour must not live inside Three.js objects as the system of record.
- Do not invent speculative modules for world generation, creatures, language,
  persistence or workbench tooling until a concrete issue requires them.
- Prefer public entry points under `src/lib` and route files over deep ad-hoc trees.

## Application target

Desktop web application. Mobile layouts, touch interaction and small-screen product
behaviour are out of scope unless a future issue explicitly expands that target.

## Evolution

When a feature introduces a new durable responsibility, document the ownership split
in the same issue and update this file. Empty placeholder directories and unused
abstractions are forbidden.
