# Development workflow

## Quality gate

Before requesting human review of an issue branch, run:

```sh
npm run check
```

That command runs, in order:

1. Svelte / TypeScript checking (`check:types`)
2. Prettier format check (`format:check`)
3. ESLint (`lint`)
4. Unit tests (`test:unit -- --run`)
5. Production build (`build`)
6. Browser smoke tests (`test:e2e`)

During development, prefer focused scripts for the area you changed.

## Reserved ports

| Environment        | Port   |
| ------------------ | ------ |
| Development server | `8123` |
| Production preview | `8124` |
| Browser tests      | `8125` |

Source of truth: `src/lib/ports.ts`. Vite and Playwright import those values so scripts
and docs stay aligned. Strict port binding is enabled; occupied ports must fail loudly.
Servers bind to `127.0.0.1` (not bare `localhost`) to avoid Windows IPv4/IPv6 mismatches.

## Issue workflow

Follow `AGENTS.md` for branching, commits, review and integration rules. Summary:

1. Work on a dedicated Linear issue branch.
2. Keep commits small and push often.
3. Run the quality gate before marking the issue **In Review**.
4. Do not merge to `main` or mark the Linear issue complete without explicit human approval.

## Tooling notes for agents

- Package manager: **npm**
- App framework: **SvelteKit** (Svelte 5 runes mode)
- Language: **TypeScript**
- Unit tests: **Vitest** (`*.spec.ts` / `*.test.ts` under `src/`)
- Browser tests: **Playwright** (`*.e2e.ts`)
- Presentation: **Three.js** (client-side only; initialise in `onMount`, dispose on teardown)
- Do not introduce hosted CI (for example GitHub Actions) unless the repository owner requires it
