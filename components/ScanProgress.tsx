"use client";

interface ScanProgressProps {
  current: number;
  total: number;
  currentSymbol: string;
}

export function ScanProgress({ current, total, currentSymbol }: ScanProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--bg-border)",
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
        textAlign: "center",
      }}
    >
      {/* Spinning icon */}
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid var(--bg-border)",
          borderTopColor: "var(--color-gold)",
          borderRadius: "50%",
          margin: "0 auto 16px",
        }}
        className="spin"
      />

      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "6px",
        }}
      >
        Scanning EGX Markets...
      </div>

      {currentSymbol && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
            marginBottom: "16px",
          }}
        >
          Analyzing {currentSymbol}
        </div>
      )}

      {/* Progress bar */}
      <div className="progress-bar-track" style={{ marginBottom: "8px" }}>
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {current} / {total} stocks · {pct}%
      </div>
    </div>
  );
}
