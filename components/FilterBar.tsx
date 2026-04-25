"use client";

import type { FilterType, SortType, TimeframeFilter } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  LogOut,
  LayoutGrid,
  ArrowUpDown,
  Clock,
} from "lucide-react";

interface FilterBarProps {
  filter: FilterType;
  sort: SortType;
  timeframe: TimeframeFilter;
  onFilterChange: (f: FilterType) => void;
  onSortChange: (s: SortType) => void;
  onTimeframeChange: (t: TimeframeFilter) => void;
  totalShown: number;
}

const FILTERS: { id: FilterType; label: string; icon: React.ReactNode; activeClass: string }[] = [
  { id: "all", label: "All", icon: <LayoutGrid size={13} />, activeClass: "active" },
  { id: "buy", label: "Buy", icon: <TrendingUp size={13} />, activeClass: "active-buy" },
  { id: "sell", label: "Sell", icon: <TrendingDown size={13} />, activeClass: "active-sell" },
  { id: "exit_long", label: "Exit Long", icon: <LogOut size={13} />, activeClass: "active-exit" },
  { id: "exit_short", label: "Exit Short", icon: <LogOut size={13} />, activeClass: "active-exit" },
];

const TIMEFRAMES: { id: TimeframeFilter; label: string }[] = [
  { id: "all", label: "All TF" },
  { id: "1h", label: "H1" },
  { id: "4h", label: "H4" },
];

const SORTS: { id: SortType; label: string }[] = [
  { id: "candles_asc", label: "Newest First" },
  { id: "candles_desc", label: "Oldest First" },
  { id: "signal", label: "By Signal" },
  { id: "symbol_az", label: "A → Z" },
];

export function FilterBar({
  filter,
  sort,
  timeframe,
  onFilterChange,
  onSortChange,
  onTimeframeChange,
  totalShown,
}: FilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      {/* Signal filter + count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              id={`filter-${f.id}`}
              className={`filter-btn ${filter === f.id ? f.activeClass : ""}`}
              onClick={() => onFilterChange(f.id)}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        <span
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
            whiteSpace: "nowrap",
          }}
        >
          {totalShown} results
        </span>
      </div>

      {/* Timeframe + Sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        {/* Timeframe buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "var(--bg-card)",
            border: "1px solid var(--bg-border)",
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          <Clock size={13} style={{ color: "var(--text-muted)", marginLeft: 6 }} />
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              id={`timeframe-${tf.id}`}
              onClick={() => onTimeframeChange(tf.id)}
              style={{
                padding: "5px 14px",
                borderRadius: "6px",
                border: "none",
                background:
                  timeframe === tf.id
                    ? "rgba(240,180,41,0.2)"
                    : "transparent",
                color:
                  timeframe === tf.id
                    ? "var(--color-gold)"
                    : "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "JetBrains Mono, monospace",
                transition: "all 0.2s",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          <ArrowUpDown size={13} style={{ color: "var(--text-muted)" }} />
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortType)}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--bg-border)",
              borderRadius: "7px",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontFamily: "Inter, sans-serif",
              padding: "6px 10px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id} style={{ background: "#111827" }}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
