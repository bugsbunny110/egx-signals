"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type {
  StockSignal,
  FilterType,
  SortType,
  TimeframeFilter,
  DashboardStats,
} from "@/types";
import { StatsBar } from "./StatsBar";
import { FilterBar } from "./FilterBar";
import { SignalCard } from "./SignalCard";
import { ScanProgress } from "./ScanProgress";
import { StockModal } from "./StockModal";
import StockAnalysisModal from "./StockAnalysisModal";
import { RefreshCw, AlertTriangle, Zap, ServerCrash } from "lucide-react";
import { EGX_SYMBOLS } from "@/lib/egx-symbols-client";

// We import the symbol list client-side for UI purposes only
// (the actual fetch happens server-side)

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const SIGNAL_ORDER: Record<string, number> = {
  buy: 0,
  sell: 1,
  exit_long: 2,
  exit_short: 3,
  none: 4,
};

export function Dashboard() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("candles_asc");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockSignal | null>(null);
  const [analysisStock, setAnalysisStock] = useState<StockSignal | null>(null);

  // Incremental scan state
  const [stocks, setStocks] = useState<StockSignal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [marketOpen, setMarketOpen] = useState(true);
  const [totalErrors, setTotalErrors] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS);
  const scanningRef = useRef(false);
  const lastScanTime = useRef<number>(0);

  const TIMEFRAMES: ("1h" | "4h")[] = ["1h", "4h"];
  const TOTAL_SCANS = EGX_SYMBOLS.length * TIMEFRAMES.length;

  // Incremental scanner — fetches one symbol×interval at a time and streams results into state
  const runScan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setServerError(null);
    setScanProgress(0);
    setStocks([]);
    setTotalErrors(0);

    // Fetch fundamentals once for the whole market before scanning
    let allFundamentals: Record<string, any> = {};
    try {
      const funRes = await fetch("/api/fundamentals");
      if (funRes.ok) allFundamentals = await funRes.json();
    } catch (e) {
      console.warn("Fundamentals fetch failed, will show N/A", e);
    }

    let completed = 0;
    let errors = 0;
    const results: StockSignal[] = [];

    const CONCURRENCY = 8;
    const itemsToScan: { sym: any; tf: "1h" | "4h" }[] = [];
    EGX_SYMBOLS.forEach((sym) => {
      TIMEFRAMES.forEach((tf) => {
        itemsToScan.push({ sym, tf });
      });
    });

    // Process in chunks of 8
    for (let i = 0; i < itemsToScan.length; i += CONCURRENCY) {
      if (!scanningRef.current) break;

      const chunk = itemsToScan.slice(i, i + CONCURRENCY);
      
      await Promise.all(
        chunk.map(async (item) => {
          const { sym, tf } = item;
          setCurrentSymbol(`${sym.shortName || sym.symbol} (${tf.toUpperCase()})`);

          try {
            const res = await fetch(
              `/api/signals?symbol=${encodeURIComponent(sym.symbol)}&interval=${tf}`
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const stock: StockSignal = data.stocks?.[0];

            if (stock) {
              // Merge in fundamental data fetched separately
              const f = allFundamentals[sym.symbol];
              if (f) {
                stock.pe = f.pe;
                stock.marketCap = f.market_cap;
                stock.ldDebtEquity = f.ld_debt_to_equity;
                stock.totalDebtEquity = f.debt_to_equity;
              }
              results.push(stock);
            }
          } catch (err) {
            errors++;
            const errMsg = (err as Error).message;
            results.push({
              symbol: sym.symbol,
              name: sym.name,
              shortName: sym.shortName,
              tvSymbol: sym.tvSymbol,
              timeframe: tf,
              signal: "none",
              candlesAgo: null,
              currentState: 0,
              lastUpdated: new Date().toISOString(),
              error: errMsg,
            });
          }
          
          completed++;
          setScanProgress(completed);
        })
      );
      
      setStocks([...results]);
      setTotalErrors(errors);
      await new Promise(r => setTimeout(r, 150));
    }

    setScannedAt(new Date().toISOString());
    setScanning(false);
    scanningRef.current = false;
    lastScanTime.current = Date.now();
  }, []);

  // Market hours helper
  const checkMarketStatus = useCallback(() => {
    const now = new Date();
    // Egypt time is the user's local time based on the prompt context
    const day = now.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
    const hour = now.getHours();
    
    const isWorkingDay = day >= 0 && day <= 4; // Sunday to Thursday
    const isWorkingHour = hour >= 7 && hour < 17; // 07:00 to 16:59:59
    
    const isOpen = isWorkingDay && isWorkingHour;
    setMarketOpen(isOpen);
    return isOpen;
  }, []);

  // Auto-run scan on mount
  useEffect(() => {
    checkMarketStatus();
    runScan();
    return () => {
      scanningRef.current = false;
    };
  }, [runScan, checkMarketStatus]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const isOpen = checkMarketStatus();
      
      if (lastScanTime.current > 0 && isOpen) {
        const elapsed = Date.now() - lastScanTime.current;
        const remaining = Math.max(0, REFRESH_INTERVAL_MS - elapsed);
        setCountdown(remaining);
        // Auto-refresh when countdown hits 0
        if (remaining === 0 && !scanningRef.current) {
          runScan();
        }
      } else if (!isOpen) {
        setCountdown(REFRESH_INTERVAL_MS); // Reset countdown while closed
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [runScan, checkMarketStatus]);

  const formatCountdown = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Stats
  const stats = useMemo<DashboardStats>(() => {
    const active = stocks.filter((s) => s.signal !== "none" && !s.error);
    return {
      totalBuy: active.filter((s) => s.signal === "buy").length,
      totalSell: active.filter((s) => s.signal === "sell").length,
      totalExitLong: active.filter((s) => s.signal === "exit_long").length,
      totalExitShort: active.filter((s) => s.signal === "exit_short").length,
      totalActive: active.length,
    };
  }, [stocks]);

  // Filter + sort
  const filteredStocks = useMemo<StockSignal[]>(() => {
    let filtered = [...stocks];

    if (timeframe !== "all") {
      filtered = filtered.filter((s) => s.timeframe === timeframe);
    }

    if (filter !== "all") {
      filtered = filtered.filter((s) => s.signal === filter);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.shortName?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      if (sort === "candles_asc") {
        return (a.candlesAgo ?? 9999) - (b.candlesAgo ?? 9999);
      }
      if (sort === "candles_desc") {
        return (b.candlesAgo ?? -1) - (a.candlesAgo ?? -1);
      }
      if (sort === "signal") {
        return (SIGNAL_ORDER[a.signal] ?? 5) - (SIGNAL_ORDER[b.signal] ?? 5);
      }
      if (sort === "symbol_az") {
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });

    return filtered;
  }, [stocks, filter, sort, timeframe]);

  const handleViewChart = useCallback((stock: StockSignal) => {
    setSelectedStock(stock);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedStock(null);
  }, []);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--bg-border)",
          paddingBottom: "20px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  border: "1.5px solid var(--color-gold)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-surface)",
                }}
              >
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              </div>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.5px",
                }}
              >
                EGX Signal Scanner
              </h1>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                maxWidth: "480px",
              }}
            >
              Universal Self-Adaptive Signal Radar Pro · Egyptian Stock Exchange · <span style={{ color: "var(--color-gold)" }}>Powered by Karim A. Ayad</span>
            </p>
          </div>

          {/* Refresh + countdown */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "8px",
            }}
          >
            <button
              id="refresh-btn"
              className="btn-refresh"
              onClick={runScan}
              disabled={scanning}
              aria-label="Refresh signals"
            >
              <RefreshCw size={14} className={scanning ? "spin" : ""} />
              {scanning ? `Scanning ${scanProgress}/${TOTAL_SCANS}...` : "Refresh"}
            </button>

            {scannedAt && !scanning && (
              <div className="countdown" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!marketOpen ? (
                   <span style={{ color: 'var(--color-sell)', fontWeight: 600 }}>Market Closed (Off)</span>
                ) : (
                   <>Next refresh in {formatCountdown(countdown)}</>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TV Server error */}
      {serverError && (
        <div
          style={{
            background: "rgba(255, 77, 109, 0.1)",
            border: "1px solid rgba(255, 77, 109, 0.3)",
            borderRadius: "12px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <ServerCrash size={20} color="var(--color-sell)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-sell)",
                marginBottom: "6px",
              }}
            >
              TradingView Data Server Not Running
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
              The local Python server that fetches data from TradingView needs to be started first.
            </div>
            <code
              style={{
                display: "block",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--bg-border)",
                borderRadius: "7px",
                padding: "10px 14px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                color: "var(--color-gold)",
              }}
            >
              python3 tv_server.py
            </code>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              Run this command in a separate terminal inside the project folder, then click Refresh.
            </div>
          </div>
        </div>
      )}

      {/* Progress scanner */}
      {scanning && (
        <ScanProgress
          current={scanProgress}
          total={TOTAL_SCANS}
          currentSymbol={currentSymbol}
        />
      )}

      {/* Stats + filter (show as soon as first results arrive) */}
      {stocks.length > 0 && (
        <>
          <StatsBar stats={stats} scannedAt={scannedAt} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <FilterBar
              filter={filter}
              sort={sort}
              timeframe={timeframe}
              onFilterChange={setFilter}
              onSortChange={setSort}
              onTimeframeChange={setTimeframe}
              totalShown={filteredStocks.length}
            />

            <div style={{ position: "relative", flex: "1", minWidth: "200px", maxWidth: "350px" }}>
              <input
                type="text"
                placeholder="Search stocks (e.g. SCTS, COMI)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-gold)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--bg-border)")}
              />
            </div>
          </div>

          {/* Error rate warning */}
          {totalErrors > 5 && !scanning && (
            <div
              style={{
                background: "rgba(240, 180, 41, 0.08)",
                border: "1px solid rgba(240, 180, 41, 0.3)",
                borderRadius: "10px",
                padding: "14px 18px",
                marginBottom: "20px",
                fontSize: "13px",
                color: "var(--color-gold)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={14} />
              {totalErrors} symbols failed to load — TradingView may not carry data for some EGX tickers
            </div>
          )}

          {/* Signal cards grid */}
          {filteredStocks.length === 0 && !scanning ? (
            <div className="empty-state">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "14px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--bg-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={22} color="var(--text-muted)" />
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                No signals match your filters
              </div>
              <div style={{ fontSize: "13px" }}>
                Try changing the timeframe or signal type filter
              </div>
            </div>
          ) : (
            <div
              id="signals-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "14px",
              }}
            >
              {filteredStocks.map((stock, i) => (
                <SignalCard
                  key={`${stock.symbol}-${stock.timeframe}`}
                  stock={stock}
                  index={i}
                  onViewChart={handleViewChart}
                  onAnalysis={(s) => setAnalysisStock(s)}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          {!scanning && (
            <div
              style={{
                marginTop: "40px",
                paddingTop: "20px",
                borderTop: "1px solid var(--bg-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--text-muted)",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <span>
                {stocks.length} scans · {totalErrors} errors ·{" "}
                {stocks.filter((s) => s.signal !== "none").length} active signals
              </span>
              <span>Data via TradingView WebSocket · No API key required</span>
            </div>
          )}
        </>
      )}

      {/* Chart Modal */}
      <StockModal stock={selectedStock} onClose={handleCloseModal} />

      {/* AI Analysis Panel */}
      {analysisStock && (
        <StockAnalysisModal
          stock={analysisStock}
          onClose={() => setAnalysisStock(null)}
        />
      )}
    </div>
  );
}
