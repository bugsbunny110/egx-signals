import { NextRequest, NextResponse } from "next/server";
import { EGX_SYMBOLS } from "@/lib/egx-symbols";
import { scanSymbol } from "@/app/api/signals/route";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel Free limit

// Technical indicators to find candidate stocks quickly
const SCANNER_COLUMNS = [
  "name",
  "close",
  "EMA20",
  "SMA50",
  "RSI",
  "change",
];

function isEgyptMarketOpen(): boolean {
  const now = new Date();
  
  // Get direct Cairo timezone details
  const cairoFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });

  const parts = cairoFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  
  const weekday = getPart("weekday");
  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);

  // Egypt trading days: Sunday through Thursday
  const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  if (!validDays.includes(weekday)) {
    return false;
  }

  // Egypt trading hours: 10:00 AM to 2:30 PM
  const timeInMinutes = hour * 60 + minute;
  const marketOpenMinutes = 10 * 60; // 10:00 AM
  const marketCloseMinutes = 14 * 60 + 30; // 2:30 PM

  return timeInMinutes >= marketOpenMinutes && timeInMinutes <= marketCloseMinutes;
}

export async function GET(req: NextRequest) {
  // CRON Security Check
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  // Enforce Cairo market open hours unless forced via debug query param
  if (!force && !isEgyptMarketOpen()) {
    console.log("Cairo market is closed. Skipping scan.");
    return NextResponse.json({
      success: true,
      message: "Market is currently closed. Scan skipped."
    });
  }

  try {
    console.log("Starting 24/7 Background H1 Scan during market open hours...");
    
    // 1. FAST FILTER (Get market summary in 1 request)
    const scanUrl = 'https://scanner.tradingview.com/egypt/scan';
    const scanRes = await fetch(scanUrl, {
      method: "POST",
      body: JSON.stringify({
        columns: SCANNER_COLUMNS,
        range: [0, 500],
        sort: { sortBy: "change", sortOrder: "desc" }
      })
    });
    
    const scanData = await scanRes.json();
    const hotSymbols: string[] = [];

    // Broadened filter to capture any stock with positive/bullish momentum early
    for (const item of scanData.data || []) {
      const symbol = item.s.split(':').pop();
      const close = item.d[1];
      const ema20 = item.d[2];
      const rsi = item.d[4];
      const change = item.d[5];
      
      if (change >= -3 || rsi > 40 || close > ema20) {
        hotSymbols.push(symbol);
      }
    }

    console.log(`Pre-filtered ${hotSymbols.length} candidate stocks.`);

    // Pick top 25 candidate symbols to check within serverless execution limit
    const targets = hotSymbols.slice(0, 25); 
    const alerts: string[] = [];

    await Promise.all(targets.map(async (symCode) => {
      try {
        const fullSym = EGX_SYMBOLS.find(s => s.symbol === symCode);
        const stock = await scanSymbol(
          symCode, 
          fullSym?.name || symCode, 
          "1h", 
          fullSym?.shortName, 
          fullSym?.tvSymbol
        );

        // Notify for LIVE signals (candlesAgo === 0)
        if (stock && stock.candlesAgo === 0) {
           const verdict = stock.aiVerdict ? ` [${stock.aiVerdict.toUpperCase()}]` : "";
           const chgStr = stock.changePercent !== undefined ? ` (${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%)` : "";
           
           if (stock.signal === "buy") {
             alerts.push(`🟢 <b>BUY SIGNAL (LIVE)</b>${verdict}\nStock: <b>${symCode}</b>\nTimeframe: H1\nPrice: ${stock.price?.toFixed(2) || "N/A"}${chgStr}\n\n<i>Check dashboard for TP/SL targets.</i>`);
           } else if (stock.signal === "exit_long") {
             alerts.push(`🟠 <b>EXIT BUY (LIVE)</b>\nStock: <b>${symCode}</b>\nTimeframe: H1\nPrice: ${stock.price?.toFixed(2) || "N/A"}${chgStr}\n\n<i>Time to secure profits!</i>`);
           }
        }
      } catch (e) {
        // Skip errors in background
      }
    }));

    // 3. SEND TELEGRAM ALERTS
    if (alerts.length > 0) {
      for (const alert of alerts) {
        await sendTelegramAlert(alert);
      }
    }

    return NextResponse.json({ 
      success: true, 
      scannedCandidates: targets.length, 
      alertsSent: alerts.length 
    });

  } catch (err) {
    console.error("Cron Scan Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
