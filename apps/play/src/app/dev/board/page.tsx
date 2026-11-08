import type { Metadata } from "next";

import { BoardFixtureView } from "@/components/board/layout/BoardFixtureView";
import { boardFixtures } from "@/fixtures";

export const metadata: Metadata = {
  title: "Board fixture · Riftbound",
};

export const dynamic = "force-dynamic";

export default async function DevBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.fixture;
  const fixtureId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <>
      <BoardFixtureView fixtureId={fixtureId} padded={true} />
      {params.bare === "1" ? null : (
        <nav className="pointer-events-auto fixed bottom-3 left-1/2 z-[2147483000] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[rgba(134,168,246,0.28)] bg-[rgba(7,16,28,0.92)] px-2 py-1 text-[0.66rem] shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {boardFixtures.map((fixture) => (
            <a
              key={fixture.id}
              href={`/dev/board?fixture=${fixture.id}`}
              className={
                "rounded-full px-2 py-1 font-semibold transition-colors " +
                (fixture.id === (fixtureId ?? "hero")
                  ? "bg-[rgba(105,200,230,0.18)] text-[#bfeaff]"
                  : "text-[#9db5d4] hover:text-[#d8ecff]")
              }
            >
              {fixture.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
