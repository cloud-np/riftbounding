"use client";

/**
 * Board emote flights — original `r3` / `ae` (`0xawjzm3yjpr1.js:5590-5880`).
 *
 * A board emote starts in a 76x76 fixed box beside the sender avatar, arcs
 * toward the middle of the board and fades out. Poro emotes fly for 3200 ms,
 * base emotes for 1080 ms; the overlay lives `duration + 96` ms.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { motion } from "framer-motion";

import type { Room } from "@rift/protocol";

import type { PresenceSnapshot } from "@/runtime/presence";

import { EmoteGlyph } from "./EmoteGlyph";
import { EMOTE_BY_ID } from "./emote-catalog";
import { boardEmoteDuration, emoteFlightGeometry } from "./emote-flight-math";
import { PLAYER_COLORS } from "../hover/player-colors";

export const BOARD_EMOTE_EVENT = "riftbound:board-emote";

interface Flight {
  key: string;
  emoteId: string;
  eventId: number;
  senderPlayerId: string;
  startLeftPx: number;
  startTopPx: number;
  offsetXPx: number;
  offsetYPx: number;
  arcXPx: number;
}

const EASE: [number, number, number, number] = [0.22, 0.9, 0.2, 1];
const TIMES = [0, 0.5, 1] as const;

function translate(x: number, y: number): string {
  return `translateX(${x}px) translateY(${y}px)`;
}

export function EmoteFlightLayer({
  room,
  viewerId,
  presence,
}: {
  room: Room;
  viewerId: string;
  presence?: PresenceSnapshot;
}) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const seenRef = useRef(new Set<string>());
  const timersRef = useRef<number[]>([]);
  const eventIdRef = useRef(0);

  const boardRect = useCallback((): DOMRect | null => {
    if (typeof document === "undefined") return null;
    const board =
      document.querySelector<HTMLElement>("[data-board-play-area]") ??
      document.querySelector<HTMLElement>('[data-testid="game-ready"]');
    return board?.getBoundingClientRect() ?? null;
  }, []);

  const spawn = useCallback(
    (emoteId: string, senderPlayerId: string, eventId: number, senderSide: "top" | "bottom") => {
      const rect = boardRect();
      if (!rect || rect.width <= 0) return;
      const key = `${senderPlayerId}:${eventId}`;
      setFlights((current) => {
        if (current.some((flight) => flight.key === key)) return current;
        return [
          ...current.filter(
            (flight) =>
              flight.senderPlayerId !== senderPlayerId ||
              EMOTE_BY_ID.get(flight.emoteId)?.pack !== "poro",
          ),
          {
            key,
            emoteId,
            eventId,
            senderPlayerId,
            ...emoteFlightGeometry({ boardRect: rect, senderSide, eventId }),
          },
        ];
      });
      const timer = window.setTimeout(() => {
        setFlights((current) => current.filter((flight) => flight.key !== key));
      }, boardEmoteDuration(emoteId) + 96);
      timersRef.current.push(timer);
    },
    [boardRect],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
    };
  }, []);

  // Remote emotes from `presence_event.board_emote`.
  useEffect(() => {
    if (!presence) return;
    for (const [playerId, emote] of Object.entries(presence.boardEmoteByPlayerId)) {
      if (!emote || playerId === viewerId) continue;
      const key = `${playerId}:${emote.emoteAt}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      if (Date.now() - emote.emoteAt > 3000) continue;
      spawn(emote.emoteId, playerId, emote.emoteAt, "top");
    }
  }, [presence, spawn, viewerId]);

  // Local selection (the original resolves this through `playBoardEmoteForPlayer`).
  useEffect(() => {
    const onLocalEmote = (event: Event) => {
      const detail = (event as CustomEvent<{ emoteId?: string }>).detail;
      if (!detail?.emoteId) return;
      const eventId = Math.max(Date.now(), ++eventIdRef.current);
      spawn(detail.emoteId, viewerId, eventId, "bottom");
    };
    window.addEventListener(BOARD_EMOTE_EVENT, onLocalEmote);
    return () => window.removeEventListener(BOARD_EMOTE_EVENT, onLocalEmote);
  }, [spawn, viewerId]);

  if (flights.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[205]" aria-hidden="true" data-emote-flight-layer="true">
      {flights.map((flight) => {
        const emote = EMOTE_BY_ID.get(flight.emoteId);
        if (!emote) return null;
        const playerIndex = Math.max(
          0,
          room.players.findIndex((player) => player.id === flight.senderPlayerId),
        );
        const playerColor = PLAYER_COLORS[(["p1", "p2", "p3", "p4"] as const)[playerIndex % 4]!];
        const isPoro = emote.pack === "poro";
        const duration = boardEmoteDuration(flight.emoteId) / 1000;
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const sx = reduced ? flight.offsetXPx * 0.18 : flight.offsetXPx;
        const sy = reduced ? flight.offsetYPx * 0.18 : flight.offsetYPx;
        const arc = reduced ? 0 : flight.arcXPx;
        const transform = reduced
          ? translate(sx, sy)
          : [translate(0, 0), translate(arc, 0.62 * sy), translate(sx, sy)];
        const scale = reduced
          ? 1
          : isPoro
            ? [0.88, 1, 1, 0.96]
            : [0.82, 1, 1.12, 0.94];
        return (
          <motion.div
            key={flight.key}
            data-board-emote-sender-player-id={flight.senderPlayerId}
            data-board-emote-player-color={playerIndex}
            className="pointer-events-none fixed z-[205]"
            initial={{ opacity: 0, transform: Array.isArray(transform) ? transform[0] : transform }}
            animate={{ opacity: [0, 1, 1, 0], transform, scale }}
            transition={{
              opacity: { duration, times: [...TIMES], ease: EASE },
              transform: { duration, times: [...TIMES], ease: EASE },
              scale: { duration, times: isPoro ? [0, 0.07, 0.92, 1] : [0, 0.18, 0.76, 1], ease: EASE },
            }}
            style={{
              left: flight.startLeftPx,
              top: flight.startTopPx,
              width: 76,
              height: 76,
              filter: `drop-shadow(0 0 ${isPoro ? 12 : 20}px ${emote.accentColor}66) drop-shadow(0 0 11px ${playerColor.solid}) drop-shadow(0 8px 10px rgba(3,8,20,0.3))`,
            }}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <span
                role="img"
                aria-label={emote.label}
                className="select-none text-[2.45rem] leading-none [text-shadow:0_3px_10px_rgba(12,20,34,0.18),0_10px_22px_rgba(3,8,20,0.14)]"
              >
                <EmoteGlyph id={flight.emoteId} animated playback="burst" replayToken={flight.eventId} />
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
