import type { Metadata } from "next";

import { GameScreen } from "@/components/game/GameScreen";

export const metadata: Metadata = {
  title: "Game · Riftbound",
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <GameScreen
      room={first(params.room)}
      gameInstanceId={first(params.gameInstanceId)}
      playerId={first(params.playerId)}
      viewer={first(params.viewer)}
    />
  );
}
