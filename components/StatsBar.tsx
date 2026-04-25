"use client";

import type { DashboardStats } from "@/types";
import { TrendingUp, TrendingDown, LogOut, Activity } from "lucide-react";

interface StatsBarProps {
  stats: DashboardStats;
  scannedAt: string | null;
}

export function StatsBar({ stats, scannedAt }: StatsBarProps) {
  const timeAgo = scannedAt
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.round((new Date(scannedAt).getTime() - Date.now()) / 60000),
        "minute"
      )
    : null;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {/* Total Active */}
        <div className="stat-card fade-in-up" style={{ animationDelay: "0ms" }}>
          <div className="stat-label" style={{ color: "var(--text-muted)" }}>
            <Activity size={12} style={{ display: "inline", marginRight: 4 }} />
            Total Signals
          </div>
          <div className="stat-value" style={{ color: "var(--color-gold)" }}>
            {stats.totalActive}
          </div>
        </div>

        {/* Buy signals */}
        <div className="stat-card fade-in-up" style={{ animationDelay: "50ms" }}>
          <div className="stat-label" style={{ color: "var(--color-buy)" }}>
            <TrendingUp size={12} style={{ display: "inline", marginRight: 4 }} />
            Buy Signals
          </div>
          <div className="stat-value" style={{ color: "var(--color-buy)" }}>
            {stats.totalBuy}
          </div>
        </div>

        {/* Sell signals */}
        <div className="stat-card fade-in-up" style={{ animationDelay: "100ms" }}>
          <div className="stat-label" style={{ color: "var(--color-sell)" }}>
            <TrendingDown
              size={12}
              style={{ display: "inline", marginRight: 4 }}
            />
            Sell Signals
          </div>
          <div className="stat-value" style={{ color: "var(--color-sell)" }}>
            {stats.totalSell}
          </div>
        </div>

        {/* Exit Long */}
        <div className="stat-card fade-in-up" style={{ animationDelay: "150ms" }}>
          <div className="stat-label" style={{ color: "var(--color-exit)" }}>
            <LogOut size={12} style={{ display: "inline", marginRight: 4 }} />
            Exit Long
          </div>
          <div className="stat-value" style={{ color: "var(--color-exit)" }}>
            {stats.totalExitLong}
          </div>
        </div>

        {/* Exit Short */}
        <div className="stat-card fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="stat-label" style={{ color: "var(--color-exit)" }}>
            <LogOut size={12} style={{ display: "inline", marginRight: 4 }} />
            Exit Short
          </div>
          <div className="stat-value" style={{ color: "var(--color-exit)" }}>
            {stats.totalExitShort}
          </div>
        </div>
      </div>

      {scannedAt && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "var(--text-muted)",
            textAlign: "right",
          }}
        >
          Last scan: {timeAgo} •{" "}
          {new Date(scannedAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}
