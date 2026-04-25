import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch("http://localhost:8765/fundamentals", {
      next: { revalidate: 300 }, // cache for 5 min
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Python server error" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
