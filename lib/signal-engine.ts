/**
 * Universal Self-Adaptive EMA - Pro Edition
 * TypeScript port of the Pine Script indicator
 *
 * Pine Script logic:
 * - EMA(close, 10)
 * - deltaEMA = EMA - EMA[1]
 * - Z-Score engine: lookback=150, avgDelta=SMA(deltaEMA,150), stdDev(deltaEMA,150)
 * - zScore = (deltaEMA - avgDelta) / stdDevDelta
 * - isVolHigh = volume > SMA(volume, 50) * 1.2
 * - buyCondition  = zScore > 2.0 && isVolHigh
 * - sellCondition = zScore < -2.0 && isVolHigh
 * - exitBuy  = zScore < 0.5 && EMA < EMA[1]
 * - exitSell = zScore > -0.5 && EMA > EMA[1]
 * - State machine: 0 (neutral), 1 (long), -1 (short)
 */

import type { OHLCVCandle, SignalResult, SignalType } from "@/types";

// --- Math helpers ---

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else if (i < period - 1) {
      // Seed with SMA for the first `period` bars
      const slice = values.slice(0, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else if (i === period - 1) {
      // First proper EMA value: seed with SMA(period)
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(seed);
    } else {
      result.push(values[i] * k + result[i - 1] * (1 - k));
    }
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result[i] = slice.reduce((a, b) => a + b, 0) / period;
  }
  return result;
}

function stdev(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance =
      slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period;
    result[i] = Math.sqrt(variance);
  }
  return result;
}

// --- Main Signal Engine ---

const EMA_LEN = 10;
const LOOKBACK = 150;
const VOL_PERIOD = 50;
const ZSCORE_BUY = 2.0;
const ZSCORE_SELL = -2.0;
const ZSCORE_EXIT_BUY = 0.5;
const ZSCORE_EXIT_SELL = -0.5;

export function runSignalEngine(candles: OHLCVCandle[]): SignalResult {
  const n = candles.length;

  // Need at least LOOKBACK + EMA_LEN + buffer candles
  const minRequired = LOOKBACK + EMA_LEN + 10;
  if (n < minRequired) {
    return {
      signal: "none",
      candlesAgo: null,
      currentState: 0,
      lastSignalBar: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  // 1. Calculate EMA(close, 10)
  const emaValues = ema(closes, EMA_LEN);

  // 2. deltaEMA = EMA - EMA[1]
  const deltaEMA: number[] = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    deltaEMA[i] = emaValues[i] - emaValues[i - 1];
  }

  // 3. Z-Score engine
  const avgDelta = sma(deltaEMA, LOOKBACK);
  const stdDevDelta = stdev(deltaEMA, LOOKBACK);

  const zScores: number[] = new Array(n).fill(NaN);
  for (let i = LOOKBACK; i < n; i++) {
    if (!isNaN(avgDelta[i]) && stdDevDelta[i] > 0) {
      zScores[i] = (deltaEMA[i] - avgDelta[i]) / stdDevDelta[i];
    }
  }

  // 4. Volume filter: isVolHigh = volume > SMA(volume, 50) * 1.2
  const smaVol = sma(volumes, VOL_PERIOD);
  const isVolHigh: boolean[] = new Array(n).fill(false);
  for (let i = VOL_PERIOD - 1; i < n; i++) {
    if (!isNaN(smaVol[i])) {
      isVolHigh[i] = volumes[i] > smaVol[i] * 1.2;
    }
  }

  // 5. Buy/sell conditions
  const buyCondition: boolean[] = new Array(n).fill(false);
  const sellCondition: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    buyCondition[i] = zScores[i] > ZSCORE_BUY && isVolHigh[i];
    sellCondition[i] = zScores[i] < ZSCORE_SELL && isVolHigh[i];
  }

  // 6. Exit conditions
  const exitBuy: boolean[] = new Array(n).fill(false);
  const exitSell: boolean[] = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    exitBuy[i] = zScores[i] < ZSCORE_EXIT_BUY && emaValues[i] < emaValues[i - 1];
    exitSell[i] =
      zScores[i] > ZSCORE_EXIT_SELL && emaValues[i] > emaValues[i - 1];
  }

  // 7. State machine (Pine Script: var int state = 0)
  const states: number[] = new Array(n).fill(0);
  let state = 0;

  for (let i = 1; i < n; i++) {
    if (i === n - 1) {
        console.log(`Debug stats: zScore=${zScores[i]}, isVolHigh=${isVolHigh[i]}, state_prev=${state}`);
    }
    // Pine Script logic (order matters):
    // if buyCondition and state <= 0 → state := 1
    // if sellCondition and state >= 0 → state := -1
    // if (state==1 and exitBuy) or (state==-1 and exitSell) → state := 0
    if (buyCondition[i] && state <= 0) {
      state = 1;
    }
    if (sellCondition[i] && state >= 0) {
      state = -1;
    }
    if ((state === 1 && exitBuy[i]) || (state === -1 && exitSell[i])) {
      state = 0;
    }
    states[i] = state;
  }

  // 8. Detect signals (arrows) — matches plotshape conditions in Pine Script
  // Buy arrow:  buyCondition[i]  && states[i-1] <= 0
  // Sell arrow: sellCondition[i] && states[i-1] >= 0
  // Exit Long:  state == 0 && state[i-1] == 1
  // Exit Short: state == 0 && state[i-1] == -1

  let lastSignalBar: number | null = null;
  let lastSignalType: SignalType = "none";

  for (let i = 1; i < n; i++) {
    if (buyCondition[i] && states[i - 1] <= 0) {
      lastSignalBar = i;
      lastSignalType = "buy";
    } else if (sellCondition[i] && states[i - 1] >= 0) {
      lastSignalBar = i;
      lastSignalType = "sell";
    } else if (states[i] === 0 && states[i - 1] === 1) {
      lastSignalBar = i;
      lastSignalType = "exit_long";
    } else if (states[i] === 0 && states[i - 1] === -1) {
      lastSignalBar = i;
      lastSignalType = "exit_short";
    }
  }

  const currentBar = n - 1;
  const candlesAgo =
    lastSignalBar !== null ? currentBar - lastSignalBar : null;

  return {
    signal: lastSignalType,
    candlesAgo,
    currentState: states[currentBar],
    lastSignalBar,
  };
}
