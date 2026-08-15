# Yahoo Finance API Patterns

Use when modifying `fetchQuote()` or adding new data fetching. Documents Yahoo Finance v8 API behavior and test mocking patterns.

## When to Load

- Modifying `fetchQuote` in `src/utils/finance.js`
- Adding new Yahoo Finance API endpoints
- Debugging E2E/integration test failures related to data fetching

## API Details

### Endpoint
```
https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={range}&interval={interval}&events=history
```

### Parameters
- `range`: `3mo`, `6mo`, `1y`, `2y` (matches LOOKBACK_OPTIONS)
- `interval`: always `1d` (daily data)
- No API key needed (unofficial, may break)

### Response Structure
```json
{
  "chart": {
    "result": [{
      "meta": { "regularMarketPrice": 450.23 },
      "indicators": {
        "quote": [{ "close": [450.23, 451.10, ...] }]
      }
    }]
  }
}
```

### Error Codes
- 404: Ticker not found (invalid symbol)
- 429: Rate limited (Yahoo throttles unofficial access)
- Empty result: Ticker exists but no data for range

## Test Mocking Patterns

### MSW (Unit/Integration)
```js
// src/mocks/handlers.js
http.get('https://query1.finance.yahoo.com/v8/finance/chart/:ticker', ({ params }) => {
  if (params.ticker === 'INVALID') return HttpResponse.json({}, { status: 404 });
  if (params.ticker === 'RATELIMIT') return HttpResponse.json({}, { status: 429 });
  return HttpResponse.json(mockChartResponse(params.ticker));
})
```

### Playwright (E2E)
```js
// tests/e2e/smoke.spec.js
await page.route('https://query1.finance.yahoo.com/v8/finance/chart/*', route => {
  route.fulfill({ json: mockChartResponse(ticker) });
});
```

## Common Issues

- **CORS in production**: Yahoo blocks browser requests. The tool works because it's a local-only tool. If deploying to a real server, add a proxy.
- **Rate limiting**: Yahoo limits ~2000 requests/hour per IP. For testing, always mock.
- **Missing data**: Some tickers have sparse history. `fetchQuote` checks for ≥10 data points.
- **Ticker normalization**: Always uppercase. `fetchQuote` doesn't normalize — caller must.

## Mock Data Template

```js
function mockChartResponse(ticker) {
  const base = { SPY: 450, TLT: 95, GLD: 180 }[ticker] || 100;
  const closes = Array.from({ length: 252 }, (_, i) => base + (Math.random() - 0.5) * 10);
  return {
    chart: {
      result: [{
        meta: { regularMarketPrice: closes[closes.length - 1] },
        indicators: { quote: [{ close: closes }] },
      }],
    },
  };
}
```
