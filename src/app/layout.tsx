import type { Metadata, Viewport } from "next";
import { Red_Hat_Display, Red_Hat_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

// Self-hosted at build time by next/font. Display for text, Mono for every amount and slot number.
const display = Red_Hat_Display({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-red-hat-display", display: "swap" });
const mono = Red_Hat_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-red-hat-mono", display: "swap" });

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
