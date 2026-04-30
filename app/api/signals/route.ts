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
  interval: "1h" | "4h" | "30",
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
  const debug = searchParams.get("debug") === "true";

  const intervals: ("1h" | "4h")[] = intervalFilter ? [intervalFilter] : ["1h", "4h"];
  const symbolsToScan = symbolFilter
    ? EGX_SYMBOLS.filter((s) => s.symbol === symbolFilter)
    : EGX_SYMBOLS;

  // BATCH FETCH: Get ALL recommendations and change % in one go
  const batchData = new Map<string, { rec: number, chg: number, yChg?: number | null }>();
  let rawTvData = null;
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
    rawTvData = tvData;
    tvData?.data?.forEach((row: any) => {
      // Handle symbols like "EGX:COMI" or "EGX:COMI.CA"
      let ticker = row.s.split(':')[1];
      if (ticker.includes('.')) ticker = ticker.split('.')[0]; 
      
      batchData.set(ticker, { 
        rec: row.d[0], 
        chg: row.d[1]
      });
    });
  } catch (e) { console.error("Batch fetch failed:", e); }

  const results: StockSignal[] = [];
  let errors = 0;

  for (const { symbol, name, shortName, tvSymbol } of symbolsToScan) {
    const tvInfo = batchData.get(symbol);
    
    // AI Verdict logic
    let aiVerdict = "Neutral";
    let aiVerdictColor = "neutral";
    if (tvInfo && tvInfo.rec !== undefined && tvInfo.rec !== null) {
      const rec = tvInfo.rec;
      if (rec >= 0.5) { aiVerdict = "Strong Buy"; aiVerdictColor = "buy"; }
      else if (rec >= 0.1) { aiVerdict = "Buy"; aiVerdictColor = "buy"; }
      else if (rec <= -0.5) { aiVerdict = "Strong Sell"; aiVerdictColor = "sell"; }
      else if (rec <= -0.1) { aiVerdict = "Sell"; aiVerdictColor = "sell"; }
    }

    for (const interval of intervals) {
      try {
        // Parallel fetch for main candles and 30m candles for RVOL
        const [candles, candles30m] = await Promise.all([
          fetchCandles(symbol, "EGX", interval, 300),
          fetchCandles(symbol, "EGX", "30", 120) // ~12-14 trading days
        ]);
        
        const engineRes = runSignalEngine(candles);

        // Calculate Relative Volume for first 30 mins (10:00 - 10:30 Cairo / 07:00 UTC)
        let relativeVolume30m = null;
        if (candles30m.length > 20) {
          const openingVolumes: { date: string, volume: number }[] = [];
          const daysFound = new Set<string>();
          
          // Group 30m candles by day
          for (let i = 0; i < candles30m.length; i++) {
            const date = candles30m[i].datetime.substring(0, 10);
            const time = candles30m[i].datetime.substring(11, 16); // "HH:mm" in UTC
            
            if (!daysFound.has(date)) {
              daysFound.add(date);
              // Strictly check for the opening candle (07:00 UTC = 10:00 AM Cairo)
              if (time === "07:00") {
                openingVolumes.push({ date, volume: candles30m[i].volume });
              } else {
                // If first candle is later than 07:00, it means 0 volume in the first 30m
                openingVolumes.push({ date, volume: 0 });
              }
            }
          }
          
          if (openingVolumes.length >= 2) {
            const todayStat = openingVolumes[openingVolumes.length - 1];
            const previousStats = openingVolumes.slice(0, -1).slice(-10); // Last 10 days
            
            if (previousStats.length > 0) {
              const avgPrevVol = previousStats.reduce((a, b) => a + b.volume, 0) / previousStats.length;
              // If today's opening candle (07:00) wasn't found in the loop above, todayStat.volume will be 0
              relativeVolume30m = avgPrevVol > 0 ? todayStat.volume / avgPrevVol : 0;
            }
          }
        }

        // Calculate Yesterday's Change % and Today's Gap % from the candles
        let yesterdayChange = null;
        let gapPercent = null;
        
        if (candles.length > 20) {
          const dayStats: { date: string, open: number, close: number }[] = [];
          let currentDay: { date: string, open: number, close: number } | null = null;

          for (let i = 0; i < candles.length; i++) {
            const date = candles[i].datetime.substring(0, 10);
            if (!currentDay || date !== currentDay.date) {
              if (currentDay) dayStats.push(currentDay);
              currentDay = { date, open: candles[i].open, close: candles[i].close };
            } else {
              currentDay.close = candles[i].close;
            }
          }
          if (currentDay) dayStats.push(currentDay);

          if (dayStats.length >= 3) {
            // dayStats[last] is today
            // dayStats[last-1] is yesterday
            // dayStats[last-2] is day-before-yesterday
            
            // Yesterday's Change: (Yesterday Close - PrevDay Close) / PrevDay Close
            const yesterdayClose = dayStats[dayStats.length - 2].close;
            const prevDayClose = dayStats[dayStats.length - 3].close;
            yesterdayChange = ((yesterdayClose - prevDayClose) / prevDayClose) * 100;

            // Today's Gap: (Today Open - Yesterday Close) / Yesterday Close
            const todayOpen = dayStats[dayStats.length - 1].open;
            gapPercent = ((todayOpen - yesterdayClose) / yesterdayClose) * 100;
          }
        }
        
        results.push({
          symbol,
          name,
          shortName,
          tvSymbol,
          timeframe: interval,
          price: candles[candles.length - 1]?.close,
          changePercent: tvInfo?.chg ?? 0, 
          yesterdayChangePercent: yesterdayChange,
          gapPercent: gapPercent,
          relativeVolume30m: relativeVolume30m,
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
    }
  }

  const response: any = {
    stocks: results,
    scannedAt: new Date().toISOString(),
    totalScanned: results.length,
    errors,
  };

  if (debug) {
    response.debug = {
      tvCount: rawTvData?.totalCount,
      mappedSymbols: Array.from(batchData.keys()),
    };
  }

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
