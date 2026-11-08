import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { BuilderStoryAnnouncement } from "./components/announcement-bar";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import "./fonts.css";
import "./globals.css";
import "./riftatlas-mark.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://riftatlas.com"),
  title: {
    default: "Rift Atlas",
    template: "%s",
  },
  description: "Rift Atlas — Riftbound card database, decks and simulator.",
  applicationName: "Rift Atlas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfcfc",
};

/**
 * next-themes compatible theme bootstrap: applies the persisted theme (or the
 * system preference) to <html> before first paint, exactly like the original.
 */
const themeBootstrap = `!function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(d?"dark":"light");e.style.colorScheme=d?"dark":"light";e.dataset.platformModifier=/Mac|iPhone|iPad|iPod/.test(navigator.platform)?"meta":"control";if(d){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#1b1c26")}}catch(n){}}();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="WMBwaq_variable vI59TW_variable l5kXJG_variable Y56olq_variable light"
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          href="/fonts/3206eb66b875a5b3-s.p.3gjg6tthudz5a.woff2"
          as="font"
          crossOrigin=""
          type="font/woff2"
        />
        <link
          rel="preload"
          href="/fonts/GeistMono_Variable.p.2u63thiw2vdry.woff2"
          as="font"
          crossOrigin=""
          type="font/woff2"
        />
        <link
          rel="preload"
          href="/fonts/Geist_Variable-s.p.3ycegl481jp62.woff2"
          as="font"
          crossOrigin=""
          type="font/woff2"
        />
        <link rel="preload" href="/play/board-chain-20260908.webp" as="image" />
      </head>
      <body className="min-h-screen overflow-x-hidden font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <div className="flex min-h-dvh flex-col">
          <div className="min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col bg-transparent">
              <a
                href="#main-content"
                className="sr-only z-[200] rounded-md bg-background text-sm font-semibold text-foreground shadow-lg outline outline-2 outline-offset-2 outline-ring focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:px-4 focus:py-2"
              >
                Skip to main content
              </a>
              <SiteHeader />
              <BuilderStoryAnnouncement />
              {children}
            </div>
          </div>
          <SiteFooter />
        </div>
        <section
          aria-label="Notifications alt+T"
          tabIndex={-1}
          aria-live="polite"
          aria-relevant="additions text"
          aria-atomic="false"
          data-react-aria-top-layer="true"
        />
      </body>
    </html>
  );
}
