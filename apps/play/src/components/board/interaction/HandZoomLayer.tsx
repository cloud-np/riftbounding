"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CardInstance } from "@rift/protocol";

import { CardFullFace } from "../card/CardFullFace";
import { KeywordRulesPanel } from "../hover/KeywordRulesPanel";
import { useAnimationLevel } from "../theme/motion";

const CARD_ASPECT = 1.392857;
const MARGIN = 12;
const RULES_WIDTH = 272;
const GAP = 14;

export interface HandZoomAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Enlarged size/position of the raised copy (exported for tests). */
export function computeHandZoomLayout(anchor: HandZoomAnchor, viewport: { width: number; height: number }) {
  const maxHeight = viewport.height - MARGIN * 2;
  const height = Math.min(maxHeight, Math.max(Math.min(360, maxHeight), viewport.height * 0.45));
  const width = height / CARD_ASPECT;
  const cx = anchor.left + anchor.width / 2;
  const left = Math.max(MARGIN, Math.min(cx - width / 2, viewport.width - width - MARGIN));
  const top = viewport.height - MARGIN - height;
  const roomRight = viewport.width - (left + width) - MARGIN;
  const roomLeft = left - MARGIN;
  const rulesSide: "right" | "left" = roomRight >= roomLeft ? "right" : "left";
  const rulesW = Math.max(160, Math.min(RULES_WIDTH, (rulesSide === "right" ? roomRight : roomLeft) - GAP));
  const rulesLeft = rulesSide === "right" ? left + width + GAP : left - GAP - rulesW;
  return { left, top, width, height, rulesSide, rulesW, rulesLeft };
}

/**
 * Hearthstone / MTG Arena style hand zoom: an enlarged, fully readable copy of the hovered own-hand
 * card rises above its slot. Never interactive (pointer-events none) so hover stays on the slot.
 */
export function HandZoomLayer({ card, anchor }: { card: CardInstance | null; anchor: HandZoomAnchor | null }) {
  const level = useAnimationLevel();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 720 : window.innerHeight,
  }));

  useLayoutEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const layout = card && anchor ? computeHandZoomLayout(anchor, viewport) : null;

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !layout || !anchor || level !== "full") return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const sx = anchor.width / layout.width;
    const dx = anchor.left + anchor.width / 2 - (layout.left + layout.width / 2);
    const dy = anchor.top + anchor.height - (layout.top + layout.height);
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, opacity: 0.6 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 200, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)" },
    );
    return () => anim.cancel();
    // Re-run only when a different card is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  if (!card || !layout || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-hand-zoom="true"
      data-hand-zoom-card={card.id}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2147483000]"
    >
      <div
        ref={cardRef}
        className="absolute rounded-[0.7rem] overflow-hidden"
        data-hand-zoom-card-face="true"
        style={{
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
          transformOrigin: "50% 100%",
          boxShadow: "0 1.4rem 2.6rem rgba(0,0,0,0.65)",
        }}
      >
        <CardFullFace card={card} profile="preview" side="self" />
      </div>
      <div
        className="absolute"
        data-hand-zoom-rules="true"
        style={{ left: layout.rulesLeft, width: layout.rulesW, bottom: MARGIN, maxHeight: layout.height }}
      >
        <KeywordRulesPanel
          card={card}
          className="hv-rules"
          style={{
            fontSize: "14px",
            background: "linear-gradient(180deg, var(--rb-surface-2, #15171b), var(--rb-surface, #0e0f12) 70%)",
            borderColor: "var(--rb-border-strong, rgba(200,170,110,0.45))",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
