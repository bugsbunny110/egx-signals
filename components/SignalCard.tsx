"use client";

import type { StockSignal, SignalType } from "@/types";
import { TrendingUp, TrendingDown, LogOut, Minus, BarChart2, AlertCircle } from "lucide-react";

interface SignalCardProps {
  stock: StockSignal;
  index: number;
  onViewChart: (stock: StockSignal) => void;
  onAnalysis?: (stock: StockSignal) => void;
}

interface SignalConfig {
  label: string;
  badgeClass: string;
  colorVar: string;
  icon: React.ReactNode;
  cardClass: string;
}

const SIGNAL_CONFIG: Record<SignalType, SignalConfig> = {
  buy: {
    label: "BUY",
    badgeClass: "badge-buy",
    colorVar: "var(--color-buy)",
    icon: <TrendingUp size={13} />,
    cardClass: "card-buy",
  },
  sell: {
    label: "SELL",
    badgeClass: "badge-sell",
    colorVar: "var(--color-sell)",
    icon: <TrendingDown size={13} />,
    cardClass: "card-sell",
  },
  exit_long: {
    label: "EXIT LONG",
    badgeClass: "badge-exit",
    colorVar: "var(--color-exit)",
    icon: <LogOut size={13} />,
    cardClass: "card-exit",
  },
  exit_short: {
    label: "EXIT SHORT",
    badgeClass: "badge-exit",
    colorVar: "var(--color-exit)",
    icon: <LogOut size={13} />,
    cardClass: "card-exit",
  },
  none: {
    label: "NO SIGNAL",
    badgeClass: "badge-none",
    colorVar: "var(--text-muted)",
    icon: <Minus size={13} />,
    cardClass: "",
  },
};

function candleCountColor(candlesAgo: number | null, signal: SignalType): string {
  if (candlesAgo === null) return "ca-none";
  if (signal === "buy") return "ca-buy";
  if (signal === "sell") return "ca-sell";
  if (signal === "exit_long" || signal === "exit_short") return "ca-exit";
  return "ca-none";
}

function isRecent(candlesAgo: number | null): boolean {
  return candlesAgo !== null && candlesAgo <= 3;
}

export function SignalCard({ stock, index, onViewChart, onAnalysis }: SignalCardProps) {
  const config = SIGNAL_CONFIG[stock.signal];
  const recent = isRecent(stock.candlesAgo);

  return (
    <div
      className={`signal-card ${config.cardClass} ${recent ? "recent" : ""} fade-in-up`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, cursor: onAnalysis ? "pointer" : "default" }}
      onClick={() => onAnalysis?.(stock)}
      role="button"
      tabIndex={0}
      id={`card-${stock.symbol}-${stock.timeframe}`}
      aria-label={`${stock.symbol} ${stock.timeframe} ${config.label} signal`}
    >
      <div style={{ padding: "18px 20px" }}>
        {/* Top row: ticker + timeframe badge */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
          {/* Top Row: Symbol/Price and Main Signal Badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <span className="ticker-tag">{stock.shortName || stock.symbol.slice(0, 8)}</span>
              <span className={`badge ${stock.timeframe === "1h" ? "badge-h1" : "badge-h4"}`}>
                {stock.timeframe === "1h" ? "H1" : "H4"}
              </span>
              {stock.price && (
                <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", marginLeft: "4px" }}>
                  {stock.price.toFixed(2)}
                </span>
              )}
            </div>
            <span className={`badge ${config.badgeClass}`} style={{ flexShrink: 0 }}>
              {config.icon}
              {config.label}
            </span>
          </div>

          {/* Bottom Row: Stock Name and AI Verdict */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
                flex: 1
              }}
            >
              {stock.name}
            </div>
            {stock.aiVerdict && (
              <span 
                className={`badge badge-${stock.aiVerdictColor || 'none'}`}
                style={{ 
                  fontSize: "10px", 
                  padding: "1px 6px", 
                  textTransform: "uppercase",
                  flexShrink: 0 
                }}
              >
                {stock.aiVerdict}
              </span>
            )}
          </div>
        </div>

        {/* Candles ago display */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div>
            {stock.error ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                <AlertCircle size={13} />
                <span title={stock.error}>{stock.error || "Data unavailable"}</span>
              </div>
            ) : stock.candlesAgo === null || stock.signal === "none" ? (
              <div
                style={{ fontSize: "13px", color: "var(--text-muted)" }}
              >
                No signal detected
              </div>
            ) : (
            <>
                <div
                  className={`candles-ago ${candleCountColor(stock.candlesAgo, stock.signal)} ${stock.candlesAgo === 0 ? "live-pulse" : ""}`}
                >
                  {stock.candlesAgo === 0 ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      LIVE
                      <span
                         style={{
                           width: 8,
                           height: 8,
                           borderRadius: "50%",
                           background: "currentcolor",
                           display: "inline-block",
                           animation: "pulse-blink 1s infinite alternate"
                         }}
                      />
                    </span>
                  ) : (
                    stock.candlesAgo
                  )}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {stock.candlesAgo === 0 ? "current candle" : `candle${stock.candlesAgo !== 1 ? "s" : ""} ago`}
                </div>
            </>
            )}
          </div>

          {/* Today Change Badge (Repositioned) */}
          {stock.changePercent !== undefined && stock.changePercent !== null && !stock.error && (
            <div 
              style={{ 
                fontSize: "12px", 
                padding: "4px 10px", 
                borderRadius: "6px",
                background: stock.changePercent >= 0 ? "rgba(0, 214, 143, 0.15)" : "rgba(255, 77, 109, 0.15)",
                color: stock.changePercent >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                fontWeight: 800,
                border: `1px solid ${stock.changePercent >= 0 ? "rgba(0, 214, 143, 0.3)" : "rgba(255, 77, 109, 0.3)"}`,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontFamily: "JetBrains Mono, monospace"
              }}
            >
              {stock.changePercent >= 0 ? "▲" : "▼"} {Math.abs(stock.changePercent).toFixed(2)}%
            </div>
          )}
        </div>

        {/* Stats Section (Visible for all) */}
        {!stock.error && (
          <div
             style={{
               marginTop: "16px",
               padding: "12px",
               background: "rgba(255, 255, 255, 0.03)",
               borderRadius: "10px",
               border: "1px solid var(--bg-border)",
               display: "grid",
               gridTemplateColumns: "1fr 1fr",
               gap: "10px",
             }}
          >

            {/* P/E Ratio (Always visible) */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>P/E Ratio</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.pe ?? 0) > 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.pe !== undefined && stock.pe !== null ? stock.pe.toFixed(2) : "N/A"}
              </div>
            </div>

            {/* Market Cap (Always visible) */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Market Cap</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.marketCap ?? 0) > 1_000_000_000 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.marketCap !== undefined && stock.marketCap !== null 
                  ? (stock.marketCap / 1_000_000_000).toFixed(1) + "B" 
                  : "N/A"}
              </div>
            </div>

            {/* Debt/Equity (Always visible) */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>LD D/E MRQ</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.ldDebtEquity ?? 0) < 0.7 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.ldDebtEquity !== undefined && stock.ldDebtEquity !== null 
                  ? (stock.ldDebtEquity * 100).toFixed(1) + "%" 
                  : "N/A"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Total D/E MRQ</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.totalDebtEquity ?? 0) < 0.7 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.totalDebtEquity !== undefined && stock.totalDebtEquity !== null 
                  ? (stock.totalDebtEquity * 100).toFixed(1) + "%" 
                  : "N/A"}
              </div>
            </div>
          </div>
        )}

        {/* Yesterday's Change */}
        {!stock.error && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--bg-border)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>Yesterday's Change:</span>
              <span style={{ color: (stock.yesterdayChangePercent ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                {stock.yesterdayChangePercent !== undefined && stock.yesterdayChangePercent !== null 
                  ? `${stock.yesterdayChangePercent >= 0 ? "+" : ""}${stock.yesterdayChangePercent.toFixed(2)}%`
                  : "N/A"}
              </span>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>Today's Gap:</span>
              <span style={{ color: (stock.gapPercent ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                {stock.gapPercent !== undefined && stock.gapPercent !== null 
                  ? `${stock.gapPercent >= 0 ? "+" : ""}${stock.gapPercent.toFixed(2)}%`
                  : "N/A"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>Opening RVOL (30m):</span>
              <span style={{ color: (stock.relativeVolume30m ?? 0) >= 1.2 ? "var(--color-buy)" : "var(--text-muted)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                {stock.relativeVolume30m !== undefined && stock.relativeVolume30m !== null 
                  ? `${stock.relativeVolume30m.toFixed(2)}x`
                  : "N/A"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
