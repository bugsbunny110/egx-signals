import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/twelve-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const exchange = searchParams.get("exchange") || "EGX";
  const interval = searchParams.get("interval") as "1h" | "4h" | null;

  if (!symbol || !interval) {
    return NextResponse.json(
      { error: "Missing symbol or interval" },
      { status: 400 }
    );
  }

  if (!["1h", "4h"].includes(interval)) {
    return NextResponse.json(
      { error: "Interval must be 1h or 4h" },
      { status: 400 }
    );
  }

  try {
    const candles = await fetchCandles(symbol, exchange, interval, 300);
    return NextResponse.json({ symbol, exchange, interval, candles });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
