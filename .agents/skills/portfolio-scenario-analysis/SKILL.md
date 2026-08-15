# Portfolio Scenario Analysis

Use when designing features that involve portfolio behavior, rebalancing logic, or tax optimization. Helps think through scenarios before implementing.

## When to Load

- Adding new analysis features (backtesting, comparison, optimization)
- Modifying rebalancing logic or trade generation
- Adding tax-loss harvesting or wash sale detection
- Designing scenario save/load/compare features

## Core Concepts

### Shannon's Demon
- Rebalance toward risk parity targets periodically
- Harvest volatility: when one asset rises (overweight), sell some and buy underweight assets
- The rebalancing bonus comes from volatility, not directional bets
- Best in tax-advantaged accounts (no tax drag on rebalancing)

### Risk Parity
- Each asset contributes equal risk (not equal weight)
- Lower vol → higher weight (inverse volatility weighting)
- Bonds get ~40% weight, equities ~20%, because bonds are less volatile
- Drift threshold determines when rebalancing triggers

### Tax Location
- High-tax assets (bonds, REITs, commodities) → Roth/IRA (tax-free growth)
- Low-tax assets (broad equities) → taxable (qualified dividends, LT gains)
- The `TAX_INEFFICIENCY` scores drive this placement

## Scenario Test Cases

### Conservative (Bonds-Heavy)
```
Tickers: AGG, BND, TLT, SPY
Accounts: Roth IRA $100k, Taxable $200k
Expected: Bonds in Roth, equities in taxable
```

### Aggressive (Equities-Heavy)
```
Tickers: SPY, QQQ, VTI, IWM
Accounts: Roth IRA $50k, Taxable $50k
Expected: Minimal tax location difference (all low-inefficiency)
```

### Mixed (Multi-Asset)
```
Tickers: SPY, TLT, GLD, VNQ
Accounts: Traditional IRA $100k, Roth IRA $50k, Taxable $150k
Expected: TLT/GLD/VNQ in Roth, SPY in taxable
```

### Edge Cases
- All accounts same type: tax location has no effect
- Single ticker: no rebalancing possible (100% weight always)
- Zero balances: no trades, no allocation
- Very high threshold (20%): rarely trades
- Very low threshold (1%): trades frequently

## Feature Design Questions

When adding a new feature, ask:

1. **Does it affect the math?** If yes, add unit tests first (TDD).
2. **Does it affect tax location?** If yes, consider all account types.
3. **Does it add a new data source?** If yes, mock it in tests.
4. **Does it change the UI flow?** If yes, update E2E tests.
5. **Does it add a dependency?** If yes, justify in commit message.

## Performance Considerations

- `fetchQuote` calls Yahoo API for each ticker sequentially
- For 10 tickers, that's 10 HTTP requests (could be parallelized)
- Volatility calculation is O(n) where n = number of data points
- Trade generation is O(tickers × accounts)
- All calculations are fast (<1ms for typical portfolios)
