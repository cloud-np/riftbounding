"use client";

/**
 * Playmat halves. The default Rift Atlas playmat is a CSS-painted deep-blue
 * surface (the recon `board.webp` turns out to be a marketing board screenshot,
 * not a texture), so this reproduces the look with layered gradients and a faint
 * topographic/map pattern.
 */
import { useLocalGameSettings } from "../settings/settings-values";
import { useAnimationLevel } from "../theme/motion";
import { useBoardCustomization, type RuntimeCustomization } from "./customization";
import { SafeImg } from "../card/SafeImg";

/** Engraved lattice: dark groove + light lip offset by 1px, with rune studs on the crossings. */
const ENGRAVING =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cg fill='none'%3E%3Cpath d='M0 52 L60 0 L120 52 L60 104 Z' stroke='%23000' stroke-opacity='.22' stroke-width='1.2'/%3E%3Cpath d='M0 53 L60 1 L120 53 L60 105 Z' stroke='%23a9d4ff' stroke-opacity='.07' stroke-width='1'/%3E%3Cpath d='M30 26 L90 78 M90 26 L30 78' stroke='%23000' stroke-opacity='.10' stroke-width='1'/%3E%3C/g%3E%3Cg fill='%23bfe3ff' fill-opacity='.10'%3E%3Ccircle cx='60' cy='52' r='1.6'/%3E%3Ccircle cx='0' cy='52' r='1.2'/%3E%3Ccircle cx='120' cy='52' r='1.2'/%3E%3C/g%3E%3C/svg%3E\")";

const CONTOURS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='620' viewBox='0 0 900 620'%3E%3Cg fill='none' stroke='%239cc5ff' stroke-opacity='.05' stroke-width='1.4'%3E%3Cpath d='M-40 120 C 120 86 232 164 366 132 S 636 42 940 108'/%3E%3Cpath d='M-30 210 C 140 170 246 254 392 212 S 660 130 930 196'/%3E%3Cpath d='M-20 316 C 156 276 260 356 410 318 S 680 242 950 300'/%3E%3Cpath d='M-10 430 C 170 392 278 470 428 430 S 700 356 960 414'/%3E%3Cpath d='M-40 548 C 130 512 252 588 396 550 S 674 474 940 536'/%3E%3C/g%3E%3C/svg%3E\")";

/** Self half: cool lapis felt. Translucent so the arena backdrop breathes through. */
const PLAYMAT_BACKGROUND_SELF = [
  ENGRAVING,
  CONTOURS,
  "radial-gradient(90% 70% at 50% 100%, rgba(66, 140, 230, 0.20), transparent 70%)",
  "radial-gradient(60% 40% at 18% 90%, rgba(60, 200, 190, 0.08), transparent 70%)",
  "linear-gradient(0deg, rgba(14, 38, 72, 0.80) 0%, rgba(11, 30, 58, 0.72) 55%, rgba(9, 24, 48, 0.62) 100%)",
].join(", ");

/** Opponent half: the same felt shifted warm (ember/crimson) at low intensity. */
const PLAYMAT_BACKGROUND_OPPONENT = [
  ENGRAVING,
  CONTOURS,
  "radial-gradient(90% 70% at 50% 0%, rgba(214, 92, 96, 0.17), transparent 70%)",
  "radial-gradient(60% 40% at 82% 10%, rgba(230, 160, 80, 0.07), transparent 70%)",
  "linear-gradient(180deg, rgba(40, 24, 50, 0.78) 0%, rgba(26, 22, 50, 0.70) 55%, rgba(14, 26, 52, 0.60) 100%)",
].join(", ");

function PlaymatHalf({
  side,
  intensity = 1,
  customization,
}: {
  side: "self" | "opponent";
  intensity?: number;
  customization?: RuntimeCustomization;
}) {
  const playmat = customization?.playmat;
  const contrast = playmat ? Math.max(0, Math.min(1, playmat.contrast)) ** 2 : 1;
  const saturation = playmat?.saturation ?? 1;
  return (
    <div
      aria-hidden="true"
      data-board-playmat="true"
      data-board-playmat-side={side}
      data-board-custom-playmat={playmat ? "true" : "false"}
      className={
        side === "opponent"
          ? "gb-board-playmat playmat-half playmat-half-opponent pointer-events-none absolute isolate overflow-hidden rounded-[inherit] inset-x-[0.18rem] top-[0.18rem] bottom-1/2 z-0 rounded-t-[0.42rem]"
          : "gb-board-playmat playmat-half playmat-half-self pointer-events-none absolute isolate overflow-hidden rounded-[inherit] inset-x-[0.18rem] top-1/2 bottom-[0.18rem] z-0 rounded-b-[0.42rem]"
      }
    >
      {playmat ? (
        <SafeImg
          src={playmat.src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{
            opacity: playmat.intensity,
            filter: `contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)})`,
          }}
          data-board-playmat-image="true"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: side === "opponent" ? PLAYMAT_BACKGROUND_OPPONENT : PLAYMAT_BACKGROUND_SELF,
            opacity: side === "opponent" ? intensity : 1,
          }}
        />
      )}
      <div className="playmat-vignette absolute inset-0" />
      {/* Original frosted-glass optic layer (hidden unless the cosmetic enables it). */}
      <div
        aria-hidden="true"
        data-board-glass={side}
        className="gb-board-glass gb-board-glass-optics pointer-events-none absolute inset-0"
      />
    </div>
  );
}

export function Playmat() {
  const settings = useLocalGameSettings();
  const customization = useBoardCustomization();
  const level = useAnimationLevel();
  return (
    <>
      <PlaymatHalf
        side="opponent"
        intensity={settings.opponentCosmeticsPercent / 100}
        customization={customization.opponent}
      />
      <PlaymatHalf side="self" customization={customization.self} />
      <div
        aria-hidden="true"
        data-playmat-divider="true"
        data-motion={level}
        className="playmat-divider pointer-events-none absolute left-[0.58rem] right-[0.58rem] top-1/2 z-2 -translate-y-1/2"
      >
        <span className="playmat-divider-glow" />
        <span className="playmat-divider-line" />
        <svg viewBox="0 0 200 200" className="playmat-emblem" focusable="false">
          <g fill="none" stroke="currentColor">
            <circle cx="100" cy="100" r="92" strokeWidth="1.2" />
            <circle cx="100" cy="100" r="80" strokeWidth="0.6" strokeDasharray="2 5" />
            <circle cx="100" cy="100" r="58" strokeWidth="0.8" />
            <path d="M100 8 L112 100 L100 192 L88 100 Z" strokeWidth="0.8" />
            <path d="M8 100 L100 88 L192 100 L100 112 Z" strokeWidth="0.8" />
          </g>
          <path d="M100 82 L118 100 L100 118 L82 100 Z" fill="currentColor" opacity="0.8" />
        </svg>
      </div>
    </>
  );
}
