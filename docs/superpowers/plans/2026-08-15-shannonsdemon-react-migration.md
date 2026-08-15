# Shannon's Demon React + Vite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the repository from a Streamlit app to a React + Vite static site deployed to GitHub Pages, with quality gates (ESLint, Prettier, Husky, CI) from day one.

**Architecture:** Standard Vite + React 18 layout with inline styles (no CSS framework). Three-tab SPA: Holdings (current positions), Analysis (risk parity targets + tax location), Trades (rebalancing actions). Yahoo Finance unofficial API for live data. localStorage persistence.

**Tech Stack:** React 18, Vite 5, ESLint 9 (flat config), Prettier 3, Husky 9, lint-staged 15, GitHub Actions for CI/CD.

---

## Global Constraints

- **Base path:** `/shannonsdemon/` (from existing `vite.config.js`) — GitHub Pages project site
- **Node:** 20 LTS (use in CI/setup-node)
- **React:** 18.3.x
- **Vite:** 5.4.x with `@vitejs/plugin-react` 4.3.x
- **No CSS framework** — inline styles in `App.jsx` are preserved
- **Legacy deletion:** Remove `app.py`, `requirements.txt`, `index.jsx` (root)
- **Yahoo Finance API:** Keep `fetchQuote()` isolated; no new deps
- **State:** localStorage key `shannonsdemon_v1` — must persist on every change

---

## File Map

### New Files
| File | Purpose |
|---|---|
| `package.json` | npm config, scripts, deps |
| `index.html` | Vite HTML entry |
| `src/main.jsx` | React bootstrap |
| `src/App.jsx` | Migrated component (from `index.jsx`) |
| `.github/workflows/ci.yml` | CI: lint, format, build |
| `.github/workflows/deploy.yml` | CD: build → gh-pages |
| `.eslintrc.json` | ESLint flat config |
| `.prettierrc` | Prettier config |
| `.husky/pre-commit` | Husky hook (auto-generated) |

### Modified Files
| File | Changes |
|---|---|
| `vite.config.js` | Add React plugin, keep base |
| `.gitignore` | Add `node_modules/`, `dist/`, `.husky/` |
| `README.md` | Rewrite for React/Vite + deploy instructions |

### Deleted Files
| File | Reason |
|---|---|
| `app.py` | Legacy Streamlit |
| `requirements.txt` | Legacy Python deps |
| `index.jsx` | Moved to `src/App.jsx` |

---

## Task Breakdown

### Task 1: Create package.json

**Files:**
- Create: `package.json`

**Interfaces:**
- Produces: `npm` scripts (`dev`, `build`, `preview`, `lint`, `format`, `format:fix`, `prepare`) and all dependency versions used by later tasks.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "shannonsdemon",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "format": "prettier --check src/",
    "format:fix": "prettier --write src/",
    "prepare": "husky install"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "eslint": "^8.57.0",
    "@eslint/js": "^9.0.0",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^3.3.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0"
  }
}
```

- [ ] **Step 2: Verify syntax**

Run: `cat package.json | node -e "JSON.parse(require('fs').readFileSync(0))"`
Expected: No output (valid JSON)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add package.json with React, Vite, ESLint, Prettier, Husky"
```

---

### Task 2: Create index.html

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: `src/main.jsx` as module entry
- Produces: HTML shell for Vite dev server and production build

- [ ] **Step 1: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shannon's Demon — Risk Parity Rebalancer</title>
    <meta name="description" content="Portfolio optimizer using inverse volatility and tax-efficient asset location" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add index.html Vite entry point"
```

---

### Task 3: Create src/main.jsx

**Files:**
- Create: `src/main.jsx`

**Interfaces:**
- Consumes: `./App` (default export from Task 4)
- Produces: React 18 root render

- [ ] **Step 1: Write src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/main.jsx
git commit -m "feat: add src/main.jsx React bootstrap"
```

---

### Task 4: Migrate index.jsx → src/App.jsx

**Files:**
- Create: `src/App.jsx` (from existing `index.jsx`)
- Delete: `index.jsx` (root)

**Interfaces:**
- Consumes: None (self-contained component with inline styles and localStorage)
- Produces: Default export `App` component used by `src/main.jsx`

- [ ] **Step 1: Copy index.jsx to src/App.jsx**

Run: `mkdir -p src && cp index.jsx src/App.jsx`
Verify: `diff index.jsx src/App.jsx` (should be identical)

- [ ] **Step 2: Delete root index.jsx**

Run: `rm index.jsx`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git rm index.jsx
git commit -m "feat: migrate index.jsx to src/App.jsx"
```

---

### Task 5: Update vite.config.js

**Files:**
- Modify: `vite.config.js`

**Interfaces:**
- Consumes: `@vitejs/plugin-react`
- Produces: Vite config with React plugin + existing base path

- [ ] **Step 1: Update vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/shannonsdemon/',
  plugins: [react()],
})
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.js
git commit -m "chore: update vite.config.js with React plugin"
```

---

### Task 6: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Produces: Ignored patterns for Node/Vite artifacts

- [ ] **Step 1: Append to .gitignore**

```
# Node/Vite
node_modules/
dist/
dist-ssr/
*.local

# Husky
.husky/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for Node/Vite artifacts"
```

---

### Task 7: Create ESLint flat config

**Files:**
- Create: `.eslintrc.json` (ESLint 9 flat config)

**Interfaces:**
- Produces: Lint rules for `npm run lint` (used in CI)

- [ ] **Step 1: Write .eslintrc.json**

```json
{
  "root": true,
  "env": { "browser": true, "es2022": true },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "settings": { "react": { "version": "18.3" } },
  "plugins": ["react", "react-hooks"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 2: Test lint runs**

Run: `npx eslint src/`
Expected: No errors (only warnings for unused vars in demo code)

- [ ] **Step 3: Commit**

```bash
git add .eslintrc.json
git commit -m "chore: add ESLint flat config"
```

---

### Task 8: Create Prettier config

**Files:**
- Create: `.prettierrc`

**Interfaces:**
- Produces: Format rules for `npm run format` / `format:fix` (used in CI + Husky)

- [ ] **Step 1: Write .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

- [ ] **Step 2: Test format check**

Run: `npx prettier --check src/`
Expected: No formatting changes needed (code already matches)

- [ ] **Step 3: Commit**

```bash
git add .prettierrc
git commit -m "chore: add Prettier config"
```

---

### Task 9: Initialize Husky + lint-staged

**Files:**
- Create: `.husky/pre-commit` (auto-generated by `husky install`)
- Modify: `package.json` (add `lint-staged` field)

**Interfaces:**
- Consumes: `lint-staged` config in `package.json`
- Produces: Pre-commit hook that runs ESLint+Prettier on staged files

- [ ] **Step 1: Add lint-staged to package.json**

```json
"lint-staged": {
  "*.{js,jsx}": ["eslint --fix", "prettier --write"]
}
```
(Add this as a top-level field in `package.json`)

- [ ] **Step 2: Install deps and initialize Husky**

Run:
```bash
npm ci
npm run prepare
```
Verify: `.husky/pre-commit` exists and contains `npx lint-staged`

- [ ] **Step 3: Test pre-commit hook**

Run:
```bash
echo "const x = 1;" > src/temp.js
git add src/temp.js
git commit -m "test" 2>&1 | head -20
```
Expected: Hook runs ESLint/Prettier on staged file

Run: `rm src/temp.js && git reset HEAD~1`

- [ ] **Step 4: Commit**

```bash
git add package.json .husky/
git commit -m "chore: add Husky + lint-staged pre-commit hook"
```

---

### Task 10: Create CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm ci`, `npm run lint`, `npm run format`, `npm run build`
- Produces: CI gate on every push/PR

- [ ] **Step 1: Write .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow"
```

---

### Task 11: Create CD deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build` → outputs `dist/`
- Produces: Deploys `dist/` to `gh-pages` branch

- [ ] **Step 1: Write .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow"
```

---

### Task 12: Rewrite README.md

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: Updated documentation for React/Vite setup, dev commands, and GitHub Pages deployment

- [ ] **Step 1: Write new README.md**

```markdown
# Shannon's Demon — Risk Parity Rebalancer

A React + Vite static site for portfolio optimization using risk parity principles and tax-efficient asset location strategies. Deploys free to GitHub Pages.

## Overview

- **Risk Parity Allocation**: Inverse volatility weighting with live market data
- **Tax-Efficient Placement**: Waterfall algorithm (bonds → IRAs, stocks → taxable)
- **Rebalancing Guidance**: Shannon's Demon — trade only when drift exceeds threshold
- **Three Tabs**: Current Holdings → Risk Parity Targets → Trades
- **Persistence**: localStorage survives page refresh

## Quick Start

```bash
# Install dependencies
npm ci

# Dev server
npm run dev

# Production build
npm run build

# Preview build locally
npm run preview
```

## Deployment

Automatic via GitHub Actions on push to `main`:
1. CI runs (lint, format, build)
2. CD deploys `dist/` to GitHub Pages at `https://paruff.github.io/shannonsdemon/`

Configure in repository Settings → Pages → Source: GitHub Actions.

## Configuration

1. **Assets Tab**: Enter tickers (comma-separated), select volatility lookback (3mo/6mo/1y/2y), set rebalance threshold (1–20%)
2. **Account Balances Tab**: Enter Taxable, Traditional IRA/401k, Roth IRA balances
3. **Current Holdings Tab**: Enter share counts per ticker per account
4. Click **Run Analysis** to fetch live prices, compute targets, and generate trades

## Data Source

Uses Yahoo Finance unofficial v8 chart endpoint (no API key). Works from browsers but may break without notice — see `Known Limitations.md`.

## Quality Gates

- `npm run lint` — ESLint (React, hooks)
- `npm run format` — Prettier check
- `npm run format:fix` — Auto-format
- Pre-commit: Husky + lint-staged runs both on staged files
- CI: Runs all gates + build on every push/PR

## License

MIT — see `LICENSE`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for React + Vite + GitHub Pages"
```

---

### Task 13: Delete legacy files

**Files:**
- Delete: `app.py`
- Delete: `requirements.txt`

**Interfaces:**
- Produces: Clean repo without Python/Streamlit artifacts

- [ ] **Step 1: Delete files**

Run: `rm app.py requirements.txt`

- [ ] **Step 2: Commit**

```bash
git rm app.py requirements.txt
git commit -m "chore: remove legacy Streamlit app and Python deps"
```

---

### Task 14: Final verification

**Files:**
- None new (verification of full pipeline)

**Interfaces:**
- Consumes: All prior tasks
- Produces: Confirmed working dev server, build, and CI-ready repo

- [ ] **Step 1: Fresh install + build**

Run:
```bash
rm -rf node_modules dist package-lock.json
npm ci
npm run build
```
Expected: `dist/` created with `index.html`, assets, no errors.

- [ ] **Step 2: Dev server smoke test**

Run: `npm run dev` (background), `curl -s http://localhost:5173/shannonsdemon/ | head -20`
Expected: HTML with `<div id="root"></div>` and module script tag.

Kill dev server.

- [ ] **Step 3: Lint + format verification**

Run: `npm run lint && npm run format`
Expected: Zero errors, zero formatting changes.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: final migration verification — all gates pass"
```

---

## Execution Notes

- **Order matters**: Tasks 1–4 create the runnable app; 5–9 add tooling; 10–11 add CI/CD; 12–13 clean up docs/legacy; 14 verifies.
- **Commit per task**: Each task ends with a commit for easy bisect/review.
- **Husky install** (Task 9) must run after `npm ci` — included in its steps.
- **CI/CD secrets**: No secrets needed; GitHub Pages uses `GITHUB_TOKEN` via `actions/deploy-pages@v4`.
- **Browser test**: After deploy, verify at `https://paruff.github.io/shannonsdemon/` — the app must load without console errors.

---

## Phase 2: QA + UX Polish (Top 0.1%)

### Task 15: Add Vitest + Unit Tests for Finance Helpers

**Files:**
- Create: `package.json` (add vitest, @vitest/ui)
- Create: `vitest.config.js`
- Create: `src/utils/__tests__/finance.test.js`

**Interfaces:**
- Consumes: `annualizedVol`, `inverseVolWeights`, `taxLocationWaterfall`, `generateTrades` from `src/App.jsx` (extract to `src/utils/finance.js` first)
- Produces: Test coverage for pure finance logic

- [ ] **Step 1: Extract finance helpers to `src/utils/finance.js`**
```bash
mkdir -p src/utils
# Move fetchQuote, annualizedVol, inverseVolWeights, taxLocationWaterfall, generateTrades, TAX_INEFFICIENCY, ACCOUNT_TYPES, LOOKBACK_OPTIONS, fmt from App.jsx to src/utils/finance.js
# Update App.jsx to import from './utils/finance'
```

- [ ] **Step 2: Add Vitest deps to package.json**
```json
"devDependencies": {
  "vitest": "^2.0.0",
  "@vitest/ui": "^2.0.0",
  "jsdom": "^24.0.0"
},
"scripts": {
  "test": "vitest run",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Write vitest.config.js**
```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'] }
})
```

- [ ] **Step 4: Write src/utils/__tests__/finance.test.js**
```js
import { describe, it, expect } from 'vitest'
import { annualizedVol, inverseVolWeights, taxLocationWaterfall, generateTrades } from '../finance'

describe('annualizedVol', () => {
  it('returns ~0.15 for 15% annual vol', () => {
    const closes = [100, 101, 99, 102, 98, 103, 97, 104, 96, 105]
    const vol = annualizedVol(closes)
    expect(vol).toBeGreaterThan(0.1)
    expect(vol).toBeLessThan(0.3)
  })
  it('returns 0 for flat prices', () => {
    expect(annualizedVol([100, 100, 100, 100])).toBe(0)
  })
})

describe('inverseVolWeights', () => {
  it('weights inversely to volatility', () => {
    const weights = inverseVolWeights({ A: 0.1, B: 0.2 })
    expect(weights.A).toBeCloseTo(0.667, 2)
    expect(weights.B).toBeCloseTo(0.333, 2)
  })
})

describe('taxLocationWaterfall', () => {
  it('places high-inefficiency assets in best accounts first', () => {
    const targetWeights = { TLT: 0.4, SPY: 0.6 }
    const prices = { TLT: 100, SPY: 400 }
    const accounts = { 'Roth IRA': 50000, 'Taxable': 50000 }
    const result = taxLocationWaterfall(targetWeights, prices, accounts, 100000)
    expect(result['Roth IRA'].TLT).toBeGreaterThan(0)
  })
})

describe('generateTrades', () => {
  it('generates BUY when underweight', () => {
    const current = { Taxable: { SPY: 0 } }
    const target = { Taxable: { SPY: 50000 } }
    const prices = { SPY: 500 }
    const trades = generateTrades(current, target, prices, 100000, 0.05)
    expect(trades[0].action).toBe('BUY')
  })
  it('generates no trades when within threshold', () => {
    const current = { Taxable: { SPY: 100 } }
    const target = { Taxable: { SPY: 50000 } }
    const prices = { SPY: 500 }
    const trades = generateTrades(current, target, prices, 100000, 0.05)
    expect(trades.length).toBe(0)
  })
})
```

- [ ] **Step 5: Run tests and commit**
```bash
npm ci
npm run test
git add package.json vitest.config.js src/utils/ src/utils/__tests__/
git commit -m "test: add Vitest + unit tests for finance helpers"
```

---

### Task 16: Add MSW + Integration Test for fetchQuote

**Files:**
- Create: `src/utils/__tests__/fetchQuote.test.js`
- Create: `src/mocks/handlers.js` (MSW handlers)

**Interfaces:**
- Consumes: `fetchQuote` from `src/utils/finance.js`
- Produces: Integration test with mocked Yahoo Finance responses

- [ ] **Step 1: Add MSW deps**
```json
"devDependencies": {
  "msw": "^2.3.0"
}
```

- [ ] **Step 2: Write src/mocks/handlers.js**
```js
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://query1.finance.yahoo.com/v8/finance/chart/:ticker', ({ params }) => {
    const { ticker } = params
    if (ticker === 'INVALID') {
      return new HttpResponse(null, { status: 404 })
    }
    if (ticker === 'RATELIMIT') {
      return new HttpResponse(null, { status: 429 })
    }
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.1) * 5)
    return HttpResponse.json({
      chart: { result: [{ indicators: { adjclose: [{ adjclose: closes }] } }] }
    })
  })
]
```

- [ ] **Step 3: Write src/utils/__tests__/fetchQuote.test.js**
```js
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { fetchQuote } from '../finance'
import { setupServer } from 'msw/node'
import { handlers } from '../../mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('fetchQuote', () => {
  it('returns price + volatility data for valid ticker', async () => {
    const result = await fetchQuote('SPY', '1y')
    expect(result.ticker).toBe('SPY')
    expect(result.latestPrice).toBeGreaterThan(0)
    expect(result.closes.length).toBeGreaterThan(10)
  })
  it('throws on 404', async () => {
    await expect(fetchQuote('INVALID', '1y')).rejects.toThrow('404')
  })
  it('throws on 429 rate limit', async () => {
    await expect(fetchQuote('RATELIMIT', '1y')).rejects.toThrow('429')
  })
})
```

- [ ] **Step 4: Run and commit**
```bash
npm ci
npm run test
git add package.json src/mocks/ src/utils/__tests__/fetchQuote.test.js
git commit -m "test: add MSW integration test for fetchQuote"
```

---

### Task 17: Add Playwright + E2E Smoke Test

**Files:**
- Create: `package.json` (add @playwright/test)
- Create: `playwright.config.js`
- Create: `tests/e2e/smoke.spec.js`

**Interfaces:**
- Consumes: Built app (`npm run build`, `npm run preview`)
- Produces: E2E test covering load → input → analyze → tabs

- [ ] **Step 1: Add Playwright**
```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write playwright.config.js**
```js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 1,
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview', port: 4173, reuseExistingServer: !process.env.CI }
})
```

- [ ] **Step 3: Write tests/e2e/smoke.spec.js**
```js
import { test, expect } from '@playwright/test'

test.describe('Shannon\'s Demon smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shannonsdemon/')
    await page.waitForSelector('#root')
  })

  test('loads and runs analysis with default tickers', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")')
    await expect(page.locator('text=Risk Parity Targets')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('text=SPY')).toBeVisible()
  })

  test('holdings tab accepts input and persists', async ({ page }) => {
    await page.click('button:has-text("Current Holdings")')
    await page.fill('input[placeholder="0"]:first-of-type', '100')
    await page.click('button:has-text("Run Analysis")')
    await expect(page.locator('text=Trades')).toBeVisible()
  })

  test('localStorage survives reload', async ({ page }) => {
    await page.fill('input[placeholder="0"]:first-of-type', '50')
    await page.reload()
    await expect(page.locator('input[placeholder="0"]:first-of-type')).toHaveValue('50')
  })
})
```

- [ ] **Step 4: Add CI step and commit**
```yaml
# In .github/workflows/ci.yml, add:
- run: npx playwright install --with-deps chromium
- run: npm run build
- run: npm run test:e2e
```
```bash
npm ci
npm run build
npm run test:e2e
git add package.json playwright.config.js tests/e2e/ .github/workflows/ci.yml
git commit -m "test: add Playwright E2E smoke tests"
```

---

### Task 18: Add axe-core Accessibility Test

**Files:**
- Create: `package.json` (add axe-core, @axe-core/playwright)
- Create: `tests/e2e/a11y.spec.js`

**Interfaces:**
- Consumes: Running app
- Produces: Automated a11y violations report

- [ ] **Step 1: Add deps**
```bash
npm i -D axe-core @axe-core/playwright
```

- [ ] **Step 3: Write tests/e2e/a11y.spec.js**
```js
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('no violations on analysis tab', async ({ page }) => {
    await page.goto('/shannonsdemon/')
    await page.click('button:has-text("Run Analysis")')
    await expect(page.locator('text=Risk Parity Targets')).toBeVisible({ timeout: 30000 })
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
  test('no violations on holdings tab', async ({ page }) => {
    await page.goto('/shannonsdemon/')
    await page.click('button:has-text("Current Holdings")')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })
})
```

- [ ] **Step 4: Add to CI and commit**
```yaml
# In ci.yml:
- run: npm run test:a11y
```
```bash
npm ci
npm run test:a11y
git add package.json tests/e2y/a11y.spec.js .github/workflows/ci.yml
git commit -m "test: add axe-core accessibility tests"
```

---

### Task 19: Add Lighthouse CI Budget

**Files:**
- Create: `lighthouserc.json`
- Create: `.github/workflows/lighthouse.yml`

**Interfaces:**
- Consumes: Production build
- Produces: Performance budget enforcement

- [ ] **Step 1: Add Lighthouse CI**
```bash
npm i -D @lhci/cli
```

- [ ] **Step 2: Write lighthouserc.json**
```json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

- [ ] **Step 3: Write .github/workflows/lighthouse.yml**
```yaml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx lhci autorun
```

- [ ] **Step 4: Commit**
```bash
git add lighthouserc.json .github/workflows/lighthouse.yml
git commit -m "ci: add Lighthouse CI performance budget"
```

---

### Task 20: Add React Error Boundary

**Files:**
- Modify: `src/App.jsx` (wrap tabs in ErrorBoundary)
- Create: `src/components/ErrorBoundary.jsx`

**Interfaces:**
- Produces: Graceful fallback UI when render/data errors occur

- [ ] **Step 1: Write src/components/ErrorBoundary.jsx**
```jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#fca5a5', background: '#1a0808', border: '1px solid #7f1d1d', borderRadius: 8 }}>
          <strong>Something went wrong:</strong> {this.state.error?.message}
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginLeft: 12 }}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Wrap each tab in App.jsx**
```jsx
import ErrorBoundary from './components/ErrorBoundary'
// ...
<ErrorBoundary><HoldingsTab /></ErrorBoundary>
<ErrorBoundary><AnalysisTab /></ErrorBoundary>
<ErrorBoundary><TradesTab /></ErrorBoundary>
```

- [ ] **Step 3: Commit**
```bash
git add src/components/ErrorBoundary.jsx src/App.jsx
git commit -m "feat: add React Error Boundary for tab isolation"
```

---

### Task 21: UX - Progressive Disclosure (Advanced Collapse)

**Files:**
- Modify: `src/App.jsx` (sidebar sections)

- [ ] **Step 1: Add collapsible "Advanced" section**
```jsx
const [showAdvanced, setShowAdvanced] = useState(false)
// In sidebar:
<button onClick={() => setShowAdvanced(!showAdvanced)} style={{...S.btn, background: 'none', color: '#64748b', width: 'auto', padding: 0}}>
  {showAdvanced ? '▼' : '▶'} Advanced
</button>
{showAdvanced && (
  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
    {/* Move lookback, threshold, custom tickers here */}
  </div>
)}
```

- [ ] **Step 2: Disable Run button until valid**
```jsx
const canRun = tickers.length > 0 && totalValue > 0
<button disabled={analysisState === 'loading' || !canRun} ...>
```

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "ux: add progressive disclosure + run button validation"
```

---

### Task 22: UX - Inline Tooltips for Financial Concepts

**Files:**
- Modify: `src/App.jsx` (add Tooltip component + usage)

- [ ] **Step 1: Add Tooltip component**
```jsx
function Tooltip({ children, tip }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{ position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#0d1424', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px',
          fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap', zIndex: 10, width: 280 }}>
        {tip}
      </div>
    )}
    </span>
  )
}
```

- [ ] **Step 2: Apply to labels**
```jsx
<Tooltip tip="Inverse volatility: lower vol assets get higher weight so each contributes equal risk">
  <label>Risk Parity</label>
</Tooltip>
<Tooltip tip="Only trade when drift exceeds this % — captures volatility premium above costs">
  <label>Rebalance Band</label>
</Tooltip>
<Tooltip tip="Bonds/REITs/commodities go in IRAs first to shelter ordinary income">
  <label>Tax Location</label>
</Tooltip>
<Tooltip tip="Shannon's Demon: rebalance to harvest volatility variance, not chase returns">
  <label>Shannon's Demon</label>
</Tooltip>
```

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "ux: add inline tooltips for financial concepts"
```

---

### Task 23: UX - Live Validation Feedback

**Files:**
- Modify: `src/App.jsx` (ticker validation, holdings preview)

- [ ] **Step 1: Debounced ticker validation**
```jsx
const [tickerStatus, setTickerStatus] = useState({}) // { SPY: 'ok'|'error'|'pending' }
useEffect(() => {
  const timer = setTimeout(async () => {
    for (const t of tickers) {
      setTickerStatus(s => ({ ...s, [t]: 'pending' }))
      try { await fetchQuote(t, lookback); setTickerStatus(s => ({ ...s, [t]: 'ok' })) }
      catch { setTickerStatus(s => ({ ...s, [t]: 'error' })) }
    }
  }, 500)
  return () => clearTimeout(timer)
}, [tickers, lookback])
// Render status badge next to each ticker in list
```

- [ ] **Step 2: Holdings live value preview**
```jsx
// Already in App.jsx: {prices[ticker] && shares > 0 && <div>≈ {fmt.usd(shares * prices[ticker])}</div>}
// Ensure it updates on every keystroke (already works via useState)
```

- [ ] **Step 3: Threshold trade preview**
```jsx
const estimatedTrades = useMemo(() => generateTrades(currentHoldings, targetAllocation, prices, totalValue, threshold), [...])
<div style={{ fontSize: 11, color: '#475569' }}>
  {estimatedTrades.length > 0 ? `~${estimatedTrades.length} trades if run now` : 'No trades needed'}
</div>
```

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "ux: live ticker validation + trade preview"
```

---

### Task 24: UX - Copy/Paste Workflows

**Files:**
- Modify: `src/App.jsx` (add CSV paste handler, export buttons)

- [ ] **Step 1: CSV paste in Holdings tab**
```jsx
const handlePaste = (e) => {
  const text = e.clipboardData.getData('text')
  const rows = text.trim().split('\n').map(r => r.split(/[,\t]/))
  // Expect: Account, Ticker, Shares
  rows.forEach(([acct, ticker, shares]) => {
    if (ACCOUNT_TYPES.includes(acct.trim()) && tickers.includes(ticker.trim().toUpperCase())) {
      updateHolding(acct.trim(), ticker.trim().toUpperCase(), parseFloat(shares) || 0)
    }
  })
}
<textarea onPaste={handlePaste} placeholder="Paste CSV: Account, Ticker, Shares" ... />
```

- [ ] **Step 2: Export trades as CSV**
```jsx
const exportTradesCSV = () => {
  const headers = ['Action', 'Ticker', 'Account', 'Shares', 'Amount', 'Current%', 'Target%', 'Drift']
  const rows = trades.map(t => [t.action, t.ticker, t.account, t.shares, t.dollarAmount, t.currentWeight, t.targetWeight, t.drift])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  navigator.clipboard.writeText(csv)
}
<button onClick={exportTradesCSV}>Copy Trades as CSV</button>
```

- [ ] **Step 3: Export full state as JSON**
```jsx
const exportState = () => {
  const state = { tickers, lookback, threshold, accounts, currentHoldings, prices, vols, targetWeights, targetAllocation, trades }
  navigator.clipboard.writeText(JSON.stringify(state, null, 2))
}
<button onClick={exportState}>Copy Full State JSON</button>
```

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "ux: add CSV paste + export workflows"
```

---

### Task 25: UX - Scenario Save/Compare

**Files:**
- Modify: `src/App.jsx` (scenario state + comparison view)

- [ ] **Step 1: Add scenario management**
```jsx
const [scenarios, setScenarios] = useState(() => {
  try { return JSON.parse(localStorage.getItem('shannonsdemon_scenarios_v1') || '[]') } catch { return [] }
})
const saveScenario = (name) => {
  const state = { tickers, lookback, threshold, accounts, currentHoldings, name, timestamp: Date.now() }
  setScenarios(s => { const ns = [...s, state]; localStorage.setItem('...', JSON.stringify(ns)); return ns })
}
// Render saved scenarios list with Load/Delete buttons
```

- [ ] **Step 2: Side-by-side diff (Phase 2 stretch)**
```jsx
// Compare two scenarios: show weight diff, trade count diff
```

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "ux: add scenario save/load (diff in Phase 3)"
```

---

### Task 26: UX - Keyboard/Mobile Polish

**Files:**
- Modify: `src/App.jsx` (focus management, bottom sheet on mobile)

- [ ] **Step 1: Tab order + Enter handling**
```jsx
// textarea onKeyDown: Enter → applyTickerInput + focus lookback select
// Tab index flow: tickers → lookback → threshold → accounts → holdings → Run
```

- [ ] **Step 2: Mobile bottom sheet for sidebar**
```jsx
const [mobileSidebar, setMobileSidebar] = useState(false)
if (window.innerWidth < 768) {
  // Render sidebar as fixed bottom sheet, toggle via hamburger
}
```

- [ ] **Step 3: Sticky ticker column in tables**
```css
th:first-child, td:first-child { position: sticky; left: 0; background: #0d1424; z-index: 1 }
```

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "ux: keyboard flow + mobile bottom sheet + sticky columns"
```

---

### Task 27: UX - Error Recovery UI

**Files:**
- Modify: `src/App.jsx` (retry countdown, fallback button)

- [ ] **Step 1: Rate-limit retry countdown**
```jsx
const [retryCountdown, setRetryCountdown] = useState(0)
useEffect(() => {
  if (retryCountdown > 0) {
    const t = setInterval(() => setRetryCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }
}, [retryCountdown])

// In error UI:
{retryCountdown > 0 && <span>Retry in {retryCountdown}s…</span>}
<button onClick={() => { setRetryCountdown(30); runAnalysis() }}>Retry Now</button>
```

- [ ] **Step 2: Alpha Vantage fallback button**
```jsx
<button onClick={() => { /* swap fetchQuote to Alpha Vantage adapter */ }}>
  Try Alpha Vantage (25 req/day)
</button>
```

- [ ] **Step 3: Fuzzy ticker suggestions**
```jsx
// On 404: suggest common ETFs (VOO, IVV, VTI, QQQ, SPY) via Levenshtein distance
```

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "ux: error recovery with retry + fallback + suggestions"
```

---

### Task 28: UX - Trust Signals

**Files:**
- Modify: `src/App.jsx` (timestamp, version badge)

- [ ] **Step 1: Last fetched timestamp**
```jsx
const [lastFetch, setLastFetch] = useState(null)
// In runAnalysis: setLastFetch(new Date().toLocaleTimeString())
<div style={{ fontSize: 11, color: '#475569' }}>
  Last prices: {lastFetch ? `${lastFetch} (${Math.round((Date.now() - new Date(lastFetch).getTime())/60000)} min ago)` : '—'}
</div>
```

- [ ] **Step 2: Version badge in footer**
```jsx
<div style={{ fontSize: 10, color: '#334155' }}>
  v{__VERSION__} • <a href="https://github.com/paruff/shannonsdemon/commit/__COMMIT__" target="_blank" rel="noopener">__COMMIT_SHORT__</a>
</div>
// Injected via Vite define: { '__VERSION__': JSON.stringify(process.env.npm_package_version), '__COMMIT__': JSON.stringify(process.env.GITHUB_SHA || 'local'), '__COMMIT_SHORT__': JSON.stringify((process.env.GITHUB_SHA || 'local').slice(0,7)) }
```

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx vite.config.js
git commit -m "ux: add trust signals (timestamp, version badge)"
```

---

### Task 29: UX - Delight Details

**Files:**
- Modify: `src/App.jsx` (confetti, spring animations, focus rings)

- [ ] **Step 1: Confetti on "No trades needed"**
```jsx
import { useEffect } from 'react'
function Confetti({ show }) {
  useEffect(() => { if (show) { /* canvas-confetti burst */ } }, [show])
  return null
}
// In Trades tab: <Confetti show={trades.length === 0 && analysisState === 'done'} />
```

- [ ] **Step 2: Spring animation on weight bars**
```jsx
// Use CSS transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1)
// Already works via style width change — ensure transition in WeightBar
```

- [ ] **Step 3: Focus rings**
```jsx
// Add to S.input: outline: 'none', ':focus-visible': { outline: '2px solid #3b82f6', outlineOffset: 2 }
```

- [ ] **Step 4: Light mode toggle (for printing)**
```jsx
const [darkMode, setDarkMode] = useState(true)
<div style={{ ...S.app, background: darkMode ? '#0a0f1e' : '#f8fafc', color: darkMode ? '#e2e8f0' : '#0f172a' }}>
<button onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀' : '🌙'}</button>
```

- [ ] **Step 5: Commit**
```bash
git add src/App.jsx
git commit -m "ux: confetti + spring animations + focus rings + light mode"
```

---

## Phase 2 Summary

| Task | Category | Priority |
|---|---|---|
| 15 | Vitest unit tests | P0 — ships with migration |
| 16 | MSW integration | P0 — validates API contract |
| 17 | Playwright E2E | P0 — regression safety |
| 18 | axe-core a11y | P1 — accessibility baseline |
| 19 | Lighthouse CI | P1 — perf budget |
| 20 | Error Boundary | P1 — resilience |
| 21 | Progressive disclosure | P1 — UX clarity |
| 22 | Inline tooltips | P1 — learnability |
| 23 | Live validation | P1 — confidence |
| 24 | Copy/paste workflows | P2 — power users |
| 25 | Scenario save | P2 — iteration |
| 26 | Keyboard/mobile | P2 — polish |
| 27 | Error recovery | P2 — trust |
| 28 | Trust signals | P2 — credibility |
| 29 | Delight details | P3 — joy |

---

**Plan updated with Phase 2 tasks.**