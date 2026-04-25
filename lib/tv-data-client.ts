import WebSocket from 'ws';
import type { OHLCVCandle } from "@/types";

/**
 * Port of the TradingView WebSocket client from tv_server.py to TypeScript
 */

function generateSessionHash(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function prependHeader(msg: string): string {
  return `~m~${msg.length}~m~${msg}`;
}

function constructMessage(func: string, args: any[]): string {
  return JSON.stringify({ m: func, p: args });
}

export async function fetchCandlesFromTV(
  symbol: string,
  exchange: string,
  interval: string,
  bars: number = 300
): Promise<OHLCVCandle[]> {
  const symbolStr = `${exchange}:${symbol}`;
  const chartSession = "cs_" + generateSessionHash();
  const quoteSession = "qs_" + generateSessionHash();

  const tvIntervalMap: Record<string, string> = {
    "1h": "60",
    "4h": "240",
    "1d": "D",
    "1w": "W",
  };
  const tvInterval = tvIntervalMap[interval] || interval;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://data.tradingview.com/socket.io/websocket", {
        headers: {
            "Origin": "https://www.tradingview.com",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });

    let candles: OHLCVCandle[] = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error(`Timeout fetching data for ${symbol}`));
      }
    }, 30000);

    const sendMessage = (func: string, args: any[]) => {
      const msg = constructMessage(func, args);
      ws.send(prependHeader(msg));
    };

    ws.on('open', () => {
      // Initialization messages
      sendMessage("set_auth_token", ["unauthorized_user_token"]);
      sendMessage("chart_create_session", [chartSession, ""]);
      sendMessage("quote_create_session", [quoteSession]);
      sendMessage("quote_set_fields", [quoteSession, "lp", "last_price", "ch", "chp", "volume"]);
      sendMessage("quote_add_symbols", [quoteSession, symbolStr, { "flags": ["force_skipped"] }]);
      sendMessage("resolve_symbol", [chartSession, "sds_sym_1", `={"symbol":"${symbolStr}","adjustment":"splits"}`]);
      sendMessage("create_series", [chartSession, "sds_1", "s1", "sds_sym_1", tvInterval, bars, ""]);
    });

    ws.on('message', (data) => {
      const raw = data.toString();
      const messages = raw.split(/~m~\d+~m~/).filter(m => m.trim().startsWith('{'));

      for (const m of messages) {
        try {
          const json = JSON.parse(m);
          
          if (json.m === 'timescale_update') {
            const data = json.p[1]?.sds_1?.s;
            if (data && Array.isArray(data)) {
              candles = data.map(item => ({
                time: item.v[0],
                open: item.v[1],
                high: item.v[2],
                low: item.v[3],
                close: item.v[4],
                volume: item.v[5]
              }));
              
              if (candles.length > 0) {
                resolved = true;
                clearTimeout(timeout);
                ws.close();
                resolve(candles);
              }
            }
          } else if (json.m === 'critical_error' || json.m === 'error') {
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`TV Error: ${JSON.stringify(json.p)}`));
          }
        } catch (e) {
          // Ignore ping/pong or malformed JSON
        }
      }
    });

    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error("Connection closed before receiving data"));
      }
    });
  });
}

export async function fetchAllFundamentalsFromTV(): Promise<Record<string, any>> {
    const url = 'https://scanner.tradingview.com/egypt/scan';
    const payload = {
        'columns': ['description', 'price_earnings_ttm', 'market_cap_basic', 'debt_to_equity', 'long_term_debt_to_equity_fq'],
        'sort': { 'sortBy': 'name', 'sortOrder': 'asc' },
        'range': [0, 500]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const fundamentals: Record<string, any> = {};
        
        for (const item of data?.data || []) {
            const symbol = item.s.split(':').pop();
            fundamentals[symbol] = {
                pe: item.d[1],
                market_cap: item.d[2],
                debt_to_equity: item.d[3],
                ld_debt_to_equity: item.d[4]
            };
        }
        return fundamentals;
    } catch (e) {
        console.error("Market fundamentals fetch error:", e);
        return {};
    }
}
