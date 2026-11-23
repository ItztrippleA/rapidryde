import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AdminShell } from "@/components/shell/AdminShell";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Rapyd Admin",
  description: "Operations console for drivers, customers, zones, pricing, promos, and access.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeRegistry>
          <AdminShell>{children}</AdminShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}
