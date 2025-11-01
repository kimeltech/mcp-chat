import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import "@/lib/crypto-polyfill";
// import { BotIdClient } from "botid/client";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://chat.ecosemantic.com"),
  title: "EcoSemantic MCP Chat",
  description:
    "AI-powered environmental impact analysis with Model Context Protocol. Multi-model support and LCA tools integration.",
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    siteName: "EcoSemantic MCP Chat",
    url: "https://chat.ecosemantic.com",
    images: [
      {
        url: "https://chat.ecosemantic.com/logo.svg",
        width: 358,
        height: 651,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoSemantic MCP Chat",
    description:
      "AI-powered environmental impact analysis with Model Context Protocol. Multi-model support and LCA tools integration.",
    images: ["https://chat.ecosemantic.com/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* BotIdClient disabled for local deployment */}
        {/* <BotIdClient
          protect={[
            {
              path: "/api/chat",
              method: "POST",
            }
          ]}
        /> */}
      </head>
      <body className={`${inter.className}`}>
        <Script src="/crypto-polyfill.js" strategy="beforeInteractive" />
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
