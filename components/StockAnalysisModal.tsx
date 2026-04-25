"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, TrendingUp, TrendingDown, BarChart2, Brain, Users, Newspaper, Bot } from "lucide-react";
import type { StockSignal } from "@/types";

interface AnalysisData {
  symbolKey: string;
  name: string;
  tvRecommendation: {
    overall: { label: string; value: number };
    movingAverages: { label: string; value: number };
    oscillators: { label: string; value: number };
  };
  technicals: {
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    close: number | null;
    sma50: number | null;
    sma200: number | null;
    ema20: number | null;
    high52w: number | null;
    low52w: number | null;
    posIn52wRange: number;
    changePercent: number | null;
    perf1m: number | null;
    perf3m: number | null;
    volume: number | null;
    momentum: number | null;
  };
  fundamentals: {
    pe: number | null;
    marketCap: number | null;
    totalDE: number | null;
    ldDE: number | null;
  };
  analysis: {
    bullishPoints: string[];
    bearishPoints: string[];
    neutralPoints: string[];
    bigTradersOpinion: string;
    aiVerdict: string;
    verdictEmoji: string;
    verdictColor: "buy" | "sell" | "neutral";
  };
  tradeSetup?: {
    entryPrice: number;
    stopLoss: number;
    slPct: number;
    tp1: number; tp1Pct: number; rr1: number;
    tp2: number; tp2Pct: number; rr2: number;
    tp3: number; tp3Pct: number; rr3: number;
    supportUsedForSL: number | null;
  };
}

interface Props {
  stock: StockSignal;
  onClose: () => void;
}

function RecommendBadge({ label, value }: { label: string; value: number }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Strong Buy": { bg: "rgba(52, 211, 153, 0.15)", color: "#34d399" },
    Buy: { bg: "rgba(52, 211, 153, 0.08)", color: "#6ee7b7" },
    Neutral: { bg: "rgba(255,255,255,0.06)", color: "#94a3b8" },
    Sell: { bg: "rgba(244, 63, 94, 0.08)", color: "#fb7185" },
    "Strong Sell": { bg: "rgba(244, 63, 94, 0.15)", color: "#f43f5e" },
  };
  const style = colors[label] ?? colors["Neutral"];
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        letterSpacing: "0.5px",
      }}
    >
      {label}
    </span>
  );
}

function GaugeBar({ value, min = -1, max = 1 }: { value: number; min?: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const color =
    value > 0.1 ? "#34d399" : value < -0.1 ? "#f43f5e" : "#94a3b8";
  return (
    <div
      style={{
        height: "6px",
        background: "rgba(255,255,255,0.08)",
        borderRadius: "3px",
        overflow: "hidden",
        marginTop: "6px",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.8s ease",
        }}
      />
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          color: "var(--color-gold)",
          fontWeight: 700,
          fontSize: "13px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function StockAnalysisModal({ stock, onClose }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(stock.symbol)}`);
      if (!res.ok) throw new Error(`Failed to fetch analysis`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stock.symbol]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fmtNum = (n: number | null | undefined, decimals = 2) =>
    n != null ? n.toFixed(decimals) : "N/A";

  const fmtPct = (n: number | null | undefined) =>
    n != null ? `${n > 0 ? "+" : ""}${n.toFixed(1)}%` : "N/A";

  const fmtCap = (n: number | null | undefined) => {
    if (!n) return "N/A";
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    return `${(n / 1e6).toFixed(0)}M`;
  };

  const pctColor = (n: number | null | undefined, goodIfPositive = true) => {
    if (!n) return "var(--text-muted)";
    const good = goodIfPositive ? n > 0 : n < 0;
    return good ? "var(--color-buy)" : "var(--color-sell)";
  };

  const verdictBg =
    analysis?.analysis.verdictColor === "buy"
      ? "linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.05) 100%)"
      : analysis?.analysis.verdictColor === "sell"
      ? "linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(244,63,94,0.05) 100%)"
      : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)";

  const verdictBorder =
    analysis?.analysis.verdictColor === "buy"
      ? "rgba(52,211,153,0.3)"
      : analysis?.analysis.verdictColor === "sell"
      ? "rgba(244,63,94,0.3)"
      : "rgba(255,255,255,0.1)";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 200,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(540px, 100vw)",
          background: "var(--bg-card)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 201,
          overflowY: "auto",
          animation: "slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "-24px 0 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--bg-card)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #f0b429, #b88a00)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#000",
                  flexShrink: 0,
                }}
              >
                {stock.symbol.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "17px", color: "var(--text-primary)" }}>
                  {stock.symbol}
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      background: stock.signal === "buy" ? "rgba(52,211,153,0.15)" : "rgba(244,63,94,0.15)",
                      color: stock.signal === "buy" ? "#34d399" : "#f43f5e",
                      borderRadius: "20px",
                    }}
                  >
                    {stock.signal.toUpperCase()} · {stock.timeframe.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {stock.name}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "7px",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px 40px" }}>
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                padding: "60px 0",
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "3px solid rgba(240,180,41,0.2)",
                  borderTopColor: "#f0b429",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div style={{ fontSize: "14px" }}>Analyzing {stock.symbol}...</div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "20px",
                background: "rgba(244,63,94,0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(244,63,94,0.2)",
                color: "#f43f5e",
                fontSize: "14px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {analysis && !loading && (
            <>
              {/* 1. AI VERDICT */}
              <div
                style={{
                  background: verdictBg,
                  border: `1px solid ${verdictBorder}`,
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "16px",
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontSize: "32px", lineHeight: 1 }}>{analysis.analysis.verdictEmoji}</div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--color-gold)",
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Bot size={12} /> AI Verdict
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}
                  >
                    {analysis.analysis.aiVerdict}
                  </div>
                </div>
              </div>

              {/* 1b. TRADE SETUP — TP & SL */}
              {analysis.tradeSetup && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "18px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--color-gold)",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    🎯 Trade Setup
                  </div>

                  {/* Entry & SL Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "10px",
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>Entry Price</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                        {fmtNum(analysis.tradeSetup.entryPrice)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>EGP</div>
                    </div>
                    <div
                      style={{
                        background: "rgba(244,63,94,0.08)",
                        borderRadius: "10px",
                        padding: "12px",
                        textAlign: "center",
                        border: "1px solid rgba(244,63,94,0.15)",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "#fb7185", marginBottom: "4px" }}>🛑 Stop Loss</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#f43f5e" }}>
                        {fmtNum(analysis.tradeSetup.stopLoss)}
                      </div>
                      <div style={{ fontSize: "10px", color: "#f43f5e", fontWeight: 600 }}>
                        {analysis.tradeSetup.slPct}%
                      </div>
                    </div>
                  </div>

                  {/* TP Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    {[
                      { label: "TP 1", emoji: "🎯", price: analysis.tradeSetup.tp1, pct: analysis.tradeSetup.tp1Pct, rr: analysis.tradeSetup.rr1, note: "Conservative" },
                      { label: "TP 2", emoji: "🎯", price: analysis.tradeSetup.tp2, pct: analysis.tradeSetup.tp2Pct, rr: analysis.tradeSetup.rr2, note: "Main Target" },
                      { label: "TP 3", emoji: "🏆", price: analysis.tradeSetup.tp3, pct: analysis.tradeSetup.tp3Pct, rr: analysis.tradeSetup.rr3, note: "Extended" },
                    ].map(({ label, emoji, price, pct, rr, note }) => (
                      <div
                        key={label}
                        style={{
                          background: "rgba(52,211,153,0.07)",
                          border: "1px solid rgba(52,211,153,0.15)",
                          borderRadius: "10px",
                          padding: "10px 8px",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "10px", color: "#34d399", marginBottom: "4px", fontWeight: 700 }}>
                          {emoji} {label}
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#34d399" }}>
                          {fmtNum(price)}
                        </div>
                        <div style={{ fontSize: "11px", color: "#6ee7b7", fontWeight: 600, marginTop: "2px" }}>
                          +{pct}%
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                          R/R {rr}:1
                        </div>
                        <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "1px" }}>
                          {note}
                        </div>
                      </div>
                    ))}
                  </div>

                  {analysis.tradeSetup.supportUsedForSL && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", textAlign: "center" }}>
                      SL placed below nearest support at {fmtNum(analysis.tradeSetup.supportUsedForSL)} EGP
                    </div>
                  )}
                </div>
              )}

              {/* 2. TradingView Recommendation */}
              <Section icon={<BarChart2 size={14} />} title="Technical Recommendation">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  {[
                    { label: "Overall", data: analysis.tvRecommendation.overall },
                    { label: "Moving Avgs", data: analysis.tvRecommendation.movingAverages },
                    { label: "Oscillators", data: analysis.tvRecommendation.oscillators },
                  ].map(({ label, data }) => (
                    <div
                      key={label}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "10px",
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px" }}>
                        {label}
                      </div>
                      <RecommendBadge label={data.label} value={data.value} />
                      <GaugeBar value={data.value} />
                    </div>
                  ))}
                </div>

                {/* Technical indicators grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "RSI (14)", value: fmtNum(analysis.technicals.rsi, 1), good: analysis.technicals.rsi != null && analysis.technicals.rsi >= 50 && analysis.technicals.rsi < 70 },
                    { label: "MACD", value: fmtNum(analysis.technicals.macd, 4), good: (analysis.technicals.macd ?? 0) > 0 },
                    { label: "Momentum", value: fmtNum(analysis.technicals.momentum, 2), good: (analysis.technicals.momentum ?? 0) > 0 },
                    { label: "Price", value: `${fmtNum(analysis.technicals.close)} EGP`, good: true },
                    { label: "SMA 50", value: fmtNum(analysis.technicals.sma50), good: (analysis.technicals.close ?? 0) > (analysis.technicals.sma50 ?? 0) },
                    { label: "SMA 200", value: fmtNum(analysis.technicals.sma200), good: (analysis.technicals.close ?? 0) > (analysis.technicals.sma200 ?? 0) },
                    { label: "52W High", value: fmtNum(analysis.technicals.high52w), good: true },
                    { label: "52W Low", value: fmtNum(analysis.technicals.low52w), good: true },
                    { label: "1M Perf.", value: fmtPct(analysis.technicals.perf1m), good: (analysis.technicals.perf1m ?? 0) > 0 },
                    { label: "3M Perf.", value: fmtPct(analysis.technicals.perf3m), good: (analysis.technicals.perf3m ?? 0) > 0 },
                  ].map(({ label, value, good }) => (
                    <div
                      key={label}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: good ? "var(--color-buy)" : "var(--color-sell)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 3. AI Analysis Points */}
              <Section icon={<Brain size={14} />} title="AI Analysis">
                {analysis.analysis.bullishPoints.length > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#34d399", marginBottom: "8px" }}>
                      🟢 Bullish Factors
                    </div>
                    {analysis.analysis.bullishPoints.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "8px",
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          marginBottom: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span>
                        {p}
                      </div>
                    ))}
                  </div>
                )}

                {analysis.analysis.bearishPoints.length > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#f43f5e", marginBottom: "8px" }}>
                      🔴 Risk Factors
                    </div>
                    {analysis.analysis.bearishPoints.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "8px",
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          marginBottom: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: "#f43f5e", flexShrink: 0 }}>✗</span>
                        {p}
                      </div>
                    ))}
                  </div>
                )}

                {analysis.analysis.neutralPoints.length > 0 && (
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", marginBottom: "8px" }}>
                      ⚪ Neutral Observations
                    </div>
                    {analysis.analysis.neutralPoints.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "8px",
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          marginBottom: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: "#94a3b8", flexShrink: 0 }}>–</span>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* 4. Big Traders Opinion */}
              <Section icon={<Users size={14} />} title="Big Traders Opinion">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "10px",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>Today's Change</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: pctColor(analysis.technicals.changePercent) }}>
                      {fmtPct(analysis.technicals.changePercent)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "10px",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>Volume Today</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
                      {analysis.technicals.volume ? (analysis.technicals.volume / 1_000_000).toFixed(1) + "M" : "N/A"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: "10px",
                    padding: "14px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>🏦</span>
                  {analysis.analysis.bigTradersOpinion}
                </div>
              </Section>

              {/* 5. Fundamental News */}
              <Section icon={<Newspaper size={14} />} title="Fundamental Data">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    {
                      label: "P/E Ratio",
                      value: analysis.fundamentals.pe ? analysis.fundamentals.pe.toFixed(1) + "x" : "N/A",
                      good: analysis.fundamentals.pe != null && analysis.fundamentals.pe > 0,
                      note: analysis.fundamentals.pe ? (analysis.fundamentals.pe < 15 ? "Undervalued" : analysis.fundamentals.pe < 30 ? "Fair Value" : "Overvalued") : null,
                    },
                    {
                      label: "Market Cap",
                      value: fmtCap(analysis.fundamentals.marketCap) + " EGP",
                      good: (analysis.fundamentals.marketCap ?? 0) > 1_000_000_000,
                      note: (analysis.fundamentals.marketCap ?? 0) > 10e9 ? "Large-Cap" : (analysis.fundamentals.marketCap ?? 0) > 1e9 ? "Mid-Cap" : "Small-Cap",
                    },
                    {
                      label: "Total D/E MRQ",
                      value: analysis.fundamentals.totalDE != null ? (analysis.fundamentals.totalDE * 100).toFixed(0) + "%" : "N/A",
                      good: analysis.fundamentals.totalDE != null && analysis.fundamentals.totalDE < 0.7,
                      note: analysis.fundamentals.totalDE != null ? (analysis.fundamentals.totalDE < 0.5 ? "Low Risk" : analysis.fundamentals.totalDE < 1.5 ? "Moderate" : "High Debt") : null,
                    },
                    {
                      label: "LD D/E MRQ",
                      value: analysis.fundamentals.ldDE != null ? (analysis.fundamentals.ldDE * 100).toFixed(0) + "%" : "N/A",
                      good: analysis.fundamentals.ldDE != null && analysis.fundamentals.ldDE < 0.7,
                      note: analysis.fundamentals.ldDE != null ? (analysis.fundamentals.ldDE < 0.5 ? "Conservative" : analysis.fundamentals.ldDE < 1.5 ? "Leveraged" : "High LT Debt") : null,
                    },
                  ].map(({ label, value, good, note }) => (
                    <div
                      key={label}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "10px",
                        padding: "14px",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: good ? "var(--color-buy)" : "var(--color-sell)" }}>
                        {value}
                      </div>
                      {note && (
                        <div style={{ fontSize: "10px", color: good ? "#34d399" : "#fb7185", marginTop: "2px", fontWeight: 600 }}>
                          {note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
