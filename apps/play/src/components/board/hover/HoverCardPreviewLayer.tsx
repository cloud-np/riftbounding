"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cardArtUrl } from "@/lib/assets";

import { CardArt } from "../card/CardArt";
import { cardMeta } from "../card/card-meta";
import { ProceduralCardFace, domainStyleVars } from "../card/ProceduralCardFace";
import type { HoverPreviewState } from "../interaction/types";
import { useAnimationLevel } from "../theme/motion";
import { tokenArtForName, useBoardCustomization } from "../layout/customization";
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
  const customization = useBoardCustomization();
  const rulesRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const level = useAnimationLevel();
  const hasPreview = !!preview;
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

  // Subtle 3D tilt + foil glare that follow the pointer. Written straight to CSS variables (no
  // React state) and only at the "full" animation level.
  useEffect(() => {
    if (!hasPreview || level !== "full") return;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)));
        const dy = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)));
        el.style.setProperty("--hv-ry", `${(dx * 9).toFixed(2)}deg`);
        el.style.setProperty("--hv-rx", `${(-dy * 7).toFixed(2)}deg`);
        el.style.setProperty("--hv-gx", `${(50 + dx * 45).toFixed(1)}%`);
        el.style.setProperty("--hv-gy", `${(35 + dy * 45).toFixed(1)}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [hasPreview, level]);

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

  const ownerCustomization = preview.card.ownerPlayerId
    ? customization.byPlayerId[preview.card.ownerPlayerId]
    : undefined;
  const customToken =
    preview.card.source === "token" ? tokenArtForName(ownerCustomization, preview.card.name) : undefined;
  const art = cardArtUrl(preview.card, preview.landscape ? "hover" : "preview", { tokenArt: customToken });
  const rotateStyle =
    preview.rotationDeg === 0
      ? undefined
      : {
          width: `${layout.imageWidth}px`,
          height: `${layout.imageHeight}px`,
          transform: `translate(-50%, -50%) rotate(${preview.rotationDeg}deg)`,
        };

  const vars = domainStyleVars(cardMeta(preview.card));

  return createPortal(
    <div
      data-hover-card-preview="true"
      className="pointer-events-none fixed z-2147483647"
      style={{ left: `${layout.x}px`, top: `${layout.y}px`, width: `${layout.outerWidth}px`, ...vars }}
      aria-hidden="true"
    >
      <div className="hv-stage">
        <div
          key={preview.card.id}
          ref={cardRef}
          className="hv-card"
          data-motion={level}
          style={{ width: `${layout.outerWidth}px`, height: `${layout.outerHeight}px` }}
        >
          {preview.landscape ? <ProceduralCardFace card={preview.card} /> : null}
          <div
            className={preview.rotationDeg === 0 ? "absolute inset-0" : "absolute left-1/2 top-1/2"}
            style={rotateStyle}
          >
            <CardArt
              card={preview.card}
              src={art}
              profile={preview.landscape ? "hover" : "preview"}
              fallback={preview.landscape ? "none" : "face"}
              className="absolute inset-0 h-full w-full select-none object-cover"
              alt={preview.card.name}
            />
          </div>
          <span className="hv-rim" />
          <span className="hv-glare" />
        </div>
      </div>
      <div ref={rulesRef} style={{ marginTop: `${HOVER_PREVIEW_RULES_GAP_PX}px` }}>
        <KeywordRulesPanel
          card={preview.card}
          className="hv-rules"
          style={{ fontSize: `${11 * (preview.scale ?? 1)}px` }}
        />
      </div>
    </div>,
    document.body,
  );
}
