"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cardImageUrl, boardPlaymatUrl } from "@/lib/assets";

import type { HoverPreviewState } from "../interaction/types";
import { computeHoverPreviewLayout, HOVER_PREVIEW_RULES_GAP_PX } from "./hover-metrics";
import { KeywordRulesPanel } from "./KeywordRulesPanel";

export interface HoverCardPreviewLayerProps {
  preview: HoverPreviewState | null;
}

/**
 * `HoverCardPreviewLayer` — portal to `document.body`, `z-index: 2147483647`
 * (`439rnwycqsxxv.js:1113-1385`).
 */
export function HoverCardPreviewLayer({ preview }: HoverCardPreviewLayerProps) {
  const rulesRef = useRef<HTMLDivElement | null>(null);
  const [rulesHeight, setRulesHeight] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 720 : window.innerHeight,
  }));

  useLayoutEffect(() => {
    if (!preview) {
      setRulesHeight(0);
      return;
    }
    const measure = () => setRulesHeight(Math.ceil(rulesRef.current?.getBoundingClientRect().height ?? 0));
    measure();
    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [preview?.card.id, preview?.card.text, preview?.scale, preview?.landscape]);

  useLayoutEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const layout = useMemo(() => {
    if (!preview) return null;
    return computeHoverPreviewLayout({
      anchor: preview.anchor,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      landscape: preview.landscape,
      scale: preview.scale,
      rulesHeight,
      preferredSide: preview.preferredSide,
    });
  }, [preview, viewport.width, viewport.height, rulesHeight]);

  if (!preview || !layout || typeof document === "undefined") return null;

  const art = cardImageUrl(preview.card, preview.landscape ? "hover" : "preview");
  const rotateStyle =
    preview.rotationDeg === 0
      ? undefined
      : {
          width: `${layout.imageWidth}px`,
          height: `${layout.imageHeight}px`,
          transform: `translate(-50%, -50%) rotate(${preview.rotationDeg}deg)`,
        };

  return createPortal(
    <div
      data-hover-card-preview="true"
      className="pointer-events-none fixed z-2147483647"
      style={{ left: `${layout.x}px`, top: `${layout.y}px`, width: `${layout.outerWidth}px` }}
      aria-hidden="true"
    >
      <div
        className="relative overflow-hidden rounded-[0.56rem] border-none bg-[rgba(12,20,40,0.95)] shadow-[0_24px_42px_rgba(0,0,0,0.55)]"
        style={{ width: `${layout.outerWidth}px`, height: `${layout.outerHeight}px` }}
      >
        <div
          className={preview.rotationDeg === 0 ? "absolute inset-0" : "absolute left-1/2 top-1/2"}
          style={rotateStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- playmat underlay + original card art */}
          <img src={boardPlaymatUrl()} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element -- original-size card art from the CDN */}
          <img
            src={art}
            alt={preview.card.name}
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>
      <div ref={rulesRef} style={{ marginTop: `${HOVER_PREVIEW_RULES_GAP_PX}px` }}>
        <KeywordRulesPanel
          card={preview.card}
          className="rounded-[0.5rem] border border-[rgba(141,176,232,0.12)] bg-[#090f1d] px-[0.8em] pb-[0.55em] pt-[0.45em] shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
          style={{ fontSize: `${11 * (preview.scale ?? 1)}px` }}
        />
      </div>
    </div>,
    document.body,
  );
}
