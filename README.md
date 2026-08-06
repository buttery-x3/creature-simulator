# Creature Simulator

Desktop web application scaffold for exploratory creature-simulation work.

This repository currently provides a minimal **SvelteKit + TypeScript + Three.js**
environment. It confirms that the app shell and WebGL presentation path work. It does
**not** implement simulation behaviour, creatures, world generation or language systems.

Three.js is the **presentation layer only**. It must not become the owner of future
simulation state or behaviour.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (Node 24 is known to work)
- npm (bundled with Node.js)

## Installation

```sh
npm install
npx playwright install
```

`playwright install` downloads browsers once for end-to-end tests.

## Reserved ports

Do not use framework-default ports. These assignments are configured in
`src/lib/ports.ts`, `vite.config.ts`, `playwright.config.ts` and package scripts.
Commands use **strict port binding**: if the port is already taken, the command fails
instead of choosing another port.

| Environment                | Port   | Command            |
| -------------------------- | ------ | ------------------ |
| Development server         | `8123` | `npm run dev`      |
| Production preview         | `8124` | `npm run preview`  |
| Browser / end-to-end tests | `8125` | `npm run test:e2e` |

Unit tests do not bind a port.

## Commands

| Script                 | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Start the development server on port `8123`                     |
| `npm run build`        | Create a production build                                       |
| `npm run preview`      | Serve the production build on port `8124`                       |
| `npm run check:types`  | Run Svelte / TypeScript type-checking                           |
| `npm run lint`         | Run ESLint                                                      |
| `npm run format`       | Format the repository with Prettier                             |
| `npm run format:check` | Check formatting without writing                                |
| `npm run test:unit`    | Run unit tests (Vitest)                                         |
| `npm run test:e2e`     | Build, preview on `8125`, run Playwright smoke tests            |
| `npm run test`         | Unit tests then browser tests                                   |
| `npm run check`        | Full local quality gate (types, format, lint, unit, build, e2e) |

## Application target

Desktop web only. Mobile layouts, touch interaction, small-screen optimisation and
device-specific mobile behaviour are intentionally out of scope.

## Where application code lives

| Path                              | Role                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `src/routes/`                     | SvelteKit pages and layouts                             |
| `src/lib/ThreeViewport.svelte`    | Minimal Three.js viewport (init, resize, dispose)       |
| `src/lib/ports.ts`                | Shared reserved-port constants                          |
| `src/lib/orthographic-frustum.ts` | Small pure helper used by the viewport                  |
| `static/`                         | Static assets served as-is                              |
| `docs/`                           | Project workflow, architecture notes and agent guidance |

## Further reading

- [Development workflow and quality gate](docs/workflow.md)
- [Browser testing](docs/browser-testing.md)
- [Architecture notes](docs/architecture.md)
