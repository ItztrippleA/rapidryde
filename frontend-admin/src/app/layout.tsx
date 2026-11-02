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
