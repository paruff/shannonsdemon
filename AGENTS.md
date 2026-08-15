# Shannon's Demon — Repo Context

Portfolio rebalancing tool based on Shannon's Demon: harvest volatility by rebalancing toward risk parity targets. React 18 SPA deployed to GitHub Pages.

## Quick Commands

```bash
npm run dev          # dev server (port 5173)
npm run build        # production build to dist/
npm run preview      # preview built app (port 4173)
npm test             # vitest unit/integration
npm run test:e2e     # playwright E2E (builds first)
npx eslint "src/**/*.{js,jsx}"
```

## Structure

```
src/
  App.jsx              # Single-file UI (~1400 lines). All views, state, styles.
  utils/finance.js     # Domain logic: vol calc, weights, trades, tax location.
  utils/__tests__/     # vitest tests (jsdom).
  components/          # ErrorBoundary, Tooltip (small, presentational).
  mocks/handlers.js    # MSW handlers for Yahoo Finance in tests.
tests/e2e/             # Playwright specs (mocked Yahoo, never hits live API).
```

## Architecture Rules

- **Single-file UI.** App.jsx owns all state + views. Components only when logic is reused (ErrorBoundary, Tooltip).
- **Inline styles only.** No CSS framework, no external stylesheets. Colors: slate grays on dark navy (#0d1424).
- **Finance math is pure.** All portfolio logic in `src/utils/finance.js` — pure functions, no side effects, fully unit-testable.
- **Yahoo Finance only.** `fetchQuote()` is the single data source. Tests mock it via MSW; E2E via Playwright route interception. Never hit live Yahoo in tests.
- **localStorage for state.** Key: `shannonsdemon_v1`. Scenarios: `shannonsdemon_scenarios_v1`.

## Known Gotchas

- **`NODE_OPTIONS` shim is broken** in this env. Every node subprocess needs `env -u NODE_OPTIONS <cmd>`. Commit hooks, vitest, eslint, playwright — all need the sanitized env.
- **Prettier reformats on commit** (lint-staged). Large JSX files like App.jsx will show big diffs. Expected.
- **Lighthouse needs Chrome.** Local: `CHROME_PATH` env to Playwright's chromium. CI: ubuntu-latest has Chrome preinstalled.
- **A11y budget is 0.95, not 1.0.** Lighthouse a11y audits are stricter than axe-core. Gradient button contrast is the known friction point.

## Conventions

- **Commits:** Conventional format (`feat:`, `fix:`, `test:`, `ux:`, `ci:`). Enforced via commitlint + husky commit-msg hook.
- **Version:** Semver with alpha tags. Current: `v0.1.0-alpha.1`.
- **No new deps without justification.** The app is dependency-light by design. If you need a package, explain why in the commit.
- **Ponytail applies.** Fewest files, shortest diff, stdlib first. See `.claude/` for the full Ponytail rules.

## Testing Strategy

| Layer | Tool | What it covers |
|-------|------|----------------|
| Unit | vitest + jsdom | finance.js: vol, weights, trades, tax location, suggestions |
| Integration | vitest + MSW | fetchQuote: happy path, 404, 429 |
| E2E | Playwright | Full user flow: run analysis → view trades (mocked Yahoo) |
| A11y | Playwright + axe | Zero-violation check on analysis results |
| Perf | Lighthouse CI | Performance ≥0.9, a11y ≥0.95, best-practices ≥0.9, SEO ≥0.9 |
