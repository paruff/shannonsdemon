import ErrorBoundary from './components/ErrorBoundary';
import Tooltip from './components/Tooltip';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = e => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const lookbackRef = useRef(null);
  const [tickerStatus, setTickerStatus] = useState({}); // { SPY: 'ok'|'error'|'pending' }
  const [scenarioName, setScenarioName] = useState('');
  const [scenarios, setScenarios] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('shannonsdemon_scenarios_v1') || '[]');
    } catch {
      return [];
    }
  });

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
  const canRun = tickers.length > 0 && totalValue > 0;

  // ── Debounced ticker validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      const checks = tickers.map(async t => {
        setTickerStatus(s => ({ ...s, [t]: 'pending' }));
        try {
          await fetchQuote(t, lookback);
          setTickerStatus(s => ({ ...s, [t]: 'ok' }));
        } catch {
          setTickerStatus(s => ({ ...s, [t]: 'error' }));
        }
      });
      await Promise.all(checks);
    }, 500);
    return () => clearTimeout(timer);
  }, [tickers, lookback]);

  // ── Trade preview without re-running analysis
  const estimatedTrades = useMemo(
    () => generateTrades(currentHoldings, targetAllocation, prices, totalValue, threshold),
    [currentHoldings, targetAllocation, prices, totalValue, threshold]
  );

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

  const handlePaste = e => {
    const rows = e.clipboardData
      .getData('text')
      .trim()
      .split('\n')
      .map(r => r.split(/[,\t]/));
    rows.forEach(([acct, ticker, shares]) => {
      if (
        acct &&
        ticker &&
        ACCOUNT_TYPES.includes(acct.trim()) &&
        tickers.includes(ticker.trim().toUpperCase())
      ) {
        updateHolding(acct.trim(), ticker.trim().toUpperCase(), parseFloat(shares) || 0);
      }
    });
  };

  const exportTradesCSV = () => {
    const headers = ['Action', 'Ticker', 'Account', 'Shares', 'Amount', 'Drift'];
    const rows = trades.map(t => [
      t.action,
      t.ticker,
      t.account,
      t.shares,
      t.dollarAmount,
      t.drift,
    ]);
    navigator.clipboard.writeText([headers, ...rows].map(r => r.join(',')).join('\n'));
  };

  const exportState = () => {
    const state = {
      tickers,
      lookback,
      threshold,
      accounts,
      currentHoldings,
      prices,
      vols,
      targetWeights,
      targetAllocation,
      trades,
    };
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
  };

  const persistScenarios = ns => {
    setScenarios(ns);
    localStorage.setItem('shannonsdemon_scenarios_v1', JSON.stringify(ns));
  };

  const saveScenario = name => {
    persistScenarios([
      ...scenarios,
      {
        name,
        timestamp: Date.now(),
        tickers,
        lookback,
        threshold,
        accounts,
        currentHoldings,
      },
    ]);
    setScenarioName('');
  };

  const loadScenario = s => {
    setTickers(s.tickers);
    setTickerInput(s.tickers.join(', '));
    if (s.lookback) setLookback(s.lookback);
    if (s.threshold) setThreshold(s.threshold);
    if (s.accounts) setAccounts(s.accounts);
    if (s.currentHoldings) setCurrentHoldings(s.currentHoldings);
  };

  const deleteScenario = ts => {
    persistScenarios(scenarios.filter(s => s.timestamp !== ts));
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
      <style>{`
        .sd-table th:first-child, .sd-table td:first-child { position: sticky; left: 0; background: #0d1424; z-index: 1; }
        @media (max-width: 767px) {
          .sd-sidebar { position: fixed; top: 62px; bottom: 0; left: 0; z-index: 40; width: 260px; transform: translateX(-100%); transition: transform .2s ease; box-shadow: 0 0 20px rgba(0,0,0,.4); }
          .sd-sidebar.open { transform: translateX(0); }
          .sd-backdrop { position: fixed; inset: 62px 0 0 0; background: rgba(0,0,0,.5); z-index: 39; }
        }
        @media (min-width: 768px) { .sd-backdrop { display: none; } }
      `}</style>
      {/* HEADER */}
      <header style={S.header}>
        {isMobile && (
          <button
            aria-label="Toggle sidebar"
            onClick={() => setMobileOpen(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ☰
          </button>
        )}
        <div style={S.logo}>⚖</div>
        <div>
          <h1 style={S.title}>
            <Tooltip tip="Shannon's Demon: rebalance to harvest volatility variance, not chase returns">
              Shannon's Demon
            </Tooltip>
          </h1>
          <div style={S.subtitle}>Risk parity rebalancer · tax-efficient · retirement</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
          Total: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{fmt.usd(totalValue)}</span>
        </div>
      </header>

      <div style={S.body}>
        {isMobile && mobileOpen && (
          <div className="sd-backdrop" onClick={() => setMobileOpen(false)} />
        )}
        {/* SIDEBAR */}
        <aside className={`sd-sidebar${mobileOpen ? ' open' : ''}`} style={S.sidebar}>
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
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  applyTickerInput();
                  lookbackRef.current?.focus();
                }
              }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              {tickers.map(t => {
                const st = tickerStatus[t];
                const badge =
                  st === 'ok'
                    ? { c: '#16a34a', s: '✓' }
                    : st === 'error'
                      ? { c: '#f87171', s: '✗' }
                      : st === 'pending'
                        ? { c: '#94a3b8', s: '⏳' }
                        : null;
                return (
                  <span key={t} style={{ marginRight: 10 }}>
                    <span style={{ color: badge?.c ?? '#94a3b8' }}>{badge?.s ?? '·'}</span> {t}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Advanced (collapsible) */}
          <div style={S.section}>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
                fontWeight: 600,
              }}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? '▼' : '▶'} Advanced
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 12 }}>
                <div style={S.sectionTitle}>Parameters</div>
                <label style={S.label} htmlFor="lookback-select">
                  Volatility lookback
                </label>
                <select
                  ref={lookbackRef}
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
                  <Tooltip tip="Only trade when drift exceeds this % — captures volatility premium above costs">
                    Rebalance threshold
                  </Tooltip>
                  : {fmt.pct(threshold)}
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
                {Object.keys(prices).length > 0 && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    {estimatedTrades.length > 0
                      ? `~${estimatedTrades.length} trades if run now`
                      : 'No trades needed at current drift'}
                  </div>
                )}
              </div>
            )}
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
            style={{
              ...S.btn,
              ...(analysisState === 'loading' || !canRun ? S.btnDisabled : {}),
            }}
            onClick={runAnalysis}
            disabled={analysisState === 'loading' || !canRun}
          >
            {analysisState === 'loading' ? '⏳ Fetching data…' : '▶ Run Analysis'}
          </button>

          {analysisState === 'done' && (
            <div style={{ fontSize: 11, color: '#16a34a', textAlign: 'center', marginTop: 8 }}>
              ✓ Analysis complete
            </div>
          )}

          {/* Scenarios */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Scenarios</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="Name…"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                aria-label="Scenario name"
              />
              <button
                style={{ ...S.btn, padding: '6px 10px' }}
                onClick={() => saveScenario(scenarioName)}
                disabled={!scenarioName.trim()}
              >
                Save
              </button>
            </div>
            {scenarios.length === 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Save a snapshot of inputs to compare later.
              </div>
            )}
            {scenarios.map(s => (
              <div
                key={s.timestamp}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  padding: '4px 0',
                  borderBottom: '1px solid #0f172a',
                }}
              >
                <span style={{ color: '#cbd5e1' }}>
                  {s.name}
                  <span style={{ color: '#64748b', fontSize: 10 }}>
                    {' '}
                    · {new Date(s.timestamp).toLocaleDateString()}
                  </span>
                </span>
                <span>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onClick={() => loadScenario(s)}
                  >
                    Load
                  </button>{' '}
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onClick={() => deleteScenario(s.timestamp)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>

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

                <div style={S.card}>
                  <div style={{ ...S.cardTitle, marginBottom: 6 }}>Bulk paste</div>
                  <textarea
                    placeholder="Paste CSV: Account, Ticker, Shares — e.g. Taxable,SPY,100"
                    style={{ ...S.input, height: 52, fontFamily: 'monospace', fontSize: 11 }}
                    onPaste={handlePaste}
                  />
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
                          <div style={S.metricLbl}>
                            {m.label === 'Rebalance Band' ? (
                              <Tooltip tip="Only trade when drift exceeds this % — captures volatility premium above costs">
                                {m.label}
                              </Tooltip>
                            ) : (
                              m.label
                            )}
                          </div>
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
                      <div style={S.cardTitle}>
                        <Tooltip tip="Inverse volatility: lower vol assets get higher weight so each contributes equal risk">
                          Risk Parity Weights (Inverse Volatility)
                        </Tooltip>
                      </div>
                      <div style={S.tableWrap}>
                        <table className="sd-table" style={S.table}>
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
                      <div style={S.cardTitle}>
                        <Tooltip tip="Bonds/REITs/commodities go in IRAs first to shelter ordinary income">
                          Tax-Efficient Location (Target)
                        </Tooltip>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                        Tax-inefficient assets (bonds, commodities, REITs) are placed in
                        tax-advantaged accounts first. Scores are heuristics — verify with a tax
                        advisor.
                      </div>
                      <div style={S.tableWrap}>
                        <table className="sd-table" style={S.table}>
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

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button style={S.btn} onClick={exportTradesCSV}>
                        📋 Copy Trades as CSV
                      </button>
                      <button style={S.btn} onClick={exportState}>
                        📦 Copy Full State JSON
                      </button>
                    </div>

                    <div style={S.card}>
                      <div style={S.cardTitle}>Rebalancing Trades</div>
                      <div style={S.tableWrap}>
                        <table className="sd-table" style={S.table}>
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
