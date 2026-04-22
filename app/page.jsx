'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Loader2, Search, ChevronDown, ChevronUp, RotateCcw, ArrowRight, Sparkles } from 'lucide-react';

const THEME = {
  bg: '#F5EFE3',
  paper: '#FAF6EC',
  ink: '#1A1613',
  inkSoft: '#4A4238',
  inkFaint: '#8A8075',
  rule: '#D9CFBD',
  accent: '#C8432E',
  accentSoft: '#E8DAD0',
  green: '#2C5F2D',
  greenSoft: '#D7E4D0',
  amber: '#A3700E',
  amberSoft: '#F0E3C8',
  red: '#8B2818',
  redSoft: '#EDD4CE',
};

const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

  .font-display { font-family: 'Fraunces', serif; font-variation-settings: 'opsz' 90; }
  .font-body { font-family: 'DM Sans', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }

  .grain {
    background-image:
      radial-gradient(circle at 1px 1px, rgba(26,22,19,0.035) 1px, transparent 0);
    background-size: 24px 24px;
  }

  .tabular { font-variant-numeric: tabular-nums; }

  .rule {
    height: 1px;
    background: linear-gradient(to right, transparent, ${THEME.rule}, transparent);
  }

  .btn-primary {
    background: ${THEME.ink};
    color: ${THEME.paper};
    transition: all 160ms ease;
  }
  .btn-primary:hover:not(:disabled) { background: ${THEME.accent}; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: ${THEME.ink};
    border: 1px solid ${THEME.rule};
    transition: all 160ms ease;
  }
  .btn-ghost:hover { background: ${THEME.accentSoft}; border-color: ${THEME.accent}; }

  .input-field {
    background: ${THEME.paper};
    border: 1px solid ${THEME.rule};
    transition: border-color 160ms;
  }
  .input-field:focus { outline: none; border-color: ${THEME.accent}; }

  .fade-in { animation: fadeIn 400ms ease-out; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .pulse-subtle { animation: pulseSubtle 2s ease-in-out infinite; }
  @keyframes pulseSubtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

const toISODate = (d) => d.toISOString().slice(0, 10);
const fmtDate = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDateLong = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const businessDaysBetween = (start, end) => {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur < e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const subtractBusinessDays = (date, days) => {
  const result = new Date(date);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) subtracted++;
  }
  return result;
};

const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const defaultNextBillDate = () => {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return toISODate(next);
};

export default function CashCycleTool() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [cashAmount, setCashAmount] = useState('');
  const [nextBillDate, setNextBillDate] = useState(defaultNextBillDate());
  const [safetyBuffer, setSafetyBuffer] = useState(15000);
  const [alloc, setAlloc] = useState({ tier1: 60, tier2: 30, tier3: 10 });
  const [tickers, setTickers] = useState(['', '', '']);
  const [analyses, setAnalyses] = useState([null, null, null]);
  const [analyzing, setAnalyzing] = useState([false, false, false]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    try {
      const buf = localStorage.getItem('settings:safetyBuffer');
      if (buf) setSafetyBuffer(Number(buf));
    } catch (_) {}
    try {
      const hist = localStorage.getItem('history:cycles');
      if (hist) setHistory(JSON.parse(hist));
    } catch (_) {}
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem('settings:safetyBuffer', String(safetyBuffer));
    } catch (_) {}
  }, [safetyBuffer, settingsLoaded]);

  const billDateObj = useMemo(() => new Date(nextBillDate + 'T00:00:00'), [nextBillDate]);
  const sellByDate = useMemo(() => subtractBusinessDays(billDateObj, 3), [billDateObj]);
  const holdBusinessDays = useMemo(() => businessDaysBetween(today, sellByDate), [today, sellByDate]);

  const cycleType = useMemo(() => {
    if (holdBusinessDays < 7) return 'short';
    if (holdBusinessDays < 14) return 'medium';
    return 'full';
  }, [holdBusinessDays]);

  useEffect(() => {
    if (cycleType === 'short') setAlloc({ tier1: 100, tier2: 0, tier3: 0 });
    else if (cycleType === 'medium') setAlloc({ tier1: 70, tier2: 30, tier3: 0 });
    else setAlloc((a) => (a.tier1 + a.tier2 + a.tier3 !== 100 ? { tier1: 60, tier2: 30, tier3: 10 } : a));
  }, [cycleType]);

  const cashNum = Number(cashAmount) || 0;
  const tier1Dollars = Math.round((cashNum * alloc.tier1) / 100);
  const tier2Dollars = Math.round((cashNum * alloc.tier2) / 100);
  const tier3Dollars = cashNum - tier1Dollars - tier2Dollars;

  const analyzeTicker = async (idx) => {
    const ticker = tickers[idx].trim().toUpperCase();
    if (!ticker) return;

    setAnalyzing((prev) => prev.map((v, i) => (i === idx ? true : v)));

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          today: toISODate(today),
          sellByDate: toISODate(sellByDate),
          holdBusinessDays,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);

      setAnalyses((prev) => prev.map((v, i) => (i === idx ? data : v)));
    } catch (err) {
      setAnalyses((prev) =>
        prev.map((v, i) => (i === idx ? { error: err.message || 'Analysis failed', ticker } : v))
      );
    }

    setAnalyzing((prev) => prev.map((v, i) => (i === idx ? false : v)));
  };

  const logCycle = () => {
    const entry = {
      id: Date.now(),
      buyDate: toISODate(today),
      sellByDate: toISODate(sellByDate),
      cashDeployed: cashNum,
      allocation: { ...alloc },
      dollars: { tier1: tier1Dollars, tier2: tier2Dollars, tier3: tier3Dollars },
      pick: analyses.find((a) => a?.recommendation === 'BUY')?.ticker || null,
      cycleType,
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    try {
      localStorage.setItem('history:cycles', JSON.stringify(updated));
    } catch (_) {}
  };

  const clearHistory = () => {
    if (!confirm('Clear all cycle history?')) return;
    setHistory([]);
    try {
      localStorage.removeItem('history:cycles');
    } catch (_) {}
  };

  const resetAnalyses = () => {
    setTickers(['', '', '']);
    setAnalyses([null, null, null]);
  };

  const validAnalyses = analyses.filter((a) => a && !a.error);
  const bestPick = validAnalyses.length > 0
    ? validAnalyses.reduce((best, curr) => (curr.passedCount > (best?.passedCount || -1) ? curr : best), null)
    : null;

  return (
    <div className="min-h-screen font-body grain" style={{ background: THEME.bg, color: THEME.ink }}>
      <style>{FONT_STYLES}</style>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <header className="mb-10">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest" style={{ color: THEME.inkFaint }}>
                Garden Prayer · Personal Treasury
              </div>
              <h1 className="font-display text-5xl font-semibold leading-none mt-2" style={{ color: THEME.ink }}>
                Cash Cycle
              </h1>
              <div className="font-display italic text-lg mt-1" style={{ color: THEME.inkSoft }}>
                Biweekly deployment desk
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs uppercase tracking-widest" style={{ color: THEME.inkFaint }}>Today</div>
              <div className="font-display text-xl mt-1">{fmtDate(today)}</div>
            </div>
          </div>
        </header>

        <Section number="01" title="Situation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Cash to deploy">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono" style={{ color: THEME.inkFaint }}>$</span>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className="input-field w-full pl-8 pr-4 py-3 rounded font-mono tabular text-lg"
                />
              </div>
            </Field>
            <Field label="Next bill date">
              <input
                type="date"
                value={nextBillDate}
                onChange={(e) => setNextBillDate(e.target.value)}
                className="input-field w-full px-4 py-3 rounded font-mono text-lg"
              />
            </Field>
            <Field label="Safety buffer (never deployed)" hint="Remembered across sessions">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono" style={{ color: THEME.inkFaint }}>$</span>
                <input
                  type="number"
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(Number(e.target.value) || 0)}
                  className="input-field w-full pl-8 pr-4 py-3 rounded font-mono tabular text-lg"
                />
              </div>
            </Field>
            <Field label="Preferred ETF (Tier 2)">
              <div className="input-field w-full px-4 py-3 rounded font-mono text-lg flex items-center justify-between" style={{ color: THEME.inkSoft }}>
                <span>VOO</span>
                <span className="text-xs" style={{ color: THEME.inkFaint }}>Vanguard S&amp;P 500</span>
              </div>
            </Field>
          </div>

          {cashNum > 0 && (
            <div className="mt-6 pt-6 fade-in" style={{ borderTop: `1px dashed ${THEME.rule}` }}>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Business days to sell" value={holdBusinessDays} />
                <Stat label="Target sell by" value={fmtDate(sellByDate)} small />
                <CycleBadge cycleType={cycleType} />
              </div>
              <div className="mt-4 text-sm font-body" style={{ color: THEME.inkSoft }}>
                {cycleType === 'short' && (
                  <>Hold window is too short for equity risk. Deploy to MMF only — you&apos;ll still earn short-term yield.</>
                )}
                {cycleType === 'medium' && (
                  <>Medium window — MMF plus a broad ETF position. Single-stock risk isn&apos;t worth it for this hold length.</>
                )}
                {cycleType === 'full' && (
                  <>Full window. All three tiers available, including an optional individual pick.</>
                )}
              </div>
            </div>
          )}
        </Section>

        {cashNum > 0 && (
          <Section number="02" title="Allocation">
            <div className="space-y-0">
              <TierRow
                label="Tier 1"
                subtitle="Money Market Fund"
                pct={alloc.tier1}
                dollars={tier1Dollars}
                color={THEME.green}
                risk="Near-zero principal risk"
              />
              {alloc.tier2 > 0 && (
                <TierRow
                  label="Tier 2"
                  subtitle="VOO · Broad ETF"
                  pct={alloc.tier2}
                  dollars={tier2Dollars}
                  color={THEME.accent}
                  risk="Market beta exposure"
                />
              )}
              {alloc.tier3 > 0 && (
                <TierRow
                  label="Tier 3"
                  subtitle="Individual pick"
                  pct={alloc.tier3}
                  dollars={tier3Dollars}
                  color={THEME.amber}
                  risk="Single-name concentrated risk"
                />
              )}
            </div>

            {cycleType === 'full' && (
              <div className="mt-5 flex items-center gap-3 text-xs font-mono uppercase tracking-wider" style={{ color: THEME.inkFaint }}>
                <span>Adjust:</span>
                <SplitButton active={alloc.tier1 === 80} onClick={() => setAlloc({ tier1: 80, tier2: 20, tier3: 0 })}>Conservative</SplitButton>
                <SplitButton active={alloc.tier1 === 60 && alloc.tier3 === 10} onClick={() => setAlloc({ tier1: 60, tier2: 30, tier3: 10 })}>Balanced</SplitButton>
                <SplitButton active={alloc.tier1 === 40 && alloc.tier3 === 20} onClick={() => setAlloc({ tier1: 40, tier2: 40, tier3: 20 })}>Aggressive</SplitButton>
              </div>
            )}
          </Section>
        )}

        {cashNum > 0 && alloc.tier3 > 0 && (
          <Section
            number="03"
            title="Candidate Analysis"
            action={
              analyses.some((a) => a) && (
                <button onClick={resetAnalyses} className="text-xs font-mono uppercase tracking-wider flex items-center gap-1" style={{ color: THEME.inkFaint }}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )
            }
          >
            <div className="text-sm mb-5" style={{ color: THEME.inkSoft }}>
              Enter up to three candidate tickers. Claude will screen each against market cap, beta, earnings window, 52-week position, and recent news.
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="flex gap-3">
                  <input
                    type="text"
                    value={tickers[idx]}
                    onChange={(e) => setTickers((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                    placeholder={`Candidate ${idx + 1}`}
                    className="input-field flex-1 px-4 py-3 rounded font-mono uppercase tabular"
                    maxLength={6}
                  />
                  <button
                    onClick={() => analyzeTicker(idx)}
                    disabled={!tickers[idx].trim() || analyzing[idx]}
                    className="btn-primary px-5 py-3 rounded font-mono text-xs uppercase tracking-wider flex items-center gap-2"
                  >
                    {analyzing[idx] ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing</>
                    ) : (
                      <><Search className="w-4 h-4" /> Analyze</>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {analyses.map((a, idx) =>
                a ? <AnalysisCard key={idx} analysis={a} isBest={bestPick && a.ticker === bestPick.ticker && validAnalyses.length > 1} /> : null
              )}
            </div>

            {bestPick && validAnalyses.length > 1 && (
              <div className="mt-5 fade-in p-4 rounded font-body text-sm flex items-start gap-3" style={{ background: THEME.accentSoft, border: `1px solid ${THEME.accent}` }}>
                <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: THEME.accent }} />
                <div>
                  <span className="font-mono uppercase text-xs tracking-wider" style={{ color: THEME.accent }}>Best of analyzed</span>
                  <div className="mt-1"><span className="font-mono font-semibold">{bestPick.ticker}</span> passed {bestPick.passedCount}/5 criteria. Not a guarantee — just the strongest pass rate among the three.</div>
                </div>
              </div>
            )}
          </Section>
        )}

        {cashNum > 0 && (
          <Section number="04" title="Execution">
            <div className="space-y-2 font-mono text-sm">
              <ExecLine action="BUY" detail={`${fmtMoney(tier1Dollars)} — Money Market Fund (E*Trade sweep or Treasury MMF)`} />
              {tier2Dollars > 0 && <ExecLine action="BUY" detail={`${fmtMoney(tier2Dollars)} — VOO`} />}
              {tier3Dollars > 0 && bestPick && bestPick.recommendation === 'BUY' && (
                <ExecLine action="BUY" detail={`${fmtMoney(tier3Dollars)} — ${bestPick.ticker}`} />
              )}
              {tier3Dollars > 0 && (!bestPick || bestPick.recommendation !== 'BUY') && (
                <ExecLine action="HOLD" detail={`${fmtMoney(tier3Dollars)} — No candidate passed; route to MMF`} muted />
              )}
              <div className="rule my-3" />
              <ExecLine action="SELL BY" detail={fmtDateLong(sellByDate)} highlight />
              <ExecLine action="CASH IN BANK BY" detail={fmtDateLong(subtractBusinessDays(billDateObj, 1))} highlight />
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={logCycle} className="btn-primary px-5 py-3 rounded font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                <ArrowRight className="w-4 h-4" /> Log this cycle
              </button>
            </div>
          </Section>
        )}

        {history.length > 0 && (
          <div className="mt-12">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between py-3 font-mono uppercase tracking-widest text-xs"
              style={{ color: THEME.inkFaint, borderTop: `1px solid ${THEME.rule}`, borderBottom: `1px solid ${THEME.rule}` }}
            >
              <span>History · {history.length} cycle{history.length !== 1 ? 's' : ''}</span>
              {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {historyOpen && (
              <div className="py-4 fade-in">
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="p-4 rounded font-mono text-xs tabular flex items-center justify-between" style={{ background: THEME.paper, border: `1px solid ${THEME.rule}` }}>
                      <div>
                        <div style={{ color: THEME.ink }}>{h.buyDate} → {h.sellByDate}</div>
                        <div className="mt-1" style={{ color: THEME.inkFaint }}>
                          {fmtMoney(h.cashDeployed)} · {h.allocation.tier1}/{h.allocation.tier2}/{h.allocation.tier3}
                          {h.pick && <> · pick: {h.pick}</>}
                        </div>
                      </div>
                      <div className="uppercase tracking-wider" style={{ color: THEME.inkFaint }}>{h.cycleType}</div>
                    </div>
                  ))}
                </div>
                <button onClick={clearHistory} className="mt-4 text-xs font-mono uppercase tracking-wider" style={{ color: THEME.red }}>
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-16 text-xs font-body italic text-center" style={{ color: THEME.inkFaint }}>
          Not financial advice. The tool screens — you decide. Stock analyses use live web search and may be incomplete or inaccurate.
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, children, action }) {
  return (
    <section className="mb-10 fade-in">
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-widest" style={{ color: THEME.inkFaint }}>{number}</span>
          <h2 className="font-display text-2xl font-semibold" style={{ color: THEME.ink }}>{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6 rounded-lg" style={{ background: THEME.paper, border: `1px solid ${THEME.rule}` }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block font-mono text-xs uppercase tracking-wider mb-2" style={{ color: THEME.inkFaint }}>
        {label}
      </label>
      {children}
      {hint && <div className="mt-1.5 text-xs italic" style={{ color: THEME.inkFaint }}>{hint}</div>}
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wider" style={{ color: THEME.inkFaint }}>{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-display font-semibold mt-1 tabular`}>{value}</div>
    </div>
  );
}

function CycleBadge({ cycleType }) {
  const config = {
    short: { label: 'Short cycle', color: THEME.amber, bg: THEME.amberSoft },
    medium: { label: 'Medium cycle', color: THEME.accent, bg: THEME.accentSoft },
    full: { label: 'Full cycle', color: THEME.green, bg: THEME.greenSoft },
  }[cycleType];
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-wider" style={{ color: THEME.inkFaint }}>Type</div>
      <div className="mt-1">
        <span className="inline-block px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider" style={{ background: config.bg, color: config.color }}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

function TierRow({ label, subtitle, pct, dollars, color, risk }) {
  return (
    <div className="py-4 flex items-center gap-5" style={{ borderBottom: `1px solid ${THEME.rule}` }}>
      <div className="flex-shrink-0" style={{ width: 90 }}>
        <div className="font-mono text-xs uppercase tracking-wider" style={{ color }}>{label}</div>
        <div className="text-sm font-body mt-1" style={{ color: THEME.inkSoft }}>{subtitle}</div>
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: THEME.rule }}>
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="mt-1.5 text-xs" style={{ color: THEME.inkFaint }}>{risk}</div>
      </div>
      <div className="text-right flex-shrink-0" style={{ width: 140 }}>
        <div className="font-display text-2xl font-semibold tabular" style={{ color: THEME.ink }}>{fmtMoney(dollars)}</div>
        <div className="font-mono text-xs" style={{ color: THEME.inkFaint }}>{pct}%</div>
      </div>
    </div>
  );
}

function SplitButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs tracking-wider transition-all"
      style={{
        background: active ? THEME.ink : 'transparent',
        color: active ? THEME.paper : THEME.inkSoft,
        border: `1px solid ${active ? THEME.ink : THEME.rule}`,
      }}
    >
      {children}
    </button>
  );
}

function Check({ pass, label, value }) {
  const Icon = pass ? CheckCircle2 : XCircle;
  const color = pass ? THEME.green : THEME.red;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs uppercase tracking-wider" style={{ color: THEME.inkFaint }}>{label}</div>
        <div className="text-sm font-body mt-0.5" style={{ color: THEME.ink }}>{value}</div>
      </div>
    </div>
  );
}

function AnalysisCard({ analysis, isBest }) {
  if (analysis.error) {
    return (
      <div className="p-5 rounded fade-in" style={{ background: THEME.redSoft, border: `1px solid ${THEME.red}` }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: THEME.red }} />
          <div>
            <div className="font-mono uppercase text-xs tracking-wider" style={{ color: THEME.red }}>
              {analysis.ticker || 'Analysis'} failed
            </div>
            <div className="text-sm mt-1" style={{ color: THEME.inkSoft }}>{analysis.error}</div>
          </div>
        </div>
      </div>
    );
  }

  const recColor = {
    BUY: THEME.green,
    CAUTION: THEME.amber,
    AVOID: THEME.red,
  }[analysis.recommendation] || THEME.inkSoft;

  const recBg = {
    BUY: THEME.greenSoft,
    CAUTION: THEME.amberSoft,
    AVOID: THEME.redSoft,
  }[analysis.recommendation] || THEME.rule;

  return (
    <div className="rounded-lg fade-in" style={{ background: THEME.paper, border: `2px solid ${isBest ? THEME.accent : THEME.rule}` }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${THEME.rule}` }}>
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-semibold">{analysis.ticker}</span>
            {isBest && (
              <span className="px-2 py-0.5 rounded-full font-mono text-xs uppercase tracking-wider" style={{ background: THEME.accent, color: THEME.paper }}>
                Top pick
              </span>
            )}
          </div>
          <div className="font-display italic text-sm mt-1" style={{ color: THEME.inkSoft }}>{analysis.companyName}</div>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 rounded-full font-mono text-xs uppercase tracking-wider" style={{ background: recBg, color: recColor }}>
            {analysis.recommendation}
          </span>
          <div className="font-mono text-xs tabular mt-1" style={{ color: THEME.inkFaint }}>
            {analysis.passedCount}/5 passed
          </div>
        </div>
      </div>

      <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <Check pass={analysis.marketCapPass} label="Market cap >$10B" value={analysis.marketCap || '—'} />
        <Check pass={analysis.betaPass} label="Beta <1.3" value={analysis.beta !== null && analysis.beta !== undefined ? analysis.beta.toFixed(2) : '—'} />
        <Check pass={analysis.earningsPass} label="No earnings in window" value={analysis.nextEarningsDate || '—'} />
        <Check pass={analysis.positionPass} label="Not at 52w extreme" value={analysis.fiftyTwoWeekPosition || '—'} />
        <div className="md:col-span-2">
          <Check pass={analysis.newsPass} label="Clean recent news" value={analysis.newsFlags?.length > 0 ? analysis.newsFlags.join('; ') : 'No material flags'} />
        </div>
      </div>

      <div className="px-5 py-3 font-body text-sm italic" style={{ background: THEME.bg, color: THEME.inkSoft, borderTop: `1px solid ${THEME.rule}` }}>
        {analysis.reasoning}
        {analysis.fundamentalsNote && (
          <div className="mt-1 font-mono not-italic text-xs" style={{ color: THEME.inkFaint }}>
            Fundamentals: {analysis.fundamentalsNote}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecLine({ action, detail, muted, highlight }) {
  return (
    <div className="flex items-center gap-4 py-1.5">
      <span
        className="font-mono text-xs uppercase tracking-wider font-semibold flex-shrink-0"
        style={{
          width: 120,
          color: muted ? THEME.inkFaint : highlight ? THEME.accent : THEME.ink,
        }}
      >
        {action}
      </span>
      <span className="font-body" style={{ color: muted ? THEME.inkFaint : THEME.ink, fontStyle: muted ? 'italic' : 'normal' }}>
        {detail}
      </span>
    </div>
  );
}
