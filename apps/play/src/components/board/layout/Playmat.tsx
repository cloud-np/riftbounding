"use client";

/**
 * Playmat halves. The default Rift Atlas playmat is a CSS-painted deep-blue
 * surface (the recon `board.webp` turns out to be a marketing board screenshot,
 * not a texture), so this reproduces the look with layered gradients and a faint
 * topographic/map pattern.
 */
import { useLocalGameSettings } from "../settings/settings-values";
import { useBoardCustomization, type RuntimeCustomization } from "./customization";

const CONTOURS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='620' viewBox='0 0 900 620'%3E%3Cg fill='none' stroke='%239cc5ff' stroke-opacity='.045' stroke-width='1.4'%3E%3Cpath d='M-40 120 C 120 86 232 164 366 132 S 636 42 940 108'/%3E%3Cpath d='M-30 210 C 140 170 246 254 392 212 S 660 130 930 196'/%3E%3Cpath d='M-20 316 C 156 276 260 356 410 318 S 680 242 950 300'/%3E%3Cpath d='M-10 430 C 170 392 278 470 428 430 S 700 356 960 414'/%3E%3Cpath d='M-40 548 C 130 512 252 588 396 550 S 674 474 940 536'/%3E%3Cpath d='M120 -20 C 96 116 172 206 140 330 S 68 520 128 660'/%3E%3Cpath d='M360 -20 C 338 112 414 202 384 326 S 312 516 372 660'/%3E%3Cpath d='M630 -20 C 606 116 682 206 652 330 S 580 520 640 660'/%3E%3C/g%3E%3C/svg%3E\")";

const PLAYMAT_BACKGROUND_TOP = [
  CONTOURS,
  "radial-gradient(120% 95% at 50% 100%, rgba(49, 92, 148, 0.26), transparent 70%)",
  "radial-gradient(70% 50% at 22% 82%, rgba(39, 82, 136, 0.12), transparent 62%)",
  "repeating-linear-gradient(104deg, transparent 0 46px, rgba(156, 197, 255, 0.022) 46px 47px, transparent 47px 118px)",
  "repeating-linear-gradient(14deg, transparent 0 62px, rgba(156, 197, 255, 0.018) 62px 63px, transparent 63px 154px)",
  "linear-gradient(180deg, #16355c 0%, #102845 44%, #0b1e39 100%)",
].join(", ");

const PLAYMAT_BACKGROUND_BOTTOM = [
  CONTOURS,
  "radial-gradient(120% 95% at 50% 0%, rgba(49, 92, 148, 0.26), transparent 70%)",
  "radial-gradient(70% 50% at 22% 18%, rgba(39, 82, 136, 0.12), transparent 62%)",
  "repeating-linear-gradient(104deg, transparent 0 46px, rgba(156, 197, 255, 0.022) 46px 47px, transparent 47px 118px)",
  "repeating-linear-gradient(14deg, transparent 0 62px, rgba(156, 197, 255, 0.018) 62px 63px, transparent 63px 154px)",
  "linear-gradient(0deg, #16355c 0%, #102845 44%, #0b1e39 100%)",
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
          ? "gb-board-playmat pointer-events-none absolute isolate overflow-hidden rounded-[inherit] bg-[rgb(16_24_36)] inset-x-[0.18rem] top-[0.18rem] bottom-1/2 z-0 rounded-t-[0.42rem]"
          : "gb-board-playmat pointer-events-none absolute isolate overflow-hidden rounded-[inherit] bg-[rgb(16_24_36)] inset-x-[0.18rem] top-1/2 bottom-[0.18rem] z-0 rounded-b-[0.42rem]"
      }
    >
      {playmat ? (
        // eslint-disable-next-line @next/next/no-img-element -- cosmetic playmat from the same-origin asset tree
        <img
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
            background: side === "opponent" ? PLAYMAT_BACKGROUND_TOP : PLAYMAT_BACKGROUND_BOTTOM,
            opacity: side === "opponent" ? intensity : 1,
          }}
        />
      )}
      <div
        className={
          "absolute inset-0 " +
          (side === "opponent"
            ? "bg-[linear-gradient(180deg,rgba(4,9,20,0.18),rgba(4,9,20,0.02))]"
            : "bg-[linear-gradient(0deg,rgba(4,9,20,0.2),rgba(4,9,20,0.02))]")
        }
      />
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
        className="pointer-events-none absolute left-[0.58rem] right-[0.58rem] top-1/2 z-2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgba(149,180,245,0.02),rgba(149,180,245,0.16),rgba(149,180,245,0.02))]"
      />
    </>
  );
}
