# Phase 3: Evidence & Insight

## Context

Expert review identified the #1 gap: **no backtesting**. A top 0.1% strategist would say "show me the data" — without historical evidence, the tool is a calculator, not an advisor. Phase 3 adds the evidence layer.

## What We're Building

Three features that transform the tool from "run the math" to "see the evidence":

### 1. Historical Performance Chart (backtest-lite)
- Use the Yahoo data already fetched (closes array)
- Show two lines: (a) current allocation rebalanced at threshold, (b) static 60/40 or equal-weight
- Simple cumulative return chart (no need for full backtest engine)
- Reveals: does rebalancing actually add value for THIS portfolio?

### 2. Correlation Matrix
- Compute pairwise correlations from the fetched closes
- Display as a heatmap in the Analysis tab
- Reveals: are your assets actually diversified, or do they move together?

### 3. Risk Contribution Breakdown
- Show how much risk each asset contributes to total portfolio risk
- Compare weight % vs risk contribution % (risk parity should be equal)
- Reveals: is your portfolio actually risk-balanced, or just weight-balanced?

## Scope Boundaries

**In scope:**
- Chart: simple line chart (CSS/SVG, no charting library)
- Correlation: computed from existing data, displayed in a table
- Risk contribution: derived from existing vol + weight calculations

**Out of scope (deferred):**
- Full backtesting engine with configurable rebalancing frequency
- Monte Carlo simulation
- Transaction cost modeling
- Tax-loss harvesting
- Benchmark comparison (S&P 500, target-date)

## Technical Approach

All three features reuse the `closes` data already fetched by `fetchQuote`. No new API calls needed.

### Files to modify:
- `src/utils/finance.js` — add `computeCorrelation(a, b)`, `riskContribution(weights, vols, correlations)`
- `src/App.jsx` — add chart component, correlation table, risk breakdown display
- `src/utils/__tests__/finance.test.js` — tests for new functions

### Implementation order:
1. Risk contribution (smallest scope, pure math)
2. Correlation matrix (medium scope, derived from closes)
3. Performance chart (largest scope, needs chart rendering)

## Acceptance Criteria

- [ ] Risk contribution: shows % risk per asset, sum = 100%
- [ ] Correlation: shows pairwise correlation matrix for all tickers
- [ ] Chart: shows cumulative return over the lookback period
- [ ] All features use existing data (no new API calls)
- [ ] All new functions have unit tests
- [ ] E2E tests pass (existing specs)
- [ ] Lighthouse budget maintained

## Estimated Effort

- Risk contribution: ~1 hour
- Correlation matrix: ~2 hours
- Performance chart: ~3 hours
- Tests + verification: ~1 hour

Total: ~7 hours (1 session)
