export type SignalType = "buy" | "sell" | "exit_long" | "exit_short" | "none";

export type Timeframe = "1h" | "4h";

export interface OHLCVCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalResult {
  signal: SignalType;
  candlesAgo: number | null; // null means no signal found in data window
  currentState: number; // -1, 0, 1
  lastSignalBar: number | null;
}

export interface StockSignal {
  symbol: string;
  name: string;
  shortName?: string;
  tvSymbol?: string;
  timeframe: Timeframe;
  price?: number;
  changePercent?: number;
  aiVerdict?: string;
  aiVerdictColor?: string;
  signal: SignalType;
  candlesAgo: number | null;
  currentState: number;
  lastUpdated: string;
  error?: string;
  // Fundamental data fields
  pe?: number | null;
  marketCap?: number | null;
  ldDebtEquity?: number | null;
  totalDebtEquity?: number | null;
  yesterdayChangePercent?: number | null;
}

export interface EGXSymbol {
  symbol: string;    // Twelve Data symbol code
  name: string;
  shortName?: string; // Short display name (e.g., "CIB")
  tvSymbol?: string; // TradingView symbol (e.g., "EGX:COMI")
}

export interface SignalsResponse {
  stocks: StockSignal[];
  scannedAt: string;
  totalScanned: number;
  errors: number;
}

export interface DashboardStats {
  totalBuy: number;
  totalSell: number;
  totalExitLong: number;
  totalExitShort: number;
  totalActive: number;
}

export type FilterType = "all" | "buy" | "sell" | "exit_long" | "exit_short";
export type SortType = "candles_asc" | "candles_desc" | "symbol_az" | "signal";
export type TimeframeFilter = "all" | "1h" | "4h";
