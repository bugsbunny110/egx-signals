/**
 * Karim EGX Signal Engine
 * TypeScript port of the Karim EGX Pine Script indicator
 */

import type { OHLCVCandle, SignalResult, SignalType } from "@/types";

// --- Math helpers ---

function rma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const alpha = 1 / period;

  // Find the first index where values[i] is NOT NaN
  let firstValidIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) {
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) return result;

  // Let's seed with SMA of the first `period` valid values
  let sum = 0;
  let count = 0;
  for (let i = firstValidIndex; i < values.length; i++) {
    if (isNaN(values[i])) continue;
    sum += values[i];
    count++;
    if (count === period) {
      result[i] = sum / period;
      let lastRMA = result[i];
      for (let j = i + 1; j < values.length; j++) {
        if (!isNaN(values[j])) {
          result[j] = alpha * values[j] + (1 - alpha) * lastRMA;
          lastRMA = result[j];
        } else {
          result[j] = NaN;
        }
      }
      break;
    }
  }

  return result;
}

function rsi(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  const up: number[] = new Array(closes.length).fill(NaN);
  const down: number[] = new Array(closes.length).fill(NaN);

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    up[i] = diff > 0 ? diff : 0;
    down[i] = diff < 0 ? -diff : 0;
  }

  const rmaUp = rma(up, period);
  const rmaDown = rma(down, period);

  for (let i = period; i < closes.length; i++) {
    const u = rmaUp[i];
    const d = rmaDown[i];

    if (isNaN(u) || isNaN(d)) {
      result[i] = NaN;
    } else if (d === 0) {
      result[i] = u === 0 ? 50 : 100;
    } else if (u === 0) {
      result[i] = 0;
    } else {
      const rs = u / d;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    const slice = values.slice(i - period + 1, i + 1);
    if (slice.some((v) => isNaN(v))) {
      result[i] = NaN;
    } else {
      result[i] = slice.reduce((a, b) => a + b, 0) / period;
    }
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);

  let firstValidIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) {
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) return result;

  let sum = 0;
  let count = 0;
  for (let i = firstValidIndex; i < values.length; i++) {
    if (isNaN(values[i])) continue;
    sum += values[i];
    count++;
    if (count === period) {
      result[i] = sum / period;
      let lastEMA = result[i];
      for (let j = i + 1; j < values.length; j++) {
        if (!isNaN(values[j])) {
          result[j] = values[j] * k + lastEMA * (1 - k);
          lastEMA = result[j];
        } else {
          result[j] = NaN;
        }
      }
      break;
    }
  }

  return result;
}

// --- Main Signal Engine ---

export function runSignalEngine(candles: OHLCVCandle[]): SignalResult {
  const n = candles.length;

  const minRequired = 85;
  if (n < minRequired) {
    return {
      signal: "none",
      candlesAgo: null,
      currentState: 0,
      lastSignalBar: null,
    };
  }

  const closes = candles.map((c) => c.close);

  // 1. Calculate RSI(close, 50) and rsiBanker
  const rsiValues = rsi(closes, 50);
  const rsiBanker: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (!isNaN(rsiValues[i])) {
      let val = 1.5 * (rsiValues[i] - 50);
      if (val > 20) val = 20;
      if (val < 0) val = 0;
      rsiBanker[i] = val;
    }
  }

  // 1b. Calculate RSI(close, 40) and rsiHotMoney
  const rsiHotMoneyValues = rsi(closes, 40);
  const rsiHotMoney: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (!isNaN(rsiHotMoneyValues[i])) {
      let val = 0.7 * (rsiHotMoneyValues[i] - 30);
      if (val > 20) val = 20;
      if (val < 0) val = 0;
      rsiHotMoney[i] = val;
    }
  }

  // 2. Moving averages on rsiBanker
  const bankma2 = sma(rsiBanker, 2);
  const bankma7 = ema(rsiBanker, 7);
  const bankma31 = ema(rsiBanker, 31);

  // 3. Combined bankma
  const bankma: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(bankma2[i]) && !isNaN(bankma7[i]) && !isNaN(bankma31[i])) {
      bankma[i] = (bankma2[i] * 70 + bankma7[i] * 20 + bankma31[i] * 10) / 100;
    }
  }

  // 4. Smoothing via rma to get banksignal
  const banksignal = rma(bankma, 4);

  // 4b. Hot Money calculations
  const hotma2 = rma(rsiHotMoney, 2);
  const hotma7 = rma(rsiHotMoney, 7);
  const hotma31 = rma(rsiHotMoney, 31);

  const hotCombined: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(hotma2[i]) && !isNaN(hotma7[i]) && !isNaN(hotma31[i])) {
      hotCombined[i] = (hotma2[i] * 34 + hotma7[i] * 33 + hotma31[i] * 33) / 100;
    }
  }

  const hotma = ema(hotCombined, 2);
  const hotsignal = rma(hotma, 2);

  // 5. Signals & State determination
  let lastSignalBar: number | null = null;
  let lastSignalType: SignalType = "none";

  for (let i = 1; i < n; i++) {
    if (isNaN(banksignal[i]) || isNaN(banksignal[i - 1])) continue;

    const buyCrossover = banksignal[i] > 0.1 && banksignal[i - 1] <= 0.1;

    const rsiBankerCrossunder = 
      !isNaN(rsiBanker[i]) && 
      !isNaN(rsiBanker[i - 1]) && 
      rsiBanker[i] < 8.5 && 
      rsiBanker[i - 1] >= 8.5;

    const bearishCond =
      rsiBankerCrossunder &&
      !isNaN(rsiHotMoney[i]) &&
      rsiHotMoney[i] < 18 &&
      !isNaN(bankma[i]) &&
      !isNaN(banksignal[i]) &&
      bankma[i] < banksignal[i] &&
      !isNaN(hotma[i]) &&
      !isNaN(hotsignal[i]) &&
      hotma[i] < hotsignal[i] &&
      !isNaN(rsiBanker[i]) &&
      rsiBanker[i] < 5;

    if (buyCrossover) {
      lastSignalBar = i;
      lastSignalType = "buy";
    } else if (bearishCond) {
      lastSignalBar = i;
      lastSignalType = "exit_long";
    }
  }

  const currentBar = n - 1;
  const candlesAgo =
    lastSignalBar !== null ? currentBar - lastSignalBar : null;

  // currentState: 1 if above 0.1, 0 if below 0.1 (black barcolor)
  const currentState =
    !isNaN(banksignal[currentBar]) && banksignal[currentBar] >= 0.1 ? 1 : 0;

  return {
    signal: lastSignalType,
    candlesAgo,
    currentState,
    lastSignalBar,
  };
}
