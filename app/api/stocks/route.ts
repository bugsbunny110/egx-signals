import { NextResponse } from "next/server";
import { EGX_SYMBOLS } from "@/lib/egx-symbols";

export async function GET() {
  return NextResponse.json({ stocks: EGX_SYMBOLS });
}
