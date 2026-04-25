import { NextRequest, NextResponse } from "next/server";
import { sendTelegramAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const testMessage = `🚀 <b>TEST ALERT</b>\nYour EGX Signal Bot is connected correctly!\n\nStatus: <b>Operational</b>\nTime: ${new Date().toLocaleTimeString()}\n\n<i>Notifications will now arrive every 15 minutes during market hours.</i>`;
    
    await sendTelegramAlert(testMessage);
    
    return NextResponse.json({ 
      success: true, 
      message: "Test alert sent to your Telegram!" 
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
