# Browser testing

## Port

Browser / end-to-end tests always use port **`8125`**.

Playwright starts a production preview on that port automatically:

```sh
npm run test:e2e
```

Equivalent behaviour is configured in `playwright.config.ts` and `package.json`:

- build the app
- run `npm run preview:e2e` (`vite preview` on `127.0.0.1:8125` with strict port binding)
- execute tests matching `**/*.e2e.{ts,js}`

Dev, preview and browser-test servers bind to **`127.0.0.1`** so IPv4 and IPv6 localhost resolution cannot disagree on Windows.

Do not invent alternate ports or ad-hoc server lifecycle scripts for normal local
browser testing.

## Prerequisites

Install Playwright browsers once after cloning:

```sh
npx playwright install
```

## Writing smoke tests

Keep browser tests focused and non-pixel-based where practical:

- confirm the app route loads
- confirm the Three.js rendering surface (`canvas` with `data-testid="three-canvas"`) is present and sized
- confirm habitat framing via canvas data attributes rather than screenshot comparison:
  - `data-habitat-fully-visible="true"` when every fit corner projects into the viewport
  - `data-habitat-camera-mode="perspective-near-top-down"` for the near-top-down presentation camera
  - `data-habitat-corners-visible` / `data-habitat-corner-count` for corner coverage

Prefer `data-testid` attributes for stable selectors on rendering surfaces.

## Desktop target

Tests and local verification assume a normal desktop viewport. Mobile-specific layout
and touch behaviour are out of scope for this project.
