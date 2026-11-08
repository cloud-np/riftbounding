"use client";

/**
 * Static 2-D initiative die (module 269913, chunk `03azfb7rltdws.js`). Used when
 * WebGL is unavailable, the context is lost, or the animated chunk fails to load.
 */

import { useId } from "react";

import { createTranslator } from "@rift/i18n";

import type { InitiativeStagePlayer } from "./types";

const t = createTranslator("en");

export function isUnderlinedDieValue(value: number | undefined): boolean {
  return value === 6 || value === 9;
}

export function dieColor(isMe: boolean, relation: InitiativeStagePlayer["relation"]): string {
  if (isMe) return "#2bc78f";
  if (relation === "ally") return "#4fafd0";
  return "#d88936";
}

export function relationLabel(
  player: InitiativeStagePlayer | null | undefined,
  isMe: boolean,
  translate = t,
): string {
  if (isMe) return translate("sim.you") ?? "You";
  if (player?.relation === "ally") return translate("sim.setup.ally") ?? "Ally";
  return translate("sim.opponent") ?? "Opponent";
}

export function playerDisplayLabel(
  player: InitiativeStagePlayer | null | undefined,
  isMe: boolean,
  translate = t,
): string {
  const label = relationLabel(player, isMe, translate);
  const name = player?.name?.trim();
  if (name && name.toLowerCase() !== label.trim().toLowerCase()) return `${label} · ${name}`;
  return label;
}

export function dieStatusLabel(
  player: InitiativeStagePlayer | null | undefined,
  isMe: boolean,
  rolling: boolean,
  value: number | undefined,
  translate = t,
): string {
  const waiting = isMe
    ? translate("sim.setup.initiativeDieWaitingSelf")
    : translate("sim.setup.initiativeDieWaitingOpponent");
  if (!player) return waiting ?? "";
  const prefix = playerDisplayLabel(player, isMe, translate);
  const status = rolling
    ? translate("sim.setup.initiativeRollingStatus")
    : typeof value === "number"
      ? translate("sim.setup.initiativeResultStatus", { value })
      : translate("sim.setup.initiativeWaitingStatus");
  return `${prefix}: ${status ?? ""}`;
}

const DIE_SIZE = { width: "clamp(10.5rem, 16vw, 14.5rem)", height: "clamp(10.5rem, 16vw, 14.5rem)" } as const;

export function InitiativeDieFallback({
  player,
  isMe,
  winner,
  positionClassName,
  compactIdentity,
}: {
  player: InitiativeStagePlayer | null;
  isMe: boolean;
  winner: boolean;
  positionClassName: string;
  compactIdentity: boolean;
}) {
  const gradientId = useId();
  const value = typeof player?.value === "number" ? player.value : undefined;
  const display = typeof value === "number" ? String(value) : player?.rolling ? "…" : "?";
  const status = dieStatusLabel(player, isMe, !!player?.rolling, value);
  const tone = isMe
    ? "border-[rgba(100,224,169,0.5)] bg-[rgba(7,31,23,0.9)] text-[#83dfb3]"
    : player?.relation === "ally"
      ? "border-[rgba(111,186,214,0.52)] bg-[rgba(8,29,38,0.9)] text-[#8ed8ef]"
      : "border-[rgba(239,178,106,0.5)] bg-[rgba(40,24,8,0.9)] text-[#efbd7b]";
  const shortLabel = relationLabel(player, isMe);
  const showName = !!player && playerDisplayLabel(player, isMe) !== shortLabel;

  return (
    <div
      data-initiative-player-id={player?.id ?? "waiting"}
      data-initiative-relation={player?.relation}
      data-initiative-winner={winner ? "true" : undefined}
      data-team-label={player?.teamLabel ?? undefined}
      role="img"
      aria-label={status}
      className={`pointer-events-none absolute h-55 w-55 -translate-x-1/2 -translate-y-1/2 ${positionClassName}`}
      style={DIE_SIZE}
    >
      <div className="absolute inset-0 grid place-items-center">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 200 210"
          className="overflow-visible drop-shadow-[0_10px_12px_rgba(0,0,0,0.42)]"
          style={{ width: winner ? "74%" : "62%", color: dieColor(isMe, player?.relation ?? "opponent") }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
              <stop stopColor="#fff6da" stopOpacity="0.15" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#051d22" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M100 12 183 50 179 151 100 197 21 151 17 50Z" fill="currentColor" />
          <g stroke="#071e25" strokeOpacity="0.28" strokeWidth="2" strokeLinejoin="round">
            <path d="M100 12 100 32 17 50Z" fill="#0c2521" fillOpacity="0.6" />
            <path d="M100 12 183 50 100 32Z" fill="#13261e" fillOpacity="0.42" />
            <path d="M17 50 100 32 44 135Z" fill="#ffffff" fillOpacity="0.06" />
            <path d="M100 32 183 50 156 135Z" fill="#052522" fillOpacity="0.24" />
            <path d="M17 50 44 135 21 151Z" fill="#071e25" fillOpacity="0.35" />
            <path d="M183 50 179 151 156 135Z" fill="#071e25" fillOpacity="0.5" />
            <path d="M21 151 44 135 100 197Z" fill="#0c2521" fillOpacity="0.24" />
            <path d="M179 151 100 197 156 135Z" fill="#071e25" fillOpacity="0.38" />
            <path d="M44 135 156 135 100 197Z" fill="#ffffff" fillOpacity="0.025" />
            <path d="M100 32 156 135 44 135Z" fill="#ffffff" fillOpacity="0.1" />
          </g>
          <path d="M100 12 183 50 179 151 100 197 21 151 17 50Z" fill={`url(#${gradientId})`} />
          <text
            x="100"
            y="118"
            textAnchor="middle"
            fill="#fff1d1"
            stroke="#142c26"
            strokeOpacity="0.4"
            strokeWidth="0.8"
            paintOrder="stroke"
            fontFamily="Georgia, serif"
            fontSize="42"
            fontWeight="600"
          >
            {display}
          </text>
          {typeof value === "number" && isUnderlinedDieValue(value) ? (
            <path
              data-initiative-orientation-line={value}
              d="M90 125H110"
              stroke="#fff1d1"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      </div>
      <span className="sr-only">{status}</span>
      {compactIdentity && player ? (
        <div className="absolute top-[94%] left-1/2 z-10 flex w-full -translate-x-1/2 justify-center px-2">
          <span
            data-initiative-identity-cue={shortLabel}
            data-initiative-player-name={player.name}
            title={status}
            className={`pointer-events-auto inline-flex min-h-5 min-w-0 max-w-full cursor-default items-center gap-1 rounded-[0.18rem] border px-1.5 py-0.5 text-[0.7rem] font-bold leading-none shadow-[0_3px_10px_rgba(0,0,0,0.42)] ${tone}`}
          >
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
            <span className="shrink-0 uppercase tracking-[0.12em]">{shortLabel}</span>
            {showName ? (
              <>
                <span aria-hidden="true" className="shrink-0 opacity-55">
                  ·
                </span>
                <span className="min-w-0 truncate tracking-[0.035em] opacity-90">{player.name}</span>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
