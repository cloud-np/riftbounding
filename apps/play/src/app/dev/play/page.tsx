import type { Metadata } from "next";

import { LocalGameHarness } from "@/dev/LocalGameHarness";
import { StrictGameHarness } from "@/dev/StrictGameHarness";
import { parseScenario } from "@/dev/strictScenario";

export const metadata: Metadata = {
  title: "Local play · Riftbound",
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DevPlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (first(params.rules) === "strict") {
    return (
      <StrictGameHarness
        seed={first(params.seed)}
        scenario={parseScenario(first(params.scenario))}
      />
    );
  }
  return (
    <LocalGameHarness
      fixture={first(params.fixture)}
      seed={first(params.seed)}
      viewer={first(params.viewer)}
    />
  );
}
