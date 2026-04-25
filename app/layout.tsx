import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EGX Signal Scanner | Universal Self-Adaptive EMA Pro",
  description:
    "Real-time Egyptian Stock Exchange signal scanner powered by the Universal Self-Adaptive EMA indicator. Monitor H1 and H4 timeframe signals for all major EGX stocks.",
  keywords: "EGX, Egyptian stocks, trading signals, EMA, technical analysis",
};

import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
