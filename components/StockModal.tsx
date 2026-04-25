"use client";

import { useEffect, useRef } from "react";
import type { StockSignal } from "@/types";
import { X, ExternalLink } from "lucide-react";

interface StockModalProps {
  stock: StockSignal | null;
  onClose: () => void;
}

// TradingView timeframe mapping
const TV_INTERVAL: Record<string, string> = {
  "1h": "60",
  "4h": "240",
};

export function StockModal({ stock, onClose }: StockModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stock || !containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const interval = TV_INTERVAL[stock.timeframe] || "60";

    // TradingView widget script
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: stock.tvSymbol || `EGX:${stock.symbol}`,
      interval,
      timezone: "Africa/Cairo",
      theme: "dark",
      style: "1", // candlestick
      locale: "en",
      gridLineColor: "rgba(30, 45, 64, 0.8)",
      backgroundColor: "rgba(13, 19, 33, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      withdateranges: true,
      allow_symbol_change: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [stock]);

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!stock) return null;

  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(stock.tvSymbol || `EGX:${stock.symbol}`)}&interval=${TV_INTERVAL[stock.timeframe]}`;

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      id="chart-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Chart for ${stock.symbol}`}
    >
      <div className="modal-container fade-in-up">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="ticker-tag" style={{ fontSize: "17px" }}>
              {stock.shortName || stock.symbol.slice(0, 10)}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                maxWidth: "260px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {stock.name}
            </span>
            <span
              className={`badge ${stock.timeframe === "1h" ? "badge-h1" : "badge-h4"}`}
            >
              {stock.timeframe === "1h" ? "H1" : "H4"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Open in TradingView */}
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="open-tradingview-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                color: "var(--text-muted)",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: "7px",
                border: "1px solid var(--bg-border)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--color-gold)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-gold)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)";
              }}
            >
              <ExternalLink size={12} />
              TradingView
            </a>

            {/* Close button */}
            <button
              id="close-modal-btn"
              onClick={onClose}
              aria-label="Close chart"
              style={{
                width: 32,
                height: 32,
                borderRadius: "7px",
                border: "1px solid var(--bg-border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border-bright)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)";
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* TradingView Chart */}
        <div
          ref={containerRef}
          id="tradingview-widget-container"
          className="tradingview-widget-container"
          style={{
            height: "560px",
            width: "100%",
          }}
        />
      </div>
    </div>
  );
}
