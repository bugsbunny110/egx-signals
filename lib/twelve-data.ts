import type { OHLCVCandle } from "@/types";
import { fetchCandlesFromTV, fetchAllFundamentalsFromTV } from "./tv-data-client";

// In-memory cache: key → { data, expiresAt }
const cache = new Map<string, { data: OHLCVCandle[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute (allows fresh intra-candle data)

export async function fetchCandles(
  symbol: string,
  exchange: string,
  interval: "1h" | "4h" | "30",
  bars = 300
): Promise<OHLCVCandle[]> {
  const cacheKey = `${exchange}:${symbol}:${interval}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const candles = await fetchCandlesFromTV(symbol, exchange, interval, bars);

    cache.set(cacheKey, {
      data: candles,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return candles;
  } catch (err) {
    const msg = (err as Error).message;
    throw new Error(`Failed to fetch ${symbol} (${interval}): ${msg}`);
  }
}

export function clearCache() {
  cache.clear();
}

export async function fetchFundamentals(): Promise<Record<string, any>> {
  try {
    return await fetchAllFundamentalsFromTV();
  } catch (e) {
    console.error("Failed to fetch fundamentals:", e);
    return {};
  }
}
