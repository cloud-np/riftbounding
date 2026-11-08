import type { Metadata } from "next";
import { Bricolage_Grotesque, Cardo, Cookie, Geist, Geist_Mono, Rajdhani } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-rajdhani",
});

const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cardo",
});

const cookie = Cookie({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-cookie",
});

const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  bricolage.variable,
  rajdhani.variable,
  cardo.variable,
  cookie.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Riftbound",
  description: "Riftbound — Rift Atlas simulator.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`}>
      <body className="bg-neutral-950 font-sans text-neutral-100" suppressHydrationWarning>{children}</body>
    </html>
  );
}
