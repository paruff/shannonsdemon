# Finance Math Validator

Use when modifying `src/utils/finance.js` or adding new financial calculations. Validates that portfolio math is correct before committing.

## When to Load

- After changing `annualizedVol`, `inverseVolWeights`, `taxLocationWaterfall`, or `generateTrades`
- After adding any new financial calculation function
- Before committing changes to `src/utils/finance.js`

## Validation Checklist

### Volatility (`annualizedVol`)
- Input: array of daily closes (length ≥ 10)
- Output: annualized standard deviation (0 to ~0.60 for single assets)
- Edge cases: flat prices → 0, single price → 0, negative values → clamp to 0
- Sanity: SPY vol ~0.15-0.25, bonds ~0.05-0.15, commodities ~0.15-0.30

### Weights (`inverseVolWeights`)
- All weights must be positive
- Weights must sum to 1.0 (±0.001 tolerance)
- Lower vol → higher weight (inverse relationship)
- Edge case: all same vol → equal weights

### Tax Location (`taxLocationWaterfall`)
- High-inefficiency assets (TLT=10) placed in Roth/IRA first
- Low-inefficiency assets (SPY=2) go to taxable
- No allocation exceeds account balance
- All accounts sum to totalValue

### Trades (`generateTrades`)
- Only generate trades when drift > threshold
- BUY when underweight, SELL when overweight
- Dollar amount = deltaShares × currentPrice
- No fractional shares for BUYs (floor), SELLs use exact amounts
- Trade count = number of assets with drift > threshold

### Closest Tickers (`closestTickers`)
- Always returns ≤ limit suggestions
- Suggestions are from COMMON_ETFS list
- Levenshtein distance is finite and non-negative
- Exact match ranks first

## Quick Validation Commands

```bash
env -u NODE_OPTIONS npx vitest run src/utils/__tests__/finance.test.js
env -u NODE_OPTIONS npx vitest run src/utils/__tests__/fetchQuote.test.js
```

## Red Flags

- Weights not summing to 1.0 → `inverseVolWeights` has a bug
- Zero trades when large drift → threshold comparison is wrong
- Negative trade amounts → sign logic in `generateTrades` is inverted
- Volatility > 1.0 → check for missing sqrt(252) annualization
- Tax location putting SPY in Roth first → `TAX_INEFFICIENCY` values are wrong
