"use client";

/**
 * Emote glyph — original module 650212 (`0ltxa4_95njgw.js:139-1158`).
 *
 * Base emotes are plain glyphs. The Poro pack is rendered from the original
 * Rive file (`/cosmetics/poro/pals.riv`) with one artboard per emote and the
 * `Reaction` state machine. The same DOM hooks/fallback palette as the original
 * are kept (`data-poro-emote`, `data-poro-playback`, `data-poro-rive`,
 * `data-poro-reaction`, `data-poro-replay`).
 */
import { useEffect, useRef, useState } from "react";

import { Layout, Fit, useRive } from "@rive-app/react-canvas";

import { riveAsset } from "@/lib/assets";

import { EMOTE_BY_ID } from "./emote-catalog";

export type EmotePlayback = "preview" | "burst";

export interface EmoteGlyphProps {
  id: string;
  animated?: boolean;
  playback?: EmotePlayback;
  replayToken?: number;
}

export function isRiveEmote(id: string): boolean {
  return EMOTE_BY_ID.get(id)?.pack === "poro";
}

/** Simplified poster used until the Rive runtime reports ready (original `d`). */
function PoroPoster({ id, playback }: { id: string; playback: EmotePlayback }) {
  const heart = id === "poro_heart" || id === "poro_party";
  const sad = id === "poro_sad";
  const laugh = id === "poro_laugh";
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="h-full w-full overflow-visible"
      data-poro-poster={id}
      data-poro-poster-playback={playback}
    >
      <defs>
        <linearGradient id={`poro-fur-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffef8" />
          <stop offset="0.55" stopColor="#fff5e8" />
          <stop offset="1" stopColor="#d2e4e8" />
        </linearGradient>
        <linearGradient id={`poro-horn-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d59f" />
          <stop offset="0.6" stopColor="#cb9166" />
          <stop offset="1" stopColor="#95624f" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="39" rx="20" ry="17" fill={`url(#poro-fur-${id})`} />
      <path d="M15 24c0-7 5-12 11-12 0 7-4 13-11 12Z" fill={`url(#poro-horn-${id})`} />
      <path d="M49 24c0-7-5-12-11-12 0 7 4 13 11 12Z" fill={`url(#poro-horn-${id})`} />
      <circle cx="25" cy="36" r="2.6" fill="#402a2f" />
      <circle cx="39" cy="36" r="2.6" fill="#402a2f" />
      <ellipse cx="32" cy="43" rx="4" ry="3" fill="#ffa8ce" opacity={sad ? 0.5 : 0.85} />
      {sad ? (
        <path d="M27 33c2-2 4-2 6 0" stroke="#402a2f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      ) : laugh ? (
        <path d="M27 44c3 4 7 4 10 0" stroke="#402a2f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28 46c2 2 6 2 8 0" stroke="#402a2f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      )}
      {heart ? (
        <path
          d="M0 12C-5 8-19-1-19-11C-19-24-3-25 0-15C4-25 19-24 19-11C19-1 5 8 0 12Z"
          transform="translate(50 15) scale(.34)"
          fill="#ff91b4"
          opacity=".9"
        />
      ) : null}
    </svg>
  );
}

function PoroRive({
  id,
  playback,
  replayToken,
}: {
  id: string;
  playback: EmotePlayback;
  replayToken?: number;
}) {
  const [ready, setReady] = useState(false);
  const lastReplay = useRef<number | undefined>(undefined);
  const { rive, RiveComponent } = useRive({
    src: riveAsset("cosmetics/poro/pals.riv"),
    artboard: id,
    stateMachine: "Reaction",
    autoplay: false,
    enableRiveAssetCDN: false,
    shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Contain }),
    onRiveReady: () => setReady(true),
  });

  useEffect(() => {
    if (!rive) return;
    rive.resizeDrawingSurfaceToCanvas();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rive.pause();
      return;
    }
    rive.play();
  }, [rive]);

  useEffect(() => {
    if (!rive || replayToken === undefined || replayToken === lastReplay.current) return;
    lastReplay.current = replayToken;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    rive.reset({ artboard: id, stateMachine: "Reaction" });
    rive.play();
  }, [id, replayToken, rive]);

  return (
    <span
      aria-hidden="true"
      data-poro-rive={ready ? "ready" : "fallback"}
      data-poro-reaction={id}
      data-poro-replay={replayToken}
      className="relative inline-flex h-full w-full flex-shrink-0 items-center justify-center align-middle [&_canvas]:h-full [&_canvas]:w-full"
    >
      <span
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{ opacity: ready ? 0 : 1 }}
      >
        <PoroPoster id={id} playback={playback} />
      </span>
      <span
        className="absolute inset-0 transition-opacity"
        style={{ opacity: ready ? 1 : 0 }}
        data-poro-canvas-wrap="true"
      >
        <RiveComponent />
      </span>
    </span>
  );
}

export function EmoteGlyph({
  id,
  animated = false,
  playback = "preview",
  replayToken,
}: EmoteGlyphProps) {
  if (isRiveEmote(id)) {
    return (
      <span
        aria-hidden="true"
        data-poro-emote={id}
        data-poro-playback={playback}
        className="pointer-events-none inline-flex h-[1.64em] w-[1.64em] flex-shrink-0 items-center justify-center align-middle"
      >
        {animated ? (
          <PoroRive id={id} playback={playback} replayToken={replayToken} />
        ) : (
          <PoroPoster id={id} playback={playback} />
        )}
      </span>
    );
  }
  return <span aria-hidden="true">{EMOTE_BY_ID.get(id)?.glyph}</span>;
}
