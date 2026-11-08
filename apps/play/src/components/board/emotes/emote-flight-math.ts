import { EMOTE_BY_ID } from "./emote-catalog";

export function boardEmoteDuration(emoteId: string): number {
  return EMOTE_BY_ID.get(emoteId)?.pack === "poro" ? 3200 : 1080;
}

/** Original `ae` flight geometry from `0xawjzm3yjpr1.js:50598-50623`. */
export function emoteFlightGeometry({
  boardRect,
  senderSide,
  eventId,
}: {
  boardRect: { left: number; top: number; width: number; height: number };
  senderSide: "top" | "bottom";
  eventId: number;
}) {
  const centerX = boardRect.left + boardRect.width / 2;
  const centerY = boardRect.top + boardRect.height / 2;
  const c = Math.max(26, Math.min(0.14 * boardRect.height, 0.18 * boardRect.height));
  const startCenterY = senderSide === "bottom" ? centerY + c : centerY - c;
  const targetCenterY = senderSide === "bottom" ? centerY + 0.22 * c : centerY - 0.22 * c;
  const p = Math.max(8, Math.min(14, 0.015 * boardRect.width));
  const horizontalJitter = ((Math.abs(Math.trunc(eventId)) % 5) - 2) * p;
  const startCenterX = centerX + horizontalJitter;
  return {
    startLeftPx: startCenterX - 38,
    startTopPx: startCenterY - 38,
    offsetXPx: centerX + (startCenterX - centerX) * 0.32 - startCenterX,
    offsetYPx: targetCenterY - startCenterY,
    arcXPx:
      (Math.abs(Math.trunc(eventId)) % 2 === 0 ? 1 : -1) *
      Math.max(10, Math.min(24, 0.02 * boardRect.width)),
  };
}
