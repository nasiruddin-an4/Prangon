import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Inter has no Bengali glyphs; this shapes Bangla text (names, প্রাঙ্গণ, ৳) correctly.
const bangla = Noto_Sans_Bengali({ variable: "--font-bangla", subsets: ["bengali"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${bangla.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
