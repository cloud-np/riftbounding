"use client";

import { useEffect, useRef, useState } from "react";

import type { PresenceSnapshot } from "@/runtime/presence";

import { playBoardSound } from "../interaction/sfx";
import { PingOverlay, type PingVariant } from "./PingOverlay";

/** Original `uo.B` — ping visual TTL. */
const PING_VISIBLE_MS = 2400;

interface PingFlash {
  key: string;
  cardId: string;
  eventId: number;
  variant: PingVariant;
  left: number;
  top: number;
  width: number;
  height: number;
}

function variantForElement(element: HTMLElement): PingVariant {
  const zone =
    element.closest<HTMLElement>("[data-drop-zone]")?.dataset.dropZone ??
    element.dataset.dropZone ??
    "";
  return /^battlefield/.test(zone) || zone === "runeArea" ? "battlefieldMarker" : "hand";
}

function measurePings(
  presence: PresenceSnapshot | undefined,
  viewerId: string,
  now: number,
): PingFlash[] {
  if (!presence || typeof document === "undefined") return [];
  const result: PingFlash[] = [];
  for (const [playerId, ping] of Object.entries(presence.cardPingByPlayerId)) {
    if (!ping || playerId === viewerId) continue;
    if (now - ping.receivedAt >= PING_VISIBLE_MS) continue;
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-card-id="${CSS.escape(ping.cardId)}"]`),
    );
    const element = elements.find((candidate) => candidate.getClientRects().length > 0);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const anchor = element.closest<HTMLElement>("[data-hover-preview-anchor]") ?? element;
    const anchorRect = anchor.getBoundingClientRect();
    result.push({
      key: `${playerId}:${ping.pingedAt}:${ping.cardId}`,
      cardId: ping.cardId,
      eventId: ping.pingedAt,
      variant: variantForElement(anchor),
      left: anchorRect.left,
      top: anchorRect.top,
      width: anchorRect.width,
      height: anchorRect.height,
    });
  }
  return result;
}

/**
 * Remote presence effects. Pings paint the original six-layer golden flash over
 * the pinged card (variants `hand` / `battlefieldMarker`, module 766225).
 * Emote flights are rendered by `EmoteFlightLayer`.
 */
export function PresenceEffects({
  viewerId,
  presence,
}: {
  viewerId: string;
  presence?: PresenceSnapshot;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [pings, setPings] = useState<PingFlash[]>([]);
  const seenPings = useRef(new Set<string>());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!presence) return;
    for (const [playerId, ping] of Object.entries(presence.cardPingByPlayerId)) {
      if (!ping || playerId === viewerId) continue;
      const key = `${playerId}:${ping.pingedAt}:${ping.cardId}`;
      if (seenPings.current.has(key)) continue;
      seenPings.current.add(key);
      if (now - ping.receivedAt < PING_VISIBLE_MS) playBoardSound("ping");
    }
  }, [now, presence, viewerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const measured = measurePings(presence, viewerId, Date.now());
      setPings((current) => {
        if (
          current.length === measured.length &&
          current.every((ping, index) => {
            const next = measured[index];
            return (
              next &&
              ping.key === next.key &&
              ping.left === next.left &&
              ping.top === next.top &&
              ping.width === next.width &&
              ping.height === next.height
            );
          })
        ) {
          return current;
        }
        return measured;
      });
    };
    const onFrame = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    const interval = window.setInterval(onFrame, 220);
    window.addEventListener("resize", onFrame);
    window.addEventListener("scroll", onFrame, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", onFrame);
      window.removeEventListener("scroll", onFrame, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [now, presence, viewerId]);

  if (!presence || pings.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[160]" data-presence-effects="true">
      {pings.map((ping) => (
        <div
          key={ping.key}
          className="pointer-events-none fixed z-[160]"
          style={{ left: ping.left, top: ping.top, width: ping.width, height: ping.height }}
          data-card-ping-active="true"
          data-card-id={ping.cardId}
        >
          <PingOverlay variant={ping.variant} eventId={ping.eventId} />
        </div>
      ))}
    </div>
  );
}
