import type { Metadata } from "next";

import { CustomizeStudio } from "./CustomizeStudio";

export const metadata: Metadata = {
  title: "Customize your Rift Atlas board",
  description:
    "Connect Metafy, manage supporter recognition, and choose your Simulator playmat and sleeves.",
  alternates: {
    canonical: "https://play.riftatlas.com/customize",
  },
};

export default function CustomizePage() {
  return <CustomizeStudio />;
}
