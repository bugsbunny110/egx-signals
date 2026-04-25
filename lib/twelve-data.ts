import type { OHLCVCandle } from "@/types";

const TV_SERVER_BASE = "http://localhost:8765";

// In-memory cache: key → { data, expiresAt }
const cache = new Map<string, { data: OHLCVCandle[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute (allows fresh intra-candle data)

// Simple queue to avoid hammering the WS server
let lastRequestTime = 0;
const MIN_REQUEST_GAP_MS = 300;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(35000) }); // 35s timeout (TV WS can be slow)
}

interface TVServerResponse {
  symbol: string;
  exchange: string;
  interval: string;
  candles: OHLCVCandle[];
  cached: boolean;
  count: number;
  error?: string;
}

export async function fetchCandles(
  symbol: string,
  exchange: string,
  interval: "1h" | "4h",
  bars = 300
): Promise<OHLCVCandle[]> {
  const cacheKey = `${exchange}:${symbol}:${interval}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `${TV_SERVER_BASE}/candles?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&interval=${interval}&bars=${bars}`;

  try {
    const res = await throttledFetch(url);

    if (!res.ok) {
      throw new Error(`TV server HTTP ${res.status}`);
    }

    const json: TVServerResponse = await res.json();

    if (json.error) {
      throw new Error(json.error);
    }

    if (!json.candles || json.candles.length === 0) {
      throw new Error(`No candles returned for ${symbol}`);
    }

    const candles = json.candles; // already in chronological order (oldest→newest)

    cache.set(cacheKey, {
      data: candles,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return candles;
  } catch (err) {
    const msg = (err as Error).message;

    // Provide helpful error if Python server isn't running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw new Error(
        "TradingView data server not running — start it with: python3 tv_server.py"
      );
    }

    throw new Error(`Failed to fetch ${symbol} (${interval}): ${msg}`);
  }
}

export function clearCache() {
  cache.clear();
}
export async function fetchFundamentals(): Promise<Record<string, any>> {
  try {
    const res = await fetch("http://localhost:8765/fundamentals");
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    console.error("Failed to fetch fundamentals:", e);
    return {};
  }
}
