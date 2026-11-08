/**
 * Viewport / pointer detection — verbatim port of the original responsive
 * entry points (`637428` module: `a` mode, `Z` phone portrait, `M` compact)
 * and the visual-viewport tracker in `0xawjzm3yjpr1.js` (~64190-64300).
 *
 * The original decides the board mode from the *pointer* plus the viewport:
 *
 *   mode = coarsePointer && (widthPx < 1440 || heightPx < 800) ? "touch" : "desktop"
 *
 * `phonePortrait` and `compact` only apply in `touch` mode. The board then
 * renders `data-tablet-layout`, `data-tablet-compact`, `data-board-arrangement`
 * and the `--tablet-*` / `--touch-player-band-padding` CSS variables, which is
 * what activates every phone/tablet rule in `riftbound-app.css`.
 */

import { useEffect, useState } from "react";

import type { BoardMode } from "./board-metrics";

export interface BoardViewport {
  widthPx: number;
  heightPx: number;
  layoutHeightPx: number;
  visibleHeightPx: number;
  visibleTopPx: number;
  orientation?: "portrait" | "landscape";
  keyboardOpen: boolean;
  coarsePointer: boolean;
}

/** `637428 a` — desktop vs touch board mode. */
export function boardModeFor(viewport: BoardViewport): BoardMode {
  return viewport.coarsePointer && (viewport.widthPx < 1440 || viewport.heightPx < 800)
    ? "touch"
    : "desktop";
}

/** `637428 Z` — phone portrait arrangement. */
export function isPhonePortraitViewport(viewport: BoardViewport, mode: BoardMode): boolean {
  return (
    mode === "touch" &&
    !(viewport.heightPx <= viewport.widthPx) &&
    (viewport.widthPx <= 600 ||
      (!(viewport.widthPx > 1000) &&
        Math.max(viewport.heightPx, viewport.layoutHeightPx) >= 1.72 * viewport.widthPx))
  );
}

/** `637428 M` — compact touch chrome. */
export function isCompactViewport(viewport: BoardViewport, mode: BoardMode): boolean {
  return (
    mode === "touch" &&
    !(viewport.heightPx <= viewport.widthPx) &&
    (viewport.widthPx <= 850 || isPhonePortraitViewport(viewport, mode))
  );
}

/** The original `nW.G` map: touch player-band padding by hand-control placement. */
export const TOUCH_PLAYER_BAND_PADDING_REM = {
  beside: 1.8,
  above: 4,
} as const;

/** The original `dE.r` / `dE.S` hand-card scale on touch layouts. */
export const TOUCH_HAND_CARD_SCALE = {
  phone: 1.35,
  tablet: 1.12,
} as const;

/** Coarse-pointer media query used by the original (`pointer: coarse`). */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

const TEXT_INPUT_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [contenteditable]:not([contenteditable='false'])";

export function readBoardViewport(): BoardViewport {
  const viewport = typeof window === "undefined" ? null : window.visualViewport;
  const screenOrientation =
    typeof window === "undefined" ? undefined : window.screen?.orientation?.type;
  const orientation =
    screenOrientation && screenOrientation.startsWith("landscape")
      ? "landscape"
      : screenOrientation && screenOrientation.startsWith("portrait")
        ? "portrait"
        : undefined;
  const coarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(COARSE_POINTER_QUERY).matches
      : false;
  const editing =
    typeof document !== "undefined" &&
    document.activeElement instanceof Element &&
    !!document.activeElement.matches(TEXT_INPUT_SELECTOR);
  const widthPx = typeof window === "undefined" ? 1440 : window.innerWidth;
  const heightPx = typeof window === "undefined" ? 900 : window.innerHeight;
  return {
    widthPx,
    heightPx,
    layoutHeightPx: heightPx,
    visibleHeightPx: viewport?.height ?? heightPx,
    visibleTopPx: viewport?.offsetTop ?? 0,
    orientation,
    keyboardOpen: editing && coarsePointer && heightPx > (viewport?.height ?? heightPx) + 120,
    coarsePointer,
  };
}

/**
 * Subscribe to the browser viewport exactly like the original hook. Also owns the
 * document-level `--sim-board-height` / `--sim-visible-height` / `--sim-visible-top`
 * variables and `data-sim-pointer` hook used by the shared original CSS.
 */
export function useBoardViewport(enabled = true): BoardViewport | null {
  const [viewport, setViewport] = useState<BoardViewport | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const root = document.documentElement;
    const media =
      typeof window.matchMedia === "function" ? window.matchMedia(COARSE_POINTER_QUERY) : null;
    let frame: number | null = null;

    const apply = () => {
      frame = null;
      const next = readBoardViewport();
      root.style.setProperty("--sim-board-height", `${next.heightPx}px`);
      root.style.setProperty("--sim-visible-height", `${next.visibleHeightPx}px`);
      root.style.setProperty("--sim-visible-top", `${next.visibleTopPx}px`);
      root.dataset.simKeyboardOpen = String(next.keyboardOpen);
      setViewport((current) =>
        current &&
        current.widthPx === next.widthPx &&
        current.heightPx === next.heightPx &&
        current.visibleHeightPx === next.visibleHeightPx &&
        current.visibleTopPx === next.visibleTopPx &&
        current.orientation === next.orientation &&
        current.coarsePointer === next.coarsePointer
          ? current
          : next,
      );
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(apply);
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches(TEXT_INPUT_SELECTOR)) {
        schedule();
      }
    };

    apply();
    media?.addEventListener("change", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onFocus);
    return () => {
      media?.removeEventListener("change", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onFocus);
      if (frame !== null) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--sim-board-height");
      root.style.removeProperty("--sim-visible-height");
      root.style.removeProperty("--sim-visible-top");
      delete root.dataset.simKeyboardOpen;
    };
  }, [enabled]);

  return viewport;
}

/**
 * Pointer-kind tracking (`779142 G`): the original marks the document with
 * `data-sim-pointer="mouse" | "touch"` from real pointer events, so the shared
 * CSS can hide hover-only affordances on touch. Mount once at the board root.
 */
export function useSimPointerTracking(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const root = document.documentElement;
    const finePointer =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(hover: hover) and (pointer: fine)")
        : null;
    const initial = finePointer ? finePointer.matches : true;
    root.dataset.simPointer = initial ? "mouse" : "touch";
    let last: boolean | null = null;

    const setPointer = (mouse: boolean) => {
      if (last === mouse) return;
      last = mouse;
      root.dataset.simPointer = mouse ? "mouse" : "touch";
      if (!mouse) {
        document
          .querySelectorAll("[data-card-action-hover-active]")
          .forEach((element) => element.removeAttribute("data-card-action-hover-active"));
      }
    };

    const onPointer = (event: PointerEvent) => {
      // The original ignores synthetic pointer sources and only flips on real
      // pointerover/pointermove/pointerdown events.
      if (event.pointerType) setPointer(event.pointerType === "mouse");
    };
    const onTouchStart = () => setPointer(false);
    const onClickCapture = (event: MouseEvent) => {
      if (event.detail === 0) return;
      const target = event.target;
      const pointerType = (event as MouseEvent & { pointerType?: string }).pointerType;
      if (
        target instanceof Element &&
        target.closest('[data-card-action-strip="true"]') &&
        (pointerType === "touch" || root.dataset.simPointer === "touch")
      ) {
        // Touch taps on the floating action strip must not bubble into the card.
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("pointerover", onPointer, true);
    document.addEventListener("pointermove", onPointer, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("pointerover", onPointer, true);
      document.removeEventListener("pointermove", onPointer, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("click", onClickCapture, true);
      delete root.dataset.simPointer;
    };
  }, [enabled]);
}
