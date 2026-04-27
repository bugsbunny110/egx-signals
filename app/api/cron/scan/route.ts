import { NextRequest, NextResponse } from "next/server";
import { EGX_SYMBOLS } from "@/lib/egx-symbols";
import { scanSymbol } from "@/app/api/signals/route";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Vercel Free limit

// Technical indicators to find "Hot" stocks quickly
const SCANNER_COLUMNS = [
  "name",
  "close",
  "EMA20",
  "SMA50",
  "RSI",
  "change",
];

export async function GET(req: NextRequest) {
  // CRON Security Check (Vercel adds this header)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log("Starting 24/7 Background H1 Scan...");
    
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

    // Only pick stocks that look like they MIGHT have a signal (Price > EMA20 and RSI > 50)
    for (const item of scanData.data || []) {
      const symbol = item.s.split(':').pop();
      const close = item.d[1];
      const ema20 = item.d[2];
      const rsi = item.d[4];
      
      // Basic "Bullish Zone" filter
      if (close > ema20 || rsi > 50) {
        hotSymbols.push(symbol);
      }
    }

    console.log(`Pre-filtered ${hotSymbols.length} candidate stocks.`);

    // 2. TARGETED AI SCAN (Deep scan only the hot ones)
    // We only have time for ~3-5 deep scans in a 10s serverless window
    // We focus on the ones with highest volume/change or just a subset
    const targets = hotSymbols.slice(0, 15); 
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

        // ONLY Notify for LIVE signals (candlesAgo === 0)
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
