"use client";

import { useEffect, useRef, useState } from "react";

import type { CardInstance, Room, Zone } from "@rift/protocol";

import { cardBackUrl, cardImageUrl } from "@/lib/assets";

import { isUnitLikeCard } from "../fx/derive-fx-events";
import type { BoardSlotProps } from "../slot-types";
import { SafeImg } from "../card/SafeImg";

export type FlightKind = "draw" | "banish" | "trash" | "reveal";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Flight {
  id: string;
  card: CardInstance;
  kind: FlightKind;
  start: Rect;
  end: Rect;
  delay: number;
}

const CARD_ASPECT = 88 / 63;
const QUEUE_SPACING_MS = 700;

function rectFrom(selector: string): Rect | null {
  if (typeof document === "undefined") return null;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function center(rect: Rect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function pick(selectors: string[]): Rect | null {
  for (const selector of selectors) {
    const rect = rectFrom(selector);
    if (rect) return rect;
  }
  return null;
}

function deckRect(): Rect {
  return (
    pick([
      '[data-pile-slot="mainDeck"][data-pile-owner="self"]',
      '[data-pile-slot="mainDeck"]',
    ]) ?? { left: window.innerWidth * 0.62, top: window.innerHeight * 0.78, width: 92, height: 128 }
  );
}

function handRect(): Rect {
  return (
    pick([
      '[data-drop-zone-root="hand"][data-zone-owner="self"]',
      '[data-drop-zone-root="hand"]',
    ]) ?? { left: window.innerWidth * 0.5 - 170, top: window.innerHeight * 0.84, width: 340, height: 150 }
  );
}

function zoneRect(kind: FlightKind, zone: Zone): Rect {
  if (kind === "draw") return handRect();
  if (zone === "banished") {
    return (
      pick([
        '[data-pile-slot="banished"][data-pile-owner="self"]',
        '[data-pile-slot="banished"]',
      ]) ?? { left: window.innerWidth * 0.9, top: window.innerHeight * 0.8, width: 64, height: 90 }
    );
  }
  return (
    pick([
      '[data-drop-zone-root="trash"][data-zone-owner="self"]',
      '[data-drop-zone-root="trash"]',
    ]) ?? { left: window.innerWidth * 0.86, top: window.innerHeight * 0.8, width: 64, height: 90 }
  );
}

function rectForCard(map: Map<string, Rect>, cardId: string): Rect | null {
  return map.get(cardId) ?? null;
}

function zoneCards(room: Room, playerId: string, zone: Zone): CardInstance[] {
  const player = room.players.find((candidate) => candidate.id === playerId);
  return (player?.board?.[zone] as CardInstance[] | undefined) ?? [];
}

function wasIn(room: Room, playerId: string, cardId: string, zones: Zone[]): Zone | null {
  for (const zone of zones) {
    if (zoneCards(room, playerId, zone).some((card) => card.id === cardId)) return zone;
  }
  return null;
}

function CardFlight({
  flight,
  cardWidthPx,
  onDone,
}: {
  flight: Flight;
  cardWidthPx: number;
  onDone: (id: string) => void;
}) {
  const positionRef = useRef<HTMLDivElement | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const flipRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setStarted(true), flight.delay);
    return () => window.clearTimeout(timer);
  }, [flight.delay]);

  useEffect(() => {
    if (!started) return;
    const position = positionRef.current;
    const pulse = pulseRef.current;
    const flip = flipRef.current;
    const overlay = overlayRef.current;
    if (!position || !pulse || !flip) {
      onDone(flight.id);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = center(flight.start);
    const end = center(flight.end);
    const width = cardWidthPx;
    const height = width * CARD_ASPECT;
    const sourceWidth = Math.max(24, flight.start.width);
    const startScale = Math.max(0.35, sourceWidth / width);
    const fromX = start.x - width / 2;
    const fromY = start.y - height / 2;
    const toX = end.x - width / 2;
    const toY = end.y - height / 2;
    const midX = fromX + (toX - fromX) * 0.12;
    const midY = fromY + (toY - fromY) * 0.12;
    const midScale = startScale + (1.05 - startScale) * 0.12;
    const animations: Animation[] = [];
    const timers: number[] = [];

    position.style.left = `${fromX}px`;
    position.style.top = `${fromY}px`;
    position.style.width = `${width}px`;
    position.style.height = `${height}px`;
    position.style.transformOrigin = "center";

    const finish = () => {
      for (const timer of timers) window.clearTimeout(timer);
      onDone(flight.id);
    };

    if (reduced) {
      animations.push(
        position.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 200,
          fill: "forwards",
          easing: "ease-out",
        }),
      );
      timers.push(
        window.setTimeout(() => {
          position.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 200,
            fill: "forwards",
            easing: "ease-in",
          });
          timers.push(window.setTimeout(finish, 210));
        }, 1100),
      );
      return () => {
        for (const animation of animations) animation.cancel();
        for (const timer of timers) window.clearTimeout(timer);
      };
    }

    animations.push(
      position.animate(
        [
          {
            transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(${startScale})`,
            opacity: 0,
            offset: 0,
          },
          {
            transform: `translate3d(${midX}px, ${midY}px, 0) scale(${midScale})`,
            opacity: 1,
            offset: 0.12,
          },
          {
            transform: `translate3d(${toX}px, ${toY}px, 0) scale(1)`,
            opacity: 1,
            offset: 1,
          },
        ],
        {
          duration: 440,
          easing: "cubic-bezier(0.2, 0.8, 0.25, 1)",
          fill: "forwards",
        },
      ),
    );
    animations.push(
      flip.animate([{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], {
        duration: 340,
        delay: 440,
        easing: "cubic-bezier(0.3, 0.7, 0.2, 1)",
        fill: "forwards",
      }),
    );
    if (overlay) {
      animations.push(
        overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 360,
          delay: 440,
          easing: "ease-out",
          fill: "forwards",
        }),
      );
    }
    animations.push(
      pulse.animate([{ transform: "scale(1)" }, { transform: "scale(1.035)" }], {
        duration: 680,
        delay: 780,
        easing: "ease-in-out",
        fill: "forwards",
      }),
    );

    if (flight.kind === "draw") {
      timers.push(
        window.setTimeout(() => {
          position.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 260,
            fill: "forwards",
            easing: "ease-out",
          });
        }, 1460),
      );
      timers.push(window.setTimeout(finish, 1740));
    } else {
      timers.push(
        window.setTimeout(() => {
          const returnX = end.x - width / 2;
          const returnY = end.y - height / 2;
          position.animate(
            [
              { transform: `translate3d(${toX}px, ${toY}px, 0) scale(1)` },
              { transform: `translate3d(${returnX}px, ${returnY}px, 0) scale(${0.6})` },
            ],
            {
              duration: 560,
              easing: "cubic-bezier(0.55, 0, 0.3, 1)",
              fill: "forwards",
            },
          );
          if (flight.kind === "banish") {
            position.animate(
              [
                { clipPath: "inset(0 round 8px)" },
                { clipPath: "inset(42% 42% 42% 42% round 50%)" },
              ],
              {
                duration: 420,
                easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                fill: "forwards",
              },
            );
          } else {
            position.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: 260,
              delay: 300,
              fill: "forwards",
              easing: "ease-out",
            });
          }
        }, 1460),
      );
      timers.push(window.setTimeout(finish, 2060));
    }

    // Draw/discard sounds come from the action-sound pipeline; playing them here doubled them.

    return () => {
      for (const animation of animations) animation.cancel();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [cardWidthPx, flight, onDone, started]);

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[2147483400]"
      aria-hidden="true"
      data-card-flight={flight.kind}
      data-card-id={flight.card.id}
      style={{ visibility: started ? "visible" : "hidden" }}
    >
      <div ref={positionRef} className="absolute" style={{ willChange: "transform, opacity" }}>
        <div ref={pulseRef} className="absolute inset-0" style={{ willChange: "transform" }}>
          <div className="banish-reveal-glow" />
          <div className="banish-reveal-clip relative h-full w-full">
            <div ref={flipRef} className="banish-reveal-flip relative h-full w-full">
              <div className="banish-reveal-front absolute inset-0 overflow-hidden rounded-[8px] border border-[rgba(165,184,207,0.22)] bg-[linear-gradient(165deg,rgba(49,73,99,0.96),rgba(34,53,74,0.94))] shadow-[inset_0_0_0_1px_rgba(188,206,228,0.06),0_10px_20px_rgba(4,10,24,0.42)]">
                <SafeImg
                  src={cardImageUrl(flight.card, "preview")}
                  alt={flight.card.name}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                <div ref={overlayRef} className="absolute inset-0 opacity-0">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,24,0)_0%,rgba(4,10,24,0)_58%,rgba(4,10,24,0.12)_78%,rgba(5,10,24,0.44)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(8,18,34,0),rgba(8,18,34,0.88))] px-2 pb-1.5 pt-5 text-[0.62rem] font-bold text-[#eef4ff]">
                    {flight.card.name}
                  </div>
                </div>
              </div>
              <div className="banish-reveal-back absolute inset-0 overflow-hidden rounded-[8px] border border-[rgba(165,184,207,0.22)]">
                <SafeImg src={cardBackUrl("deck")} alt="Card back" className="h-full w-full object-cover" draggable={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardFlightLayer({ state, viewerId }: Pick<BoardSlotProps, "state" | "viewerId">) {
  const previousRoom = useRef<Room | null>(null);
  const previousViewer = useRef<string | null>(null);
  const rectsRef = useRef<Map<string, Rect>>(new Map());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [cardWidthPx, setCardWidthPx] = useState(83);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const board = document.querySelector<HTMLElement>(".gb-board");
    const rootRem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const raw = board ? getComputedStyle(board).getPropertyValue("--card-width").trim() : "";
    const width = Number.parseFloat(raw) * (raw.endsWith("rem") ? rootRem : 1);
    if (Number.isFinite(width) && width > 0) setCardWidthPx(width);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "in_game") {
      previousRoom.current = state;
      previousViewer.current = viewerId;
      setFlights([]);
      return;
    }
    const previous = previousRoom.current;
    const viewerChanged = previousViewer.current !== viewerId;
    if (!previous || viewerChanged) {
      previousRoom.current = state;
      previousViewer.current = viewerId;
      return;
    }

    const next: Flight[] = [];
    const now = Date.now();
    const currentHand = zoneCards(state, viewerId, "hand");
    const previousHand = zoneCards(previous, viewerId, "hand");
    const previousHandIds = new Set(previousHand.map((card) => card.id));

    for (const card of currentHand) {
      if (previousHandIds.has(card.id)) continue;
      next.push({
        id: `draw-${card.id}-${now}`,
        card,
        kind: "draw",
        start: deckRect(),
        end: handRect(),
        delay: next.length * QUEUE_SPACING_MS,
      });
    }

    const previousBanished = new Set(zoneCards(previous, viewerId, "banished").map((card) => card.id));
    for (const card of zoneCards(state, viewerId, "banished")) {
      if (previousBanished.has(card.id)) continue;
      const fromZone = wasIn(previous, viewerId, card.id, [
        "hand",
        "base",
        "battlefieldA",
        "battlefieldB",
        "battlefieldC",
        "battlefieldToken",
      ]);
      if (!fromZone) continue;
      if (fromZone !== "hand" && isUnitLikeCard(card)) continue; // FxDirector death dissolve
      next.push({
        id: `banish-${card.id}-${now}`,
        card,
        kind: "banish",
        start: rectForCard(rectsRef.current, card.id) ?? handRect(),
        end: zoneRect("banish", "banished"),
        delay: next.length * QUEUE_SPACING_MS,
      });
    }

    const currentTrash = new Set(zoneCards(state, viewerId, "trash").map((card) => card.id));
    const previousTrash = new Set(zoneCards(previous, viewerId, "trash").map((card) => card.id));
    for (const card of zoneCards(state, viewerId, "trash")) {
      if (previousTrash.has(card.id)) continue;
      const fromZone = wasIn(previous, viewerId, card.id, [
        "hand",
        "base",
        "battlefieldA",
        "battlefieldB",
        "battlefieldC",
        "battlefieldToken",
      ]);
      if (!fromZone) continue;
      if (fromZone !== "hand" && isUnitLikeCard(card)) continue; // FxDirector death dissolve
      next.push({
        id: `trash-${card.id}-${now}`,
        card,
        kind: "trash",
        start: rectForCard(rectsRef.current, card.id) ?? handRect(),
        end: zoneRect("trash", "trash"),
        delay: next.length * QUEUE_SPACING_MS,
      });
    }

    if (next.length > 0) setFlights((current) => [...current, ...next].slice(-8));
    previousRoom.current = state;
    previousViewer.current = viewerId;

    const snapshot = new Map<string, Rect>();
    document.querySelectorAll<HTMLElement>("[data-card-id]").forEach((element) => {
      const id = element.dataset.cardId;
      if (!id) return;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        snapshot.set(id, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      }
    });
    rectsRef.current = snapshot;
  }, [state, viewerId]);

  const removeFlight = (id: string) => {
    setFlights((current) => current.filter((flight) => flight.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[2147483400]" data-card-flight-layer="true">
      {flights.map((flight) => (
        <div key={flight.id} style={{ pointerEvents: "none" }}>
          <CardFlight flight={flight} cardWidthPx={cardWidthPx} onDone={removeFlight} />
        </div>
      ))}
    </div>
  );
}
