import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";

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
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
