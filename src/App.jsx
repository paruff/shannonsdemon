import ErrorBoundary from './components/ErrorBoundary';
import { useState, useEffect, useCallback } from 'react';
import {
  TAX_INEFFICIENCY,
  ACCOUNT_TYPES,
  LOOKBACK_OPTIONS,
  fetchQuote,
  annualizedVol,
  inverseVolWeights,
  taxLocationWaterfall,
  generateTrades,
  fmt,
} from './utils/finance';

const DEFAULT_TICKERS = ['SPY', 'TLT', 'GLD', 'VNQ', 'EEM'];

const DEFAULT_ACCOUNTS = {
  Taxable: 50000,
  'Traditional IRA / 401k': 30000,
  'Roth IRA': 20000,
};

const STORAGE_KEY = 'shannonsdemon_v1';

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────────

// ─── MINI BAR CHART ───────────────────────────────────────────────────────────

function WeightBar({ current, target, ticker }) {
  const maxW = Math.max(current, target, 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 44, fontFamily: 'monospace', color: '#94a3b8' }}>{ticker}</span>
      <div style={{ flex: 1, position: 'relative', height: 20 }}>
        {/* Target bar (background) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(target / maxW) * 100}%`,
            background: '#1e40af22',
            borderRadius: 2,
            border: '1px dashed #3b82f6',
          }}
        />
        {/* Current bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            height: 12,
            width: `${(current / maxW) * 100}%`,
            background: current > target ? '#dc2626' : '#16a34a',
            borderRadius: 2,
            opacity: 0.85,
          }}
        />
      </div>
      <span style={{ width: 40, color: '#cbd5e1', textAlign: 'right' }}>{fmt.pct(current)}</span>
      <span style={{ width: 40, color: '#3b82f6', textAlign: 'right' }}>{fmt.pct(target)}</span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── Config state
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS.join(', '));
  const [lookback, setLookback] = useState('1y');
  const [threshold, setThreshold] = useState(0.05);

  // ── Account balances
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);

  // ── Current holdings: { "Taxable": { SPY: shares } }
  const [currentHoldings, setCurrentHoldings] = useState(() => {
    const h = {};
    for (const acct of ACCOUNT_TYPES) h[acct] = {};
    return h;
  });

  // ── Analysis results
  const [analysisState, setAnalysisState] = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [prices, setPrices] = useState({});
  const [vols, setVols] = useState({});
  const [targetWeights, setTargetWeights] = useState({});
  const [targetAllocation, setTargetAllocation] = useState({});
  const [trades, setTrades] = useState([]);

  // ── UI tabs
  const [tab, setTab] = useState('holdings'); // holdings | analysis | trades

  // ── Load persisted state
  useEffect(() => {
    const saved = loadState();
    if (!saved) return;
    if (saved.tickers) {
      setTickers(saved.tickers);
      setTickerInput(saved.tickers.join(', '));
    }
    if (saved.lookback) setLookback(saved.lookback);
    if (saved.threshold) setThreshold(saved.threshold);
    if (saved.accounts) setAccounts(saved.accounts);
    if (saved.currentHoldings) setCurrentHoldings(saved.currentHoldings);
  }, []);

  // ── Persist on change
  useEffect(() => {
    saveState({ tickers, lookback, threshold, accounts, currentHoldings });
  }, [tickers, lookback, threshold, accounts, currentHoldings]);

  const totalValue = Object.values(accounts).reduce((a, b) => a + (b || 0), 0);

  // ── Compute current weights from holdings
  const currentValueByTicker = {};
  for (const holdings of Object.values(currentHoldings)) {
    for (const [ticker, shares] of Object.entries(holdings)) {
      if (shares > 0 && prices[ticker]) {
        currentValueByTicker[ticker] =
          (currentValueByTicker[ticker] ?? 0) + shares * prices[ticker];
      }
    }
  }
  const currentTotalFromPrices = Object.values(currentValueByTicker).reduce((a, b) => a + b, 0);

  // ── Run analysis
  const runAnalysis = useCallback(async () => {
    setAnalysisState('loading');
    setErrorMsg('');
    try {
      const results = await Promise.all(tickers.map(t => fetchQuote(t, lookback)));

      const newPrices = {};
      const newVols = {};
      for (const r of results) {
        newPrices[r.ticker] = r.latestPrice;
        newVols[r.ticker] = annualizedVol(r.closes);
      }

      const weights = inverseVolWeights(newVols);
      const allocation = taxLocationWaterfall(weights, newPrices, accounts, totalValue);
      const newTrades = generateTrades(
        currentHoldings,
        allocation,
        newPrices,
        totalValue,
        threshold
      );

      setPrices(newPrices);
      setVols(newVols);
      setTargetWeights(weights);
      setTargetAllocation(allocation);
      setTrades(newTrades);
      setAnalysisState('done');
      setTab('analysis');
    } catch (e) {
      setErrorMsg(e.message ?? String(e));
      setAnalysisState('error');
    }
  }, [tickers, lookback, accounts, currentHoldings, totalValue, threshold]);

  // ── UI helpers
  const updateAccount = (name, val) => {
    setAccounts(prev => ({ ...prev, [name]: parseFloat(val) || 0 }));
  };

  const updateHolding = (acct, ticker, val) => {
    setCurrentHoldings(prev => ({
      ...prev,
      [acct]: { ...prev[acct], [ticker]: parseFloat(val) || 0 },
    }));
  };

  const applyTickerInput = () => {
    const parsed = tickerInput
      .split(/[,\s]+/)
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);
    setTickers(parsed);
  };

  // ─── STYLES ───────────────────────────────────────────────────────────────

  const S = {
    app: {
      minHeight: '100vh',
      background: '#0a0f1e',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'system-ui', sans-serif",
      fontSize: 14,
    },
    header: {
      borderBottom: '1px solid #1e293b',
      padding: '18px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: '#0d1424',
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      flexShrink: 0,
    },
    title: { fontSize: 17, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
    body: { display: 'flex', height: 'calc(100vh - 62px)' },
    sidebar: {
      width: 260,
      background: '#0d1424',
      borderRight: '1px solid #1e293b',
      padding: '20px 16px',
      overflowY: 'auto',
      flexShrink: 0,
    },
    main: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
    label: {
      fontSize: 11,
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
      display: 'block',
    },
    input: {
      width: '100%',
      background: '#131d2e',
      border: '1px solid #1e293b',
      borderRadius: 6,
      color: '#e2e8f0',
      padding: '7px 10px',
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box',
    },
    section: { marginBottom: 22 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 12,
      paddingBottom: 6,
      borderBottom: '1px solid #1e293b',
    },
    btn: {
      width: '100%',
      padding: '10px 0',
      background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '0.02em',
    },
    btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    tabs: {
      display: 'flex',
      gap: 4,
      marginBottom: 20,
      borderBottom: '1px solid #1e293b',
      paddingBottom: 0,
    },
    tabBtn: active => ({
      padding: '8px 16px',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      color: active ? '#e2e8f0' : '#94a3b8',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      marginBottom: -1,
    }),
    card: {
      background: '#0d1424',
      border: '1px solid #1e293b',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 12,
    },
    pill: color => ({
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      background: color === 'buy' ? '#14532d' : color === 'sell' ? '#4c0519' : '#1e293b',
      color: color === 'buy' ? '#86efac' : color === 'sell' ? '#fca5a5' : '#94a3b8',
    }),
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    metricVal: { fontSize: 22, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' },
    metricLbl: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    warning: {
      background: '#1c1200',
      border: '1px solid #92400e',
      borderRadius: 8,
      padding: '10px 14px',
      color: '#fbbf24',
      fontSize: 12,
      marginBottom: 14,
    },
    error: {
      background: '#1a0808',
      border: '1px solid #7f1d1d',
      borderRadius: 8,
      padding: '12px 16px',
      color: '#fca5a5',
      fontSize: 13,
      marginBottom: 14,
    },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      padding: '8px 12px',
      textAlign: 'left',
      fontSize: 11,
      color: '#94a3b8',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid #1e293b',
    },
    td: { padding: '10px 12px', borderBottom: '1px solid #0f172a', color: '#cbd5e1' },
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={S.app}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.logo}>⚖</div>
        <div>
          <h1 style={S.title}>Shannon's Demon</h1>
          <div style={S.subtitle}>Risk parity rebalancer · tax-efficient · retirement</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
          Total: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{fmt.usd(totalValue)}</span>
        </div>
      </header>

      <div style={S.body}>
        {/* SIDEBAR */}
        <aside style={S.sidebar}>
          {/* Tickers */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Assets</div>
            <label style={S.label} htmlFor="tickers-input">
              Tickers (comma-separated)
            </label>
            <textarea
              id="tickers-input"
              style={{ ...S.input, height: 68, resize: 'vertical', fontFamily: 'monospace' }}
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value)}
              onBlur={applyTickerInput}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              {tickers.join(' · ')}
            </div>
          </div>

          {/* Lookback & Threshold */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Parameters</div>
            <label style={S.label} htmlFor="lookback-select">
              Volatility lookback
            </label>
            <select
              id="lookback-select"
              style={{ ...S.input, marginBottom: 10 }}
              value={lookback}
              onChange={e => setLookback(e.target.value)}
            >
              {LOOKBACK_OPTIONS.map(o => (
                <option key={o}>{o}</option>
              ))}
            </select>

            <label style={S.label} htmlFor="threshold-range">
              Rebalance threshold: {fmt.pct(threshold)}
            </label>
            <input
              id="threshold-range"
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#94a3b8',
              }}
            >
              <span>1% (active)</span>
              <span>20% (lazy)</span>
            </div>
          </div>

          {/* Account Balances */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Account Balances</div>
            {ACCOUNT_TYPES.map(acct => (
              <div key={acct} style={{ marginBottom: 10 }}>
                <label style={S.label} htmlFor={`acct-${acct}`}>
                  {acct}
                </label>
                <input
                  id={`acct-${acct}`}
                  type="number"
                  min={0}
                  style={S.input}
                  value={accounts[acct] ?? ''}
                  onChange={e => updateAccount(acct, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Run button */}
          <button
            style={{ ...S.btn, ...(analysisState === 'loading' ? S.btnDisabled : {}) }}
            onClick={runAnalysis}
            disabled={analysisState === 'loading'}
          >
            {analysisState === 'loading' ? '⏳ Fetching data…' : '▶ Run Analysis'}
          </button>

          {analysisState === 'done' && (
            <div style={{ fontSize: 11, color: '#16a34a', textAlign: 'center', marginTop: 8 }}>
              ✓ Analysis complete
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              padding: '10px 12px',
              background: '#0a0f1e',
              borderRadius: 8,
              fontSize: 11,
              color: '#94a3b8',
              lineHeight: 1.6,
            }}
          >
            ⚠ Uses Yahoo Finance unofficial API. Data is for planning only — not financial advice.
            Verify trades before executing.
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={S.main}>
          <div style={S.tabs}>
            {[
              { id: 'holdings', label: 'Current Holdings' },
              { id: 'analysis', label: 'Risk Parity Targets' },
              { id: 'trades', label: `Trades${trades.length > 0 ? ` (${trades.length})` : ''}` },
            ].map(t => (
              <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── HOLDINGS TAB ── */}
          {tab === 'holdings' && (
            <ErrorBoundary>
              <div>
                <div style={S.warning}>
                  Enter your <strong>current share counts</strong> per account. These are compared
                  against risk parity targets to generate trades. Leave at 0 if you don't hold a
                  position.
                </div>

                {ACCOUNT_TYPES.map(acct => (
                  <div key={acct} style={S.card}>
                    <div style={{ ...S.cardTitle, marginBottom: 6 }}>{acct}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                      Balance: {fmt.usd(accounts[acct] ?? 0)}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {tickers.map(ticker => (
                        <div key={ticker}>
                          <label style={S.label} htmlFor={`holding-${acct}-${ticker}`}>
                            {ticker} shares
                          </label>
                          <input
                            id={`holding-${acct}-${ticker}`}
                            type="number"
                            min={0}
                            step={0.0001}
                            style={S.input}
                            value={currentHoldings[acct]?.[ticker] ?? ''}
                            placeholder="0"
                            onChange={e => updateHolding(acct, ticker, e.target.value)}
                          />
                          {prices[ticker] && (currentHoldings[acct]?.[ticker] ?? 0) > 0 && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                              ≈ {fmt.usd(currentHoldings[acct][ticker] * prices[ticker])}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {currentTotalFromPrices > 0 && (
                  <div style={S.card}>
                    <div style={S.cardTitle}>Holdings Value (from last analysis prices)</div>
                    <div style={S.grid2}>
                      {Object.entries(currentValueByTicker).map(([t, v]) => (
                        <div
                          key={t}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            borderBottom: '1px solid #0f172a',
                          }}
                        >
                          <span style={{ color: '#94a3b8' }}>{t}</span>
                          <span>{fmt.usd(v)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>
                      Total tracked:{' '}
                      <strong style={{ color: '#e2e8f0' }}>
                        {fmt.usd(currentTotalFromPrices)}
                      </strong>{' '}
                      vs account total:{' '}
                      <strong style={{ color: '#e2e8f0' }}>{fmt.usd(totalValue)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* ── ANALYSIS TAB ── */}
          {tab === 'analysis' && (
            <ErrorBoundary>
              <div>
                {analysisState === 'idle' && (
                  <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60 }}>
                    Enter your holdings and click{' '}
                    <strong style={{ color: '#94a3b8' }}>Run Analysis</strong> to see risk parity
                    targets.
                  </div>
                )}

                {analysisState === 'error' && (
                  <div style={S.error}>
                    <strong>Error fetching market data:</strong> {errorMsg}
                    <div style={{ marginTop: 6, color: '#f87171' }}>
                      The Yahoo Finance unofficial API may be rate-limiting or blocking requests.
                      Try again in a minute, or check your ticker symbols.
                    </div>
                  </div>
                )}

                {analysisState === 'done' && (
                  <>
                    {/* Summary metrics */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 12,
                        marginBottom: 18,
                      }}
                    >
                      {[
                        { label: 'Assets', val: tickers.length },
                        { label: 'Total Value', val: fmt.usd(totalValue) },
                        { label: 'Rebalance Band', val: fmt.pct(threshold) },
                        { label: 'Trades Needed', val: trades.length },
                      ].map(m => (
                        <div key={m.label} style={S.card}>
                          <div style={S.metricVal}>{m.val}</div>
                          <div style={S.metricLbl}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Weight comparison chart */}
                    <div style={S.card}>
                      <div style={S.cardTitle}>Current vs Target Weights</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                        <span
                          style={{
                            background: '#16a34a',
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            marginRight: 4,
                          }}
                        />
                        under target
                        <span
                          style={{
                            background: '#dc2626',
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            margin: '0 4px 0 12px',
                          }}
                        />
                        over target
                        <span
                          style={{
                            border: '1px dashed #3b82f6',
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            margin: '0 4px 0 12px',
                          }}
                        />
                        target
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tickers.map(t => {
                          const curW =
                            totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
                          const tgtW = targetWeights[t] ?? 0;
                          return <WeightBar key={t} ticker={t} current={curW} target={tgtW} />;
                        })}
                      </div>
                    </div>

                    {/* Risk parity table */}
                    <div style={S.card}>
                      <div style={S.cardTitle}>Risk Parity Weights (Inverse Volatility)</div>
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              {[
                                'Ticker',
                                'Ann. Vol',
                                'Target Weight',
                                'Target $',
                                'Current $',
                                'Drift',
                              ].map(h => (
                                <th key={h} style={S.th}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tickers.map(t => {
                              const tgtW = targetWeights[t] ?? 0;
                              const curW =
                                totalValue > 0 ? (currentValueByTicker[t] ?? 0) / totalValue : 0;
                              const drift = curW - tgtW;
                              return (
                                <tr key={t}>
                                  <td
                                    style={{
                                      ...S.td,
                                      fontWeight: 600,
                                      color: '#e2e8f0',
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {t}
                                  </td>
                                  <td style={S.td}>{fmt.vol(vols[t] ?? 0)}</td>
                                  <td style={S.td}>{fmt.pct(tgtW)}</td>
                                  <td style={S.td}>{fmt.usd(tgtW * totalValue)}</td>
                                  <td style={S.td}>{fmt.usd(currentValueByTicker[t] ?? 0)}</td>
                                  <td
                                    style={{
                                      ...S.td,
                                      color: Math.abs(drift) > threshold ? '#f87171' : '#94a3b8',
                                    }}
                                  >
                                    {drift >= 0 ? '+' : ''}
                                    {fmt.pct(drift)}
                                    {Math.abs(drift) > threshold && ' ⚠'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tax location */}
                    <div style={S.card}>
                      <div style={S.cardTitle}>Tax-Efficient Location (Target)</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                        Tax-inefficient assets (bonds, commodities, REITs) are placed in
                        tax-advantaged accounts first. Scores are heuristics — verify with a tax
                        advisor.
                      </div>
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.th}>Ticker</th>
                              <th style={S.th}>Tax Score</th>
                              {ACCOUNT_TYPES.map(a => (
                                <th key={a} style={S.th}>
                                  {a}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tickers.map(t => (
                              <tr key={t}>
                                <td
                                  style={{
                                    ...S.td,
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    color: '#e2e8f0',
                                  }}
                                >
                                  {t}
                                </td>
                                <td style={S.td}>
                                  <span
                                    style={S.pill(
                                      (TAX_INEFFICIENCY[t] ?? 5) >= 8
                                        ? 'sell'
                                        : (TAX_INEFFICIENCY[t] ?? 5) >= 5
                                          ? null
                                          : 'buy'
                                    )}
                                  >
                                    {TAX_INEFFICIENCY[t] ?? '5 (est.)'}
                                  </span>
                                </td>
                                {ACCOUNT_TYPES.map(a => (
                                  <td key={a} style={S.td}>
                                    {targetAllocation[a]?.[t] > 0 ? (
                                      fmt.usd(targetAllocation[a][t])
                                    ) : (
                                      <span style={{ color: '#1e293b' }}>—</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Prices */}
                    <div style={S.card}>
                      <div style={S.cardTitle}>Last Prices (Yahoo Finance)</div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {tickers.map(t => (
                          <div key={t} style={{ minWidth: 80 }}>
                            <div
                              style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}
                            >
                              {t}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
                              {prices[t] ? `$${prices[t].toFixed(2)}` : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* ── TRADES TAB ── */}
          {tab === 'trades' && (
            <ErrorBoundary>
              <div>
                {analysisState !== 'done' && (
                  <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60 }}>
                    Run Analysis first to generate trades.
                  </div>
                )}

                {analysisState === 'done' && trades.length === 0 && (
                  <div style={{ ...S.card, textAlign: 'center', padding: '32px 20px' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>
                      All positions are within the{' '}
                      <strong style={{ color: '#94a3b8' }}>{fmt.pct(threshold)}</strong> rebalance
                      band. No trades needed.
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
                      Shannon's Demon: Only rebalance when drift captures a meaningful volatility
                      premium above transaction costs.
                    </div>
                  </div>
                )}

                {analysisState === 'done' && trades.length > 0 && (
                  <>
                    <div style={S.warning}>
                      These trades move your portfolio toward risk parity targets within
                      tax-efficient accounts.{' '}
                      <strong>Verify share counts and prices before executing.</strong> Consider tax
                      impact of sells in taxable accounts.
                    </div>

                    <div style={S.card}>
                      <div style={S.cardTitle}>Rebalancing Trades</div>
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              {[
                                'Action',
                                'Ticker',
                                'Account',
                                'Shares',
                                'Amount',
                                'Current %',
                                'Target %',
                                'Drift',
                              ].map(h => (
                                <th key={h} style={S.th}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {trades.map((tr, i) => (
                              <tr key={i}>
                                <td style={S.td}>
                                  <span style={S.pill(tr.action.toLowerCase())}>{tr.action}</span>
                                </td>
                                <td
                                  style={{
                                    ...S.td,
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    color: '#e2e8f0',
                                  }}
                                >
                                  {tr.ticker}
                                </td>
                                <td style={{ ...S.td, color: '#94a3b8' }}>{tr.account}</td>
                                <td style={S.td}>{fmt.shares(tr.shares)}</td>
                                <td style={S.td}>{fmt.usd(tr.dollarAmount)}</td>
                                <td style={S.td}>{fmt.pct(tr.currentWeight)}</td>
                                <td style={{ ...S.td, color: '#3b82f6' }}>
                                  {fmt.pct(tr.targetWeight)}
                                </td>
                                <td style={{ ...S.td, color: '#f87171' }}>{fmt.pct(tr.drift)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Per-account summary */}
                    <div style={S.grid2}>
                      {ACCOUNT_TYPES.map(acct => {
                        const acctTrades = trades.filter(t => t.account === acct);
                        if (acctTrades.length === 0) return null;
                        return (
                          <div key={acct} style={S.card}>
                            <div style={S.cardTitle}>{acct}</div>
                            {acctTrades.map((tr, i) => (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '5px 0',
                                  borderBottom: '1px solid #0f172a',
                                  fontSize: 13,
                                }}
                              >
                                <span>
                                  <span style={S.pill(tr.action.toLowerCase())}>{tr.action}</span>{' '}
                                  <span style={{ fontFamily: 'monospace' }}>{tr.ticker}</span>
                                </span>
                                <span style={{ color: '#94a3b8' }}>
                                  {fmt.shares(tr.shares)} sh · {fmt.usd(tr.dollarAmount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
