Known Limitations to Disclose
Yahoo Finance unofficial API — works from browsers today but could break without notice. The fetchQuote() function is isolated so you can swap it for Alpha Vantage (free tier, 25 req/day) or Polygon.io easily.
Trade account assignment — the current logic assigns a trade to whichever account the target allocation places the asset in. For sells, you may want to override this manually to avoid triggering capital gains in taxable accounts. Tax-loss harvesting logic is Phase 3.
Volatility lookback sensitivity — inverse-vol weights can shift meaningfully between 3mo and 2y, especially for assets like GLD or TLT. Worth being aware of which lookback you're anchoring to.
No RMD logic yet — if your Traditional IRA/401k will trigger RMDs, that affects withdrawal sequencing. That's Phase 2.
