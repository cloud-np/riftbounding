/**
 * Hover-preview sizing / placement — port of the size solver + clamp logic in
 * `HoverCardPreviewLayer` (`439rnwycqsxxv.js:1113-1385`, `0xawjzm3yjpr1.js:50860-50980`).
 *
 * The original reads the preview-size setting (`lO.m(...) * settingsScale`) and
 * the card aspect from `--card-width`; card art is always the original bucket.
 */

export const HOVER_PREVIEW_MARGIN_PX = 8;
export const HOVER_PREVIEW_GAP_PX = 12;
export const HOVER_PREVIEW_RULES_GAP_PX = 4;
/** Rules-panel base font (px at preview scale 1); rules text is 1em of this, so >= 14px by default. */
export const HOVER_RULES_BASE_FONT_PX = 14;
export const CARD_ASPECT = 1.392857;

export interface PreviewAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface HoverPreviewLayoutInput {
  anchor: PreviewAnchorRect;
  viewportWidth: number;
  viewportHeight: number;
  landscape?: boolean;
  scale?: number;
  rulesHeight?: number;
  preferredSide?: "left" | "right";
}

export interface HoverPreviewLayout {
  x: number;
  y: number;
  outerWidth: number;
  outerHeight: number;
  imageWidth: number;
  imageHeight: number;
  placement: "right" | "left" | "above" | "below";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** `lO.c` / `lO.u` — preview box + image size in CSS px. */
export function hoverPreviewSize(input: {
  viewportWidth: number;
  viewportHeight: number;
  landscape?: boolean;
  scale?: number;
}): { outerWidth: number; outerHeight: number; imageWidth: number; imageHeight: number } {
  const scale = Math.max(0.6, Math.min(1.6, input.scale ?? 1));
  if (input.landscape) {
    const imageHeight = clamp(input.viewportHeight * 0.26, 132, 232) * scale;
    const imageWidth = imageHeight * CARD_ASPECT;
    return {
      outerWidth: Math.round(imageWidth),
      outerHeight: Math.round(imageHeight),
      imageWidth: Math.round(imageWidth),
      imageHeight: Math.round(imageHeight),
    };
  }
  const imageWidth = clamp(input.viewportWidth * 0.2, 192, 310) * scale;
  const imageHeight = imageWidth * CARD_ASPECT;
  return {
    outerWidth: Math.round(imageWidth),
    outerHeight: Math.round(imageHeight),
    imageWidth: Math.round(imageWidth),
    imageHeight: Math.round(imageHeight),
  };
}

/** `lO.d` + the preview layer's y clamp. */
export function computeHoverPreviewLayout(input: HoverPreviewLayoutInput): HoverPreviewLayout {
  const { anchor, viewportWidth, viewportHeight, landscape = false, scale = 1, rulesHeight = 0 } = input;
  const size = hoverPreviewSize({ viewportWidth, viewportHeight, landscape, scale });
  const margin = HOVER_PREVIEW_MARGIN_PX;
  const gap = HOVER_PREVIEW_GAP_PX;
  const totalHeight = size.outerHeight + (rulesHeight > 0 ? HOVER_PREVIEW_RULES_GAP_PX + rulesHeight : 0);

  const roomRight = viewportWidth - anchor.right - gap;
  const roomLeft = anchor.left - gap;
  let placement: HoverPreviewLayout["placement"];
  let x: number;
  const preferred = input.preferredSide ?? "right";
  if (preferred === "right" && roomRight >= size.outerWidth) {
    placement = "right";
    x = anchor.right + gap;
  } else if (roomLeft >= size.outerWidth) {
    placement = "left";
    x = anchor.left - gap - size.outerWidth;
  } else if (anchor.bottom + gap + totalHeight <= viewportHeight - margin) {
    placement = "below";
    x = anchor.left + anchor.width / 2 - size.outerWidth / 2;
  } else {
    placement = "above";
    x = anchor.left + anchor.width / 2 - size.outerWidth / 2;
  }
  x = clamp(x, margin, Math.max(margin, viewportWidth - size.outerWidth - margin));

  let y: number;
  if (placement === "below") {
    y = anchor.bottom + gap;
  } else if (placement === "above") {
    y = anchor.top - gap - totalHeight;
  } else {
    y = anchor.top + anchor.height / 2 - totalHeight / 2;
  }
  const maxY = Math.max(margin, viewportHeight - margin - totalHeight);
  y = clamp(y, margin, maxY);

  return { x: Math.round(x), y: Math.round(y), ...size, placement };
}

/** Default hover delay (the board preview arms immediately; a short debounce keeps fan sweeps calm). */
export const HOVER_PREVIEW_DELAY_MS = 90;
