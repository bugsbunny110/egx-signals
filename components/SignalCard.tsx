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
      onKeyDown={(e) => e.key === "Enter" && onViewChart(stock)}
    >
      <div style={{ padding: "18px 20px" }}>
        {/* Top row: ticker + timeframe badge */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "14px",
            gap: "8px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <span className="ticker-tag">{stock.shortName || stock.symbol.slice(0, 8)}</span>
              <span
                className={`badge ${stock.timeframe === "1h" ? "badge-h1" : "badge-h4"}`}
              >
                {stock.timeframe === "1h" ? "H1" : "H4"}
              </span>
              {stock.price && (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", marginLeft: "4px" }}>
                  {stock.price.toFixed(2)}
                  {stock.changePercent !== undefined && stock.changePercent !== null && (
                    <span 
                      style={{ 
                        fontSize: "10px", 
                        marginLeft: "6px", 
                        color: stock.changePercent >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                        fontWeight: 600
                      }}
                    >
                      {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                    </span>
                  )}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100px"
                }}
              >
                {stock.name}
              </div>
              {stock.aiVerdict && (
                <span 
                  className={`badge badge-${stock.aiVerdictColor || 'none'}`}
                  style={{ fontSize: "10px", padding: "1px 6px", textTransform: "uppercase" }}
                >
                  {stock.aiVerdict}
                </span>
              )}
            </div>
          </div>

          {/* Signal badge */}
          <span className={`badge ${config.badgeClass}`} style={{ flexShrink: 0 }}>
            {config.icon}
            {config.label}
          </span>
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

          {/* View chart button */}
          <button
            className="btn-chart"
            onClick={(e) => {
              e.stopPropagation();
              onViewChart(stock);
            }}
            id={`chart-btn-${stock.symbol}-${stock.timeframe}`}
            aria-label={`View TradingView chart for ${stock.symbol}`}
          >
            <BarChart2 size={13} />
            Chart
          </button>
        </div>

        {/* Fundamental Data Section (Buy signals only) */}
        {stock.signal === "buy" && !stock.error && (
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
            {/* P/E Ratio */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>P/E Ratio</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.pe ?? 0) > 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.pe !== undefined && stock.pe !== null ? stock.pe.toFixed(2) : "N/A"}
              </div>
            </div>

            {/* Market Cap */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Market Cap</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.marketCap ?? 0) > 1_000_000_000 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.marketCap !== undefined && stock.marketCap !== null ? (stock.marketCap / 1_000_000_000).toFixed(1) + "B" : "N/A"}
              </div>
            </div>

            {/* LD Debt to Equity */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>LD D/E MRQ</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.ldDebtEquity ?? 0) < 0.7 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.ldDebtEquity !== undefined && stock.ldDebtEquity !== null ? (stock.ldDebtEquity * 100).toFixed(1) + "%" : "N/A"}
              </div>
            </div>

            {/* Total Debt to Equity */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "2px" }}>Total D/E MRQ</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: (stock.totalDebtEquity ?? 0) < 0.7 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {stock.totalDebtEquity !== undefined && stock.totalDebtEquity !== null ? (stock.totalDebtEquity * 100).toFixed(1) + "%" : "N/A"}
              </div>
            </div>
          </div>
        )}

        {/* State indicator bar */}
        {stock.currentState !== 0 && !stock.error && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--bg-border)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  stock.currentState === 1
                    ? "var(--color-buy)"
                    : "var(--color-sell)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Current state:{" "}
            <span
              style={{
                color:
                  stock.currentState === 1
                    ? "var(--color-buy)"
                    : "var(--color-sell)",
                fontWeight: 600,
              }}
            >
              {stock.currentState === 1 ? "Long" : "Short"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
