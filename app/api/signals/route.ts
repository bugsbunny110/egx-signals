import { NextRequest, NextResponse } from "next/server";
import { EGX_SYMBOLS } from "@/lib/egx-symbols";
import { fetchCandles } from "@/lib/twelve-data";
import { runSignalEngine } from "@/lib/signal-engine";
import type { StockSignal, SignalsResponse } from "@/types";

// Next.js Route Segment Config — no caching at edge, handled internally
export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel Free limit is 10s

export async function scanSymbol(
  symbol: string,
  name: string,
  interval: "1h" | "4h",
  shortName?: string,
  tvSymbol?: string
): Promise<StockSignal> {
  try {
    // fetchCandles now talks to local TradingView data server
    const candles = await fetchCandles(symbol, "EGX", interval, 300);
    const result = runSignalEngine(candles);
    
    // Fetch recommendation for verdict
    let aiVerdict = "Neutral";
    let aiVerdictColor = "neutral";
    let changePercent: number | undefined = undefined;
    try {
      const tvRes = await fetch("https://scanner.tradingview.com/egypt/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({
          columns: ["Recommend.All", "change"],
          symbols: { tickers: [`EGX:${symbol}`] },
        }),
      });
      const tvData = await tvRes.json();
      const rowData = tvData?.data?.[0]?.d;
      const rec = rowData?.[0];
      const chg = rowData?.[1];
      
      if (chg !== undefined) changePercent = chg;
      
      if (rec !== undefined) {
        if (rec >= 0.5) { aiVerdict = "Strong Buy"; aiVerdictColor = "buy"; }
        else if (rec >= 0.1) { aiVerdict = "Buy"; aiVerdictColor = "buy"; }
        else if (rec <= -0.5) { aiVerdict = "Strong Sell"; aiVerdictColor = "sell"; }
        else if (rec <= -0.1) { aiVerdict = "Sell"; aiVerdictColor = "sell"; }
      }
    } catch (e) { /* fallback */ }

    return {
      symbol,
      name,
      shortName,
      tvSymbol,
      timeframe: interval,
      price: candles[candles.length - 1]?.close,
      changePercent,
      aiVerdict,
      aiVerdictColor,
      signal: result.signal,
      candlesAgo: result.candlesAgo,
      currentState: result.currentState,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      symbol,
      name,
      shortName,
      tvSymbol,
      timeframe: interval,
      signal: "none",
      candlesAgo: null,
      currentState: 0,
      lastUpdated: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolFilter = searchParams.get("symbol");
  const intervalFilter = searchParams.get("interval") as "1h" | "4h" | null;

  const intervals: ("1h" | "4h")[] = intervalFilter ? [intervalFilter] : ["1h", "4h"];
  const symbolsToScan = symbolFilter
    ? EGX_SYMBOLS.filter((s) => s.symbol === symbolFilter)
    : EGX_SYMBOLS;

  // BATCH FETCH: Get ALL recommendations and change % in one go
  const batchData = new Map<string, { rec: number, chg: number }>();
  try {
    const tvRes = await fetch("https://scanner.tradingview.com/egypt/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        columns: ["Recommend.All", "change"],
        symbols: { tickers: symbolsToScan.map(s => `EGX:${s.symbol}`) },
      }),
    });
    const tvData = await tvRes.json();
    tvData?.data?.forEach((row: any) => {
      const ticker = row.s.split(':')[1];
      batchData.set(ticker, { rec: row.d[0], chg: row.d[1] });
    });
  } catch (e) { console.error("Batch fetch failed:", e); }

  const results: StockSignal[] = [];
  let errors = 0;

  for (const { symbol, name, shortName, tvSymbol } of symbolsToScan) {
    const tvInfo = batchData.get(symbol);
    
    // AI Verdict logic
    let aiVerdict = "Neutral";
    let aiVerdictColor = "neutral";
    if (tvInfo && tvInfo.rec !== undefined) {
      const rec = tvInfo.rec;
      if (rec >= 0.5) { aiVerdict = "Strong Buy"; aiVerdictColor = "buy"; }
      else if (rec >= 0.1) { aiVerdict = "Buy"; aiVerdictColor = "buy"; }
      else if (rec <= -0.5) { aiVerdict = "Strong Sell"; aiVerdictColor = "sell"; }
      else if (rec <= -0.1) { aiVerdict = "Sell"; aiVerdictColor = "sell"; }
    }

    for (const interval of intervals) {
      try {
        const candles = await fetchCandles(symbol, "EGX", interval, 300);
        const engineRes = runSignalEngine(candles);
        
        results.push({
          symbol,
          name,
          shortName,
          tvSymbol,
          timeframe: interval,
          price: candles[candles.length - 1]?.close,
          changePercent: tvInfo?.chg,
          aiVerdict,
          aiVerdictColor,
          signal: engineRes.signal,
          candlesAgo: engineRes.candlesAgo,
          currentState: engineRes.currentState,
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        errors++;
        results.push({
          symbol, name, shortName, tvSymbol, timeframe: interval,
          signal: "none", candlesAgo: null, currentState: 0,
          lastUpdated: new Date().toISOString(),
          error: (err as Error).message,
        });
      }
      // Small delay still needed for Twelve Data if used, but fetchCandles is local now
    }
  }

  const response: SignalsResponse = {
    stocks: results,
    scannedAt: new Date().toISOString(),
    totalScanned: results.length,
    errors,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
