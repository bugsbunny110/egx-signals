import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const COLUMNS = [
  "description",
  "Recommend.All",        // Overall TV recommendation: -1 to +1
  "Recommend.MA",         // Moving averages recommendation
  "Recommend.Other",      // Oscillators recommendation
  "RSI",                  // RSI 14
  "MACD.macd",            // MACD line
  "MACD.signal",          // MACD signal
  "Mom",                  // Momentum
  "volume",               // Current volume
  "change",               // Price change %
  "close",                // Current price
  "price_52_week_high",   // 52-week high
  "price_52_week_low",    // 52-week low
  "SMA200",               // 200-day SMA
  "SMA50",                // 50-day SMA
  "EMA20",                // 20-day EMA
  "Perf.1M",              // 1-month performance
  "Perf.3M",              // 3-month performance
  "price_earnings_ttm",   // P/E ratio
  "market_cap_basic",     // Market cap
  "debt_to_equity",       // Total D/E
  "long_term_debt_to_equity_fq", // LD D/E
];

function recommendLabel(val: number): string {
  if (val >= 0.5) return "Strong Buy";
  if (val >= 0.1) return "Buy";
  if (val > -0.1) return "Neutral";
  if (val > -0.5) return "Sell";
  return "Strong Sell";
}

function generateAIAnalysis(data: any): any {
  const {
    name, symbolKey,
    recommendAll, recommendMA, recommendOsc,
    rsi, macdLine, macdSignal,
    momentum, volume,
    changePercent, close,
    high52w, low52w,
    sma200, sma50, ema20,
    perf1m, perf3m,
    pe, marketCap, totalDE, ldDE,
  } = data;

  const bullishPoints: string[] = [];
  const bearishPoints: string[] = [];
  const neutralPoints: string[] = [];

  // --- RSI Analysis ---
  let rsiAnalysis = "";
  if (rsi < 30) {
    rsiAnalysis = `RSI at ${rsi?.toFixed(1)} is in oversold territory — historically a buy zone.`;
    bullishPoints.push(rsiAnalysis);
  } else if (rsi > 70) {
    rsiAnalysis = `RSI at ${rsi?.toFixed(1)} is overbought — potential near-term pullback risk.`;
    bearishPoints.push(rsiAnalysis);
  } else if (rsi >= 50) {
    rsiAnalysis = `RSI at ${rsi?.toFixed(1)} shows positive momentum above the midline.`;
    bullishPoints.push(rsiAnalysis);
  } else {
    rsiAnalysis = `RSI at ${rsi?.toFixed(1)} is below the midline — momentum is weakening.`;
    bearishPoints.push(rsiAnalysis);
  }

  // --- MACD Analysis ---
  let macdAnalysis = "";
  const macdCross = macdLine - macdSignal;
  if (macdCross > 0 && macdLine > 0) {
    macdAnalysis = `MACD is bullish — positive crossover above zero line.`;
    bullishPoints.push(macdAnalysis);
  } else if (macdCross > 0 && macdLine <= 0) {
    macdAnalysis = `MACD just crossed above signal line — early bullish signal.`;
    bullishPoints.push(macdAnalysis);
  } else if (macdCross < 0 && macdLine < 0) {
    macdAnalysis = `MACD is negative and below signal — bearish momentum active.`;
    bearishPoints.push(macdAnalysis);
  } else {
    macdAnalysis = `MACD crossed below signal line — potential trend reversal downward.`;
    bearishPoints.push(macdAnalysis);
  }

  // --- Moving Averages ---
  let maAnalysis = "";
  if (close > sma200 && close > sma50) {
    maAnalysis = `Price is trading above both SMA50 and SMA200 — strong uptrend.`;
    bullishPoints.push(maAnalysis);
  } else if (close > sma200 && close <= sma50) {
    maAnalysis = `Price is above SMA200 but below SMA50 — medium-term consolidation.`;
    neutralPoints.push(maAnalysis);
  } else if (close < sma200) {
    maAnalysis = `Price is below the 200-day moving average — in a long-term downtrend.`;
    bearishPoints.push(maAnalysis);
  }

  // --- 52-Week Position ---
  const range52w = high52w - low52w;
  const posInRange = range52w > 0 ? ((close - low52w) / range52w) * 100 : 50;
  let rangeAnalysis = "";
  if (posInRange > 80) {
    rangeAnalysis = `Trading near 52-week highs (${posInRange.toFixed(0)}% of range) — strong relative strength.`;
    bullishPoints.push(rangeAnalysis);
  } else if (posInRange < 20) {
    rangeAnalysis = `Trading near 52-week lows (${posInRange.toFixed(0)}% of range) — potential reversal zone.`;
    bearishPoints.push(rangeAnalysis);
  } else {
    rangeAnalysis = `Price is ${posInRange.toFixed(0)}% through its 52-week range — mid-channel.`;
    neutralPoints.push(rangeAnalysis);
  }

  // --- Fundamentals ---
  let fundamentalAnalysis = "";
  if (pe && pe > 0) {
    if (pe < 10) {
      fundamentalAnalysis = `P/E ratio of ${pe.toFixed(1)}x is low — potentially undervalued.`;
      bullishPoints.push(fundamentalAnalysis);
    } else if (pe < 25) {
      fundamentalAnalysis = `P/E ratio of ${pe.toFixed(1)}x is reasonable for a growth stock.`;
      bullishPoints.push(fundamentalAnalysis);
    } else {
      fundamentalAnalysis = `P/E ratio of ${pe.toFixed(1)}x is elevated — priced for growth expectations.`;
      neutralPoints.push(fundamentalAnalysis);
    }
  }

  if (totalDE !== null && totalDE !== undefined) {
    if (totalDE > 1.5) {
      bearishPoints.push(`High debt-to-equity ratio of ${(totalDE * 100).toFixed(0)}% signals financial risk.`);
    } else if (totalDE < 0.5) {
      bullishPoints.push(`Low debt-to-equity of ${(totalDE * 100).toFixed(0)}% indicates a clean balance sheet.`);
    }
  }

  if (marketCap) {
    const capB = marketCap / 1_000_000_000;
    if (capB > 10) {
      bullishPoints.push(`Large-cap with market cap of ${capB.toFixed(1)}B EGP — institutions are likely active.`);
    } else if (capB > 1) {
      neutralPoints.push(`Mid-cap with market cap of ${capB.toFixed(1)}B EGP.`);
    } else {
      bearishPoints.push(`Small-cap (${capB.toFixed(2)}B EGP) — higher volatility and liquidity risk.`);
    }
  }

  // --- Performance ---
  if (perf1m !== null && perf1m !== undefined) {
    if (perf1m > 10) {
      bullishPoints.push(`Outperformed last month: +${perf1m.toFixed(1)}% in 30 days.`);
    } else if (perf1m < -10) {
      bearishPoints.push(`Underperformed last month: ${perf1m.toFixed(1)}% in 30 days.`);
    }
  }

  // --- Overall TV Signal ---
  const tvSignalLabel = recommendLabel(recommendAll);
  const tvMALabel = recommendLabel(recommendMA);
  const tvOscLabel = recommendLabel(recommendOsc);

  // --- Big Traders Heuristic ---
  // High volume + positive change = institutional accumulation
  const bigTradersSignal =
    changePercent > 0 && volume > 1_000_000
      ? "Possible institutional accumulation — above-average volume on a green day."
      : changePercent < 0 && volume > 1_000_000
      ? "Possible institutional distribution — above-average volume on a red day."
      : "Retail-driven trading; no clear institutional footprint detected today.";

  // --- Final Verdict ---
  const score = bullishPoints.length - bearishPoints.length;
  const overallRecommend = recommendAll ?? 0;

  let aiVerdict = "";
  let verdictEmoji = "";
  let verdictColor = "";

  const combinedScore = score + (overallRecommend > 0.1 ? 1 : overallRecommend < -0.1 ? -1 : 0);

  if (combinedScore >= 3) {
    aiVerdict = `Strong case to BUY ${symbolKey} now. Multiple bullish signals align across technicals and fundamentals.`;
    verdictEmoji = "🟢";
    verdictColor = "buy";
  } else if (combinedScore >= 1) {
    aiVerdict = `Cautiously bullish on ${symbolKey}. Conditions favor buying, but consider waiting for a minor dip or confirmation candle.`;
    verdictEmoji = "🟡";
    verdictColor = "neutral";
  } else if (combinedScore === 0) {
    aiVerdict = `Mixed signals on ${symbolKey}. Risk/reward is balanced — monitor closely and do not rush an entry.`;
    verdictEmoji = "⚪";
    verdictColor = "neutral";
  } else {
    aiVerdict = `Caution advised on ${symbolKey}. Bearish factors outweigh bullish ones — wait for reversal confirmation before buying.`;
    verdictEmoji = "🔴";
    verdictColor = "sell";
  }

  // --- TP / SL Calculation ---
  // Support levels: EMA20 > SMA50 > SMA200 (use closest below price)
  const supports = [ema20, sma50, sma200].filter(
    (v) => v != null && v < close
  ).sort((a, b) => b - a); // sort descending, closest support first

  // Resistance levels: 52-week high, then price + ATR estimate
  // ATR approximation: 1.5% of price for EGX mid-cap stocks
  const atrEstimate = close * 0.015;

  // Stop Loss: below the nearest support, OR 4% below price if no support found
  const slBase = supports.length > 0 ? supports[0] : close;
  const stopLoss = parseFloat((Math.min(slBase - atrEstimate * 0.5, close * 0.96)).toFixed(4));

  // Risk = entry price - stop loss
  const riskPerShare = close - stopLoss;

  // TP1: 1.5× risk (conservative target)
  const tp1 = parseFloat((close + riskPerShare * 1.5).toFixed(4));

  // TP2: 2.5× risk (main target, next resistance)
  const tp2 = parseFloat((close + riskPerShare * 2.5).toFixed(4));

  // TP3: 52-week high or 4× risk (extended target)
  const tp3Raw = Math.max(close + riskPerShare * 4, high52w ?? close * 1.2);
  const tp3 = parseFloat(tp3Raw.toFixed(4));

  // Risk/Reward ratios
  const rr1 = parseFloat(((tp1 - close) / riskPerShare).toFixed(1));
  const rr2 = parseFloat(((tp2 - close) / riskPerShare).toFixed(1));
  const rr3 = parseFloat(((tp3 - close) / riskPerShare).toFixed(1));

  // SL % from entry
  const slPct = parseFloat(((stopLoss - close) / close * 100).toFixed(1));
  const tp1Pct = parseFloat(((tp1 - close) / close * 100).toFixed(1));
  const tp2Pct = parseFloat(((tp2 - close) / close * 100).toFixed(1));
  const tp3Pct = parseFloat(((tp3 - close) / close * 100).toFixed(1));

  return {
    symbolKey,
    name,
    tvRecommendation: {
      overall: { label: tvSignalLabel, value: recommendAll },
      movingAverages: { label: tvMALabel, value: recommendMA },
      oscillators: { label: tvOscLabel, value: recommendOsc },
    },
    technicals: {
      rsi: rsi ?? null,
      macd: macdLine ?? null,
      macdSignal: macdSignal ?? null,
      momentum: momentum ?? null,
      close: close ?? null,
      sma50: sma50 ?? null,
      sma200: sma200 ?? null,
      ema20: ema20 ?? null,
      high52w: high52w ?? null,
      low52w: low52w ?? null,
      posIn52wRange: posInRange,
      changePercent: changePercent ?? null,
      perf1m: perf1m ?? null,
      perf3m: perf3m ?? null,
      volume: volume ?? null,
    },
    fundamentals: {
      pe: pe ?? null,
      marketCap: marketCap ?? null,
      totalDE: totalDE ?? null,
      ldDE: ldDE ?? null,
    },
    tradeSetup: {
      entryPrice: close,
      stopLoss,
      slPct,
      tp1, tp1Pct, rr1,
      tp2, tp2Pct, rr2,
      tp3, tp3Pct, rr3,
      supportUsedForSL: supports.length > 0 ? supports[0] : null,
    },
    analysis: {
      bullishPoints,
      bearishPoints,
      neutralPoints,
      bigTradersOpinion: bigTradersSignal,
      aiVerdict,
      verdictEmoji,
      verdictColor,
    },
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const tvRes = await fetch("https://scanner.tradingview.com/egypt/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        columns: COLUMNS,
        symbols: { tickers: [`EGX:${symbol}`] },
        markets: ["egypt"],
      }),
    });

    if (!tvRes.ok) throw new Error("TradingView scanner failed");

    const tvData = await tvRes.json();
    const row = tvData?.data?.[0];
    if (!row) throw new Error("Symbol not found in TradingView");

    const [
      name, recommendAll, recommendMA, recommendOsc,
      rsi, macdLine, macdSignal, momentum,
      volume, changePercent, close,
      high52w, low52w, sma200, sma50, ema20,
      perf1m, perf3m, pe, marketCap, totalDE, ldDE,
    ] = row.d;

    const result = generateAIAnalysis({
      name, symbolKey: symbol,
      recommendAll, recommendMA, recommendOsc,
      rsi, macdLine, macdSignal, momentum,
      volume, changePercent, close,
      high52w, low52w, sma200, sma50, ema20,
      perf1m, perf3m, pe, marketCap, totalDE, ldDE,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
