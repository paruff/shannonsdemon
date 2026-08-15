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
