"use client";

/**
 * `InitiativeDiceStage` (module 157661) — the three.js dodecahedron dice used by
 * the initiative roll, with the module-269913 static fallback.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { createTranslator } from "@rift/i18n";

import {
  InitiativeDieFallback,
  dieStatusLabel,
  playerDisplayLabel,
} from "./InitiativeDiceFallback";
import type { InitiativeStagePlayer } from "./types";

const t = createTranslator("en");

const InitiativeDiceCanvas = dynamic(() => import("./InitiativeDiceCanvas"), {
  ssr: false,
  loading: () => null,
});

const DIE_POSITIONS = {
  duel: ["left-[46%] top-[18%]", "left-[46%] top-[68%]"],
  three: ["left-[30%] top-[24%]", "left-[62%] top-[24%]", "left-[46%] top-[70%]"],
  four: [
    "left-[30%] top-[24%]",
    "left-[62%] top-[24%]",
    "left-[30%] top-[70%]",
    "left-[62%] top-[70%]",
  ],
} as const;

let webglProbe: boolean | undefined;

export function isWebglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  if (webglProbe !== undefined) return webglProbe;
  const canvas = document.createElement("canvas");
  try {
    const context =
      canvas.getContext("webgl2", { alpha: true, antialias: true }) ??
      canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!context) {
      webglProbe = false;
      return false;
    }
    (context as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    webglProbe = true;
    return true;
  } catch {
    webglProbe = false;
    return false;
  }
}

/** Me last, then the other players in seat order (module 269913 `f`). */
export function orderPlayersForStage(
  players: readonly InitiativeStagePlayer[],
  meId: string,
): InitiativeStagePlayer[] {
  const me = players.find((player) => player.id === meId);
  const others = players.filter((player) => player.id !== meId);
  if (me) return [...others, me];
  return [...players];
}

export function positionsForCount(count: number): readonly string[] {
  if (count >= 4) return DIE_POSITIONS.four;
  if (count === 3) return DIE_POSITIONS.three;
  return DIE_POSITIONS.duel;
}

export function InitiativeChooserBanner({
  chooser,
  meId,
}: {
  chooser: InitiativeStagePlayer | null;
  meId: string;
}) {
  if (!chooser) return null;
  const label =
    chooser.id === meId
      ? t("sim.setup.initiativeYouChoose")
      : t("sim.setup.initiativePlayerChooses", { playerName: chooser.teamLabel ?? chooser.name });
  return (
    <div
      role="status"
      data-initiative-decision={chooser.id}
      className="absolute left-[46%] top-[44%] z-20 w-max max-w-[88%] -translate-x-1/2 -translate-y-1/2 text-center motion-safe:animate-[initiative-decision-reveal_300ms_550ms_both]"
    >
      <div className="rounded-none border border-[rgba(199,176,131,0.62)] bg-[linear-gradient(145deg,rgba(16,40,74,0.96),rgba(6,18,38,0.95))] px-[1.22rem] py-[0.52rem] shadow-[inset_0_0_0_1px_rgba(232,214,176,0.18),0_12px_28px_rgba(2,8,19,0.58)] max-sm:px-3">
        <div className="flex items-center gap-[0.62rem] text-[0.8rem] uppercase tracking-[0.14em] text-[#e8dcc1]">
          <span
            aria-hidden="true"
            className="h-px w-[1.85rem] shrink-0 bg-[linear-gradient(90deg,rgba(200,176,130,0),rgba(200,176,130,0.88))] max-sm:hidden"
          />
          <p className="text-shadow-[0_1px_0_rgba(8,18,34,0.55)]">{label}</p>
          <span
            aria-hidden="true"
            className="h-px w-[1.85rem] shrink-0 bg-[linear-gradient(90deg,rgba(200,176,130,0.88),rgba(200,176,130,0))] max-sm:hidden"
          />
        </div>
      </div>
    </div>
  );
}

export interface InitiativeDiceStageProps {
  players: readonly InitiativeStagePlayer[];
  meId: string;
  chooserId?: string | null;
  animationStartedAt: number | null;
  onReady?: (mode: "animated" | "static") => void;
}

export function InitiativeDiceStage({
  players,
  meId,
  chooserId,
  animationStartedAt,
  onReady,
}: InitiativeDiceStageProps) {
  const [fallback, setFallback] = useState(false);
  const [watchdog, setWatchdog] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWatchdog(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const webgl = useMemo(() => (typeof window === "undefined" ? false : isWebglAvailable()), []);
  const useFallback = fallback || watchdog || !webgl;

  const ordered = useMemo(() => orderPlayersForStage(players, meId), [players, meId]);
  const positions = positionsForCount(ordered.length);
  const compactIdentity = ordered.length > 2;
  const chooser = chooserId ? (ordered.find((player) => player.id === chooserId) ?? null) : null;
  const allRolled = ordered.every((player) => typeof player.value === "number");
  const reveal = !!chooser && allRolled;
  const visible = animationStartedAt !== null;

  useEffect(() => {
    if (useFallback) onReady?.("static");
    else if (players.length > 0) onReady?.("animated");
  }, [onReady, players.length, useFallback]);

  if (players.length < 2) return null;

  return (
    <div
      data-initiative-layout={ordered.length > 2 ? "multiplayer-grid" : "duel-vertical"}
      style={visible ? undefined : { visibility: "hidden" }}
      className="pointer-events-none absolute inset-y-[0.28rem] left-[0.28rem] right-[0.28rem] z-95 overflow-hidden"
      data-testid="initiative-dice-stage"
    >
      {ordered.map((player, index) => {
        const positionClassName = positions[index] ?? DIE_POSITIONS.duel[1];
        const winner = !!chooser && player.id === chooser.id;
        if (useFallback) {
          return (
            <InitiativeDieFallback
              key={player.id}
              player={player}
              isMe={player.id === meId}
              winner={winner}
              positionClassName={positionClassName}
              compactIdentity={compactIdentity}
            />
          );
        }
        return (
          <div
            key={player.id}
            data-initiative-player-id={player.id}
            data-initiative-relation={player.relation}
            data-initiative-winner={winner && reveal ? "true" : undefined}
            data-team-label={player.teamLabel ?? undefined}
            role="img"
            aria-label={dieStatusLabel(player, player.id === meId, !!player.rolling, player.value)}
            className={`pointer-events-none absolute h-55 w-55 -translate-x-1/2 -translate-y-1/2 ${positionClassName}`}
          >
            <InitiativeDiceCanvas
              player={player}
              isMe={player.id === meId}
              reveal={reveal}
              winner={winner}
              animationStartedAt={animationStartedAt}
              onUnavailable={() => setFallback(true)}
            />
            {compactIdentity ? (
              <div className="absolute top-[94%] left-1/2 z-10 flex w-full -translate-x-1/2 justify-center px-2">
                <span
                  data-initiative-identity-cue={playerDisplayLabel(player, player.id === meId)}
                  data-initiative-player-name={player.name}
                  title={dieStatusLabel(player, player.id === meId, !!player.rolling, player.value)}
                  className={`pointer-events-auto inline-flex min-h-5 min-w-0 max-w-full cursor-default items-center gap-1 rounded-[0.18rem] border px-1.5 py-0.5 text-[0.7rem] font-bold leading-none shadow-[0_3px_10px_rgba(0,0,0,0.42)] ${
                    player.id === meId
                      ? "border-[rgba(100,224,169,0.5)] bg-[rgba(7,31,23,0.9)] text-[#83dfb3]"
                      : player.relation === "ally"
                        ? "border-[rgba(111,186,214,0.52)] bg-[rgba(8,29,38,0.9)] text-[#8ed8ef]"
                        : "border-[rgba(239,178,106,0.5)] bg-[rgba(40,24,8,0.9)] text-[#efbd7b]"
                  }`}
                >
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
                  <span className="shrink-0 uppercase tracking-[0.12em]">
                    {player.id === meId ? t("sim.you") : player.relation === "ally" ? t("sim.setup.ally") : t("sim.opponent")}
                  </span>
                  <span aria-hidden="true" className="shrink-0 opacity-55">
                    ·
                  </span>
                  <span className="min-w-0 truncate tracking-[0.035em] opacity-90">{player.name}</span>
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
      {reveal ? <InitiativeChooserBanner chooser={chooser} meId={meId} /> : null}
    </div>
  );
}

export default InitiativeDiceStage;
