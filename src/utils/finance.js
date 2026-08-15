// ─── FINANCE HELPERS ────────────────────────────────────────────────────────

const TAX_INEFFICIENCY = {
  // Bonds – interest taxed as ordinary income
  TLT: 10,
  IEF: 10,
  BND: 10,
  AGG: 10,
  VGIT: 10,
  VCIT: 10,
  LQD: 10,
  TIP: 9,
  // REITs – non-qualified dividends
  VNQ: 9,
  SCHH: 9,
  IYR: 9,
  // Commodities – collectibles rate or K-1
  GLD: 8,
  IAU: 8,
  DBC: 8,
  PDBC: 8,
  SLV: 8,
  // International – foreign tax credit offsets some drag; keep in taxable if needed
  EEM: 4,
  VEA: 4,
  VXUS: 4,
  // Broad equity – qualified divs, LT cap gains
  SPY: 2,
  VTI: 2,
  QQQ: 2,
  VOO: 2,
  IVV: 2,
  VIG: 3,
};

const ACCOUNT_TYPES = ['Taxable', 'Traditional IRA / 401k', 'Roth IRA'];
const LOOKBACK_OPTIONS = ['3mo', '6mo', '1y', '2y'];

// Common liquid ETFs for "did you mean" suggestions on bad tickers.
const COMMON_ETFS = [
  'SPY',
  'VOO',
  'IVV',
  'VTI',
  'QQQ',
  'IWM',
  'EEM',
  'AGG',
  'TLT',
  'BND',
  'GLD',
  'SLV',
  'VNQ',
  'VEA',
  'VWO',
  'DIA',
  'IEFA',
  'IJR',
  'XLK',
  'XLE',
];

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

// Closest candidate symbols to a (possibly mistyped) ticker.
function closestTickers(ticker, candidates = COMMON_ETFS, limit = 3) {
  return candidates
    .map(c => ({ c, d: levenshtein(ticker.toUpperCase(), c) }))
    .sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
    .slice(0, limit)
    .map(x => x.c);
}
// ─── FINANCE HELPERS ──────────────────────────────────────────────────────────

// Yahoo Finance v8 chart endpoint – unofficial, no API key needed, CORS-friendly via a proxy trick.
// NOTE: This endpoint is unofficial and may break. Swap fetchQuote() if needed.
async function fetchQuote(ticker, period = '1y') {
  const interval = period === '3mo' ? '1d' : '1d';
  const range = period;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}&events=history`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${ticker}: HTTP ${resp.status}`);
  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  const closes = result.indicators.adjclose?.[0]?.adjclose ?? result.indicators.quote?.[0]?.close;
  if (!closes || closes.length < 10) throw new Error(`Insufficient history for ${ticker}`);
  const valid = closes.filter(Boolean);
  return { ticker, closes: valid, latestPrice: valid[valid.length - 1] };
}

function annualizedVol(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252); // annualize
}

function inverseVolWeights(vols) {
  const invVols = {};
  let total = 0;
  for (const [t, v] of Object.entries(vols)) {
    const inv = 1 / Math.max(v, 0.001);
    invVols[t] = inv;
    total += inv;
  }
  const weights = {};
  for (const [t, inv] of Object.entries(invVols)) {
    weights[t] = inv / total;
  }
  return weights;
}

// ─── TAX LOCATION WATERFALL ───────────────────────────────────────────────────

// Returns: { "Roth IRA": { SPY: $amount, ... }, ... }
function taxLocationWaterfall(targetWeights, prices, accounts, totalValue) {
  // Sort assets by tax inefficiency descending (put worst in best shelter first)
  const sorted = Object.keys(targetWeights).sort((a, b) => {
    return (TAX_INEFFICIENCY[b] ?? 5) - (TAX_INEFFICIENCY[a] ?? 5);
  });

  // Account priority: Roth = 1 (best), Trad = 2, Taxable = 3
  const accountPriority = name => {
    if (name.includes('Roth')) return 1;
    if (name.includes('IRA') || name.includes('401k')) return 2;
    return 3;
  };

  const sortedAccounts = Object.entries(accounts)
    .sort(([a], [b]) => accountPriority(a) - accountPriority(b))
    .map(([name, bal]) => ({ name, remaining: bal, holdings: {} }));

  for (const ticker of sorted) {
    let needed = targetWeights[ticker] * totalValue;
    for (const acc of sortedAccounts) {
      if (needed <= 0) break;
      if (acc.remaining <= 0) continue;
      const place = Math.min(needed, acc.remaining);
      acc.holdings[ticker] = (acc.holdings[ticker] ?? 0) + place;
      acc.remaining -= place;
      needed -= place;
    }
  }

  const result = {};
  for (const acc of sortedAccounts) {
    result[acc.name] = acc.holdings;
  }
  return result;
}

// ─── TRADE GENERATION ─────────────────────────────────────────────────────────

// currentHoldings: { "Taxable": { SPY: shares }, ... }
// targetAllocation: { "Taxable": { SPY: $amount }, ... }
// prices: { SPY: 450.23, ... }
// threshold: 0.05 (5%)
function generateTrades(currentHoldings, targetAllocation, prices, totalValue, threshold) {
  const trades = [];

  // Compute current $ values per account per ticker
  const currentValues = {};
  for (const [acct, holdings] of Object.entries(currentHoldings)) {
    currentValues[acct] = {};
    for (const [ticker, shares] of Object.entries(holdings)) {
      currentValues[acct][ticker] = shares * (prices[ticker] ?? 0);
    }
  }

  // Aggregate current total per ticker across all accounts
  const currentTotalByTicker = {};
  for (const holdings of Object.values(currentValues)) {
    for (const [ticker, val] of Object.entries(holdings)) {
      currentTotalByTicker[ticker] = (currentTotalByTicker[ticker] ?? 0) + val;
    }
  }

  // Aggregate target total per ticker
  const targetTotalByTicker = {};
  for (const holdings of Object.values(targetAllocation)) {
    for (const [ticker, val] of Object.entries(holdings)) {
      targetTotalByTicker[ticker] = (targetTotalByTicker[ticker] ?? 0) + val;
    }
  }

  // All tickers
  const allTickers = new Set([
    ...Object.keys(currentTotalByTicker),
    ...Object.keys(targetTotalByTicker),
  ]);

  for (const ticker of allTickers) {
    const currentVal = currentTotalByTicker[ticker] ?? 0;
    const targetVal = targetTotalByTicker[ticker] ?? 0;
    const currentWeight = totalValue > 0 ? currentVal / totalValue : 0;
    const targetWeight = targetVal / totalValue;
    const drift = Math.abs(currentWeight - targetWeight);

    if (drift > threshold) {
      const deltaVal = targetVal - currentVal;
      const price = prices[ticker];
      if (!price) continue;
      const shares = Math.abs(deltaVal / price);

      // Find which account to execute trade in (prefer tax-advantaged for sells to avoid cap gains)
      // Simple heuristic: trade in the account where the target says it belongs
      let tradeAccount =
        Object.keys(targetAllocation).find(acc => (targetAllocation[acc][ticker] ?? 0) > 0) ??
        Object.keys(targetAllocation)[0];

      trades.push({
        ticker,
        action: deltaVal > 0 ? 'BUY' : 'SELL',
        shares: parseFloat(shares.toFixed(4)),
        dollarAmount: Math.abs(deltaVal),
        currentWeight,
        targetWeight,
        drift,
        account: tradeAccount,
        price,
      });
    }
  }

  return trades.sort((a, b) => b.drift - a.drift);
}

// ─── CORRELATION ─────────────────────────────────────────────────────────────

// Pearson correlation between two return series.
function correlation(returnsA, returnsB) {
  const n = Math.min(returnsA.length, returnsB.length);
  if (n < 3) return 0;
  const a = returnsA.slice(-n);
  const b = returnsB.slice(-n);
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0,
    varA = 0,
    varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

// Convert closes array to daily log returns.
function dailyReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(Math.log(closes[i] / closes[i - 1]));
  }
  return r;
}

// Pairwise correlation matrix from { ticker: closes[] }.
function correlationMatrix(allCloses) {
  const tickers = Object.keys(allCloses);
  const returns = {};
  for (const t of tickers) {
    returns[t] = dailyReturns(allCloses[t]);
  }
  const matrix = {};
  for (const a of tickers) {
    matrix[a] = {};
    for (const b of tickers) {
      matrix[a][b] = a === b ? 1 : correlation(returns[a], returns[b]);
    }
  }
  return matrix;
}

// ─── RISK CONTRIBUTION ──────────────────────────────────────────────────────

// Risk contribution of each asset in a portfolio.
// weights: { ticker: weight }, vols: { ticker: annualizedVol }, corrMatrix: correlationMatrix output
// Returns: { ticker: riskContributionPct } (sums to ~1.0)
function riskContribution(weights, vols, corrMatrix) {
  const tickers = Object.keys(weights);
  const n = tickers.length;
  if (n === 0) return {};

  // Build covariance matrix: Cov(i,j) = ρ(i,j) × σ(i) × σ(j)
  const cov = [];
  for (let i = 0; i < n; i++) {
    cov[i] = [];
    for (let j = 0; j < n; j++) {
      const rho = corrMatrix[tickers[i]]?.[tickers[j]] ?? (i === j ? 1 : 0);
      cov[i][j] = rho * (vols[tickers[i]] ?? 0) * (vols[tickers[j]] ?? 0);
    }
  }

  // Marginal risk contribution: MRC_i = (Cov × w)_i / σ_p
  // Risk contribution: RC_i = w_i × MRC_i
  const rc = {};
  let totalRC = 0;
  for (let i = 0; i < n; i++) {
    let mrc = 0;
    for (let j = 0; j < n; j++) {
      mrc += cov[i][j] * (weights[tickers[j]] ?? 0);
    }
    const contribution = (weights[tickers[i]] ?? 0) * mrc;
    rc[tickers[i]] = contribution;
    totalRC += contribution;
  }

  // Normalize to percentages
  if (totalRC > 0) {
    for (const t of tickers) {
      rc[t] = rc[t] / totalRC;
    }
  }
  return rc;
}

// ─── BACKTEST LITE ──────────────────────────────────────────────────────────

// Simulate rebalanced vs buy-and-hold over a period.
// allCloses: { ticker: closes[] }, weights: { ticker: weight }, threshold: rebalance trigger
// Returns: { dates: [], rebalanced: [], buyAndHold: [] } (cumulative returns, starting at 1.0)
function simulatePerformance(allCloses, weights, threshold = 0.05) {
  const tickers = Object.keys(weights);
  if (tickers.length === 0) return { dates: [], rebalanced: [], buyAndHold: [] };

  const minLen = Math.min(...tickers.map(t => allCloses[t]?.length ?? 0));
  if (minLen < 10) return { dates: [], rebalanced: [], buyAndHold: [] };

  // Current weights (rebalanced) and buy-and-hold weights
  const currentWeights = { ...weights };
  const bhValues = {};
  for (const t of tickers) {
    bhValues[t] = weights[t] * (allCloses[t][0] ?? 1);
  }

  const rebalanced = [1];
  const buyAndHold = [1];
  const dates = Array.from({ length: minLen }, (_, i) => i);

  // B&H: fixed dollar amounts per ticker from day 0
  const bhDollars = {};
  for (const t of tickers) {
    bhDollars[t] = weights[t]; // normalized to 1 total
  }

  for (let d = 1; d < minLen; d++) {
    // Rebalanced: compute return from weight drift then check rebalance
    let rebalReturn = 0;
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      rebalReturn += currentWeights[t] * dayReturn;
    }
    rebalanced.push(rebalanced[rebalanced.length - 1] * rebalReturn);

    // Update current weights after price moves
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      currentWeights[t] = (currentWeights[t] * dayReturn) / rebalReturn;
    }

    // Rebalance if drift exceeds threshold
    let needsRebal = false;
    for (const t of tickers) {
      if (Math.abs(currentWeights[t] - weights[t]) > threshold) {
        needsRebal = true;
        break;
      }
    }
    if (needsRebal) {
      for (const t of tickers) {
        currentWeights[t] = weights[t];
      }
    }

    // Buy-and-hold: sum of fixed dollar amounts growing at individual rates
    let bhTotal = 0;
    for (const t of tickers) {
      const dayReturn = (allCloses[t][d] ?? allCloses[t][d - 1]) / (allCloses[t][d - 1] ?? 1);
      bhDollars[t] *= dayReturn;
      bhTotal += bhDollars[t];
    }
    buyAndHold.push(buyAndHold[0] * bhTotal);
  }

  return { dates, rebalanced, buyAndHold };
}

const fmt = {
  pct: v => `${(v * 100).toFixed(1)}%`,
  usd: v =>
    v >= 1000
      ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `$${v.toFixed(2)}`,
  shares: v => v.toFixed(4),
  vol: v => `${(v * 100).toFixed(1)}%`,
};

export {
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  annualizedVol,
  inverseVolWeights,
  taxLocationWaterfall,
  generateTrades,
  closestTickers,
  dailyReturns,
  correlation,
  correlationMatrix,
  riskContribution,
  simulatePerformance,
  fmt,
};
