import type { Metadata } from "next";

import { LobbyContainer } from "@/components/lobby/LobbyContainer";

export const metadata: Metadata = {
  title: "Play Riftbound Online - Rift Atlas Simulator",
  description:
    "Play Riftbound online with Rift Atlas, an unofficial fan-made simulator for room-code multiplayer, deck paste/import, solo testing, sealed practice, and manual board controls.",
  alternates: {
    canonical: "https://play.riftatlas.com",
    languages: {
      en: "https://play.riftatlas.com",
      "zh-CN": "https://play.riftatlas.com/zh-CN",
      fr: "https://play.riftatlas.com/fr",
      ko: "https://play.riftatlas.com/ko",
      "x-default": "https://play.riftatlas.com",
    },
  },
  openGraph: {
    siteName: "Rift Atlas Simulator",
  },
};

export default function LobbyPage() {
  return <LobbyContainer />;
}
