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

    return {
      symbol,
      name,
      shortName,
      tvSymbol,
      timeframe: interval,
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
  const symbolFilter = searchParams.get("symbol"); // optional single symbol
  const intervalFilter = searchParams.get("interval") as "1h" | "4h" | null;

  const intervals: ("1h" | "4h")[] = intervalFilter
    ? [intervalFilter]
    : ["1h", "4h"];

  const symbolsToScan = symbolFilter
    ? EGX_SYMBOLS.filter((s) => s.symbol === symbolFilter)
    : EGX_SYMBOLS;

  const results: StockSignal[] = [];
  let errors = 0;

  for (const { symbol, name, shortName, tvSymbol } of symbolsToScan) {
    for (const interval of intervals) {
      const result = await scanSymbol(symbol, name, interval, shortName, tvSymbol);
      results.push(result);
      if (result.error) errors++;
      // Small delay between WebSocket sessions to prevent overloading
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const response: SignalsResponse = {
    stocks: results,
    scannedAt: new Date().toISOString(),
    totalScanned: symbolsToScan.length * intervals.length,
    errors,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
