"use client";

import { useEffect, useId, useState } from "react";

import type { Room, TargetArrow } from "@rift/protocol";

import { useAnimationLevel } from "../theme/motion";
import { buildArrowGeometry } from "./arrow-geometry";
import { playerColorFor, playerColorKeyFor } from "./player-colors";

export interface ResolvedArrow {
  owner: "self" | "opponent";
  playerId: string;
  playerColorKey?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Quadratic Bezier control point (the filled arrow is rebuilt from it). */
  ctrlX: number;
  ctrlY: number;
  path: string;
}

export interface StrictAimTarget {
  targetId: string;
  index: number;
}

export interface StrictAimArrow {
  active: boolean;
  sourceId: string;
  sourceAnchor: "board" | "chain";
  optionIds: ReadonlySet<string>;
  /** Multi-target selection: source → each pinned target, with a 1-based badge. */
  pinned?: readonly StrictAimTarget[];
}

function elementCenter(element: HTMLElement | null): { x: number; y: number } | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Option ids named by one DOM anchor. Cards include attached gear (fan-out), battlefields and
 * player seats each expose one of these data attributes.
 */
export function aimTargetIdsForElement(element: HTMLElement | null): string[] {
  if (!element) return [];
  const ids: string[] = [];
  const add = (value: string | undefined) => {
    if (value && !ids.includes(value)) ids.push(value);
  };
  add(element.dataset.cardId);
  add(element.dataset.attachedCardId);
  add(element.dataset.battlefieldMarker);
  add(element.dataset.dropZoneRoot);
  add(element.dataset.targetPlayerId);
  const card = element.closest<HTMLElement>("[data-card-id]");
  if (card) add(card.dataset.cardId);
  const attached = element.closest<HTMLElement>("[data-attached-card-id]");
  if (attached) add(attached.dataset.attachedCardId);
  const marker = element.closest<HTMLElement>("[data-battlefield-marker]");
  if (marker) add(marker.dataset.battlefieldMarker);
  const zone = element.closest<HTMLElement>("[data-drop-zone-root]");
  if (zone) add(zone.dataset.dropZoneRoot);
  const player = element.closest<HTMLElement>("[data-target-player-id]");
  if (player) add(player.dataset.targetPlayerId);
  return ids;
}

function anchorForId(id: string, anchor: "board" | "chain"): { x: number; y: number } | null {
  if (typeof document === "undefined") return null;
  const selectors =
    anchor === "chain"
      ? [
          `[data-chain-entry-id="${CSS.escape(id)}"]`,
          `[data-chain-card-id="${CSS.escape(id)}"]`,
          `[data-card-id="${CSS.escape(id)}"]`,
        ]
      : [
          `[data-card-id="${CSS.escape(id)}"]`,
          `[data-attached-card-id="${CSS.escape(id)}"]`,
          `[data-battlefield-marker="${CSS.escape(id)}"]`,
          `[data-drop-zone-root="${CSS.escape(id)}"]`,
          `[data-target-player-id="${CSS.escape(id)}"]`,
        ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const center = elementCenter(element);
    if (center) return center;
  }
  return null;
}

function cardAnchor(cardId: string, anchor: "board" | "chain"): { x: number; y: number } | null {
  return anchorForId(cardId, anchor);
}

function hiddenCardIds(room: Room): Set<string> {
  const ids = new Set<string>();
  for (const player of room.players) {
    const board = player.board as unknown as Record<string, unknown> | undefined;
    if (!board) continue;
    for (const value of Object.values(board)) {
      if (!Array.isArray(value)) continue;
      for (const card of value as Array<{ id?: string; hidden?: boolean; isPlaceholder?: boolean }>) {
        if (card?.id && (card.hidden || card.isPlaceholder)) ids.add(card.id);
      }
    }
  }
  return ids;
}

function chainTargetIds(choices: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const [key, value] of Object.entries(choices)) {
    if (key !== "target" && !key.startsWith("target:")) continue;
    for (const id of Array.isArray(value) ? value : [value]) {
      if (typeof id === "string" && id.length > 0 && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Pure aim resolution: snap to the first candidate id that is a prompt option. */
export function aimTargetForIds(
  candidateIds: readonly string[],
  optionIds: ReadonlySet<string>,
): { targetId: string | null; status: "valid" | "invalid" | "none" } {
  const targetId = candidateIds.find((id) => optionIds.has(id)) ?? null;
  if (targetId) return { targetId, status: "valid" };
  return { targetId: null, status: candidateIds.length > 0 ? "invalid" : "none" };
}

export { chainTargetIds };

/** Passive public targeting arrows for chosen chain targets (both viewers). */
export function collectChainTargetArrows(
  state: Room,
  viewerId: string,
  anchorFor: (id: string, anchor: "board" | "chain") => { x: number; y: number } | null,
): ResolvedArrow[] {
  const out: ResolvedArrow[] = [];
  const hiddenIds = hiddenCardIds(state);
  for (const item of state.rules?.chain ?? []) {
    const start = anchorFor(item.id, "chain");
    if (!start) continue;
    const controllerIndex = state.players.findIndex((player) => player.id === item.controller);
    const playerColorKey = playerColorKeyFor(controllerIndex);
    for (const targetId of chainTargetIds(item.choices as Record<string, unknown>)) {
      if (hiddenIds.has(targetId)) continue;
      const end = anchorFor(targetId, "board");
      if (!end) continue;
      out.push({
        owner: item.controller === viewerId ? "self" : "opponent",
        playerId: item.controller,
        playerColorKey,
        ...curve(start, end),
      });
    }
  }
  return out;
}

function curve(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(110, Math.max(24, 0.2 * length));
  const controlX = start.x + 0.5 * dx + (length > 0.001 ? (-dy / length) * bend : 0);
  const controlY = start.y + 0.5 * dy + (length > 0.001 ? (dx / length) * bend : -1);
  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    ctrlX: controlX,
    ctrlY: controlY,
    path: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  };
}

export interface TargetArrowOverlayProps {
  state: Room;
  viewerId: string;
  live?: boolean;
  /** Strict targeting: source, option set and pinned multi-targets. */
  aim?: StrictAimArrow | null;
}

interface AimState {
  x: number;
  y: number;
  targetId: string | null;
  snap: { x: number; y: number } | null;
}

/**
 * Target-arrow SVG layer: a tapered, dark-outlined arrow (gradient fill, spearhead on the curve
 * tangent) with animated energy flowing source -> target, a lock-on ring on a valid snap and a
 * shaking X on an invalid one. Quadratic Bezier anchors/snapping are unchanged.
 */
export function TargetArrowOverlay({ state, viewerId, live = false, aim = null }: TargetArrowOverlayProps) {
  const [arrows, setArrows] = useState<ResolvedArrow[]>([]);
  const [aimState, setAimState] = useState<AimState | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Reduced / Off (or the OS setting) draws a static arrow: no flowing energy, pulse or shake.
  const motion = useAnimationLevel();

  useEffect(() => {
    if (!aim?.active || typeof window === "undefined") {
      setAimState(null);
      return;
    }
    let frame = 0;
    let pending: MouseEvent | null = null;
    const measure = () => {
      frame = 0;
      const event = pending;
      if (!event) return;
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const resolved = aimTargetForIds(aimTargetIdsForElement(element), aim.optionIds);
      const targetId = resolved.targetId;
      const anchorElement = targetId
        ? (document.querySelector<HTMLElement>(
            [
              `[data-card-id="${CSS.escape(targetId)}"]`,
              `[data-attached-card-id="${CSS.escape(targetId)}"]`,
              `[data-battlefield-marker="${CSS.escape(targetId)}"]`,
              `[data-drop-zone-root="${CSS.escape(targetId)}"]`,
              `[data-target-player-id="${CSS.escape(targetId)}"]`,
            ].join(","),
          ) ?? element)
        : null;
      setAimState({
        x: event.clientX,
        y: event.clientY,
        targetId,
        snap: targetId ? elementCenter(anchorElement) : null,
      });
    };
    const onPointerMove = (event: MouseEvent) => {
      pending = event;
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerdown", onPointerMove, true);
    // The chain card is a native-draggable source: once the browser starts the drag, pointer events
    // stop and only drag events carry the pointer position.
    window.addEventListener("dragover", onPointerMove, true);
    window.addEventListener("drag", onPointerMove, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerMove, true);
      window.removeEventListener("dragover", onPointerMove, true);
      window.removeEventListener("drag", onPointerMove, true);
    };
  }, [aim?.active, aim?.optionIds, aim?.sourceId]);

  useEffect(() => {
    const trackedArrows =
      Object.values(state.targetArrowsByPlayer ?? {}).some((list) => list.length > 0) ||
      (state.rules?.chain ?? []).some(
        (item) => chainTargetIds(item.choices as Record<string, unknown>).length > 0,
      );
    if (!trackedArrows) {
      setArrows((previous) => (previous.length === 0 ? previous : []));
      return;
    }
    let frame = 0;
    let until = performance.now() + 450;
    const measure = () => {
      const next: ResolvedArrow[] = [];
      const groups = state.targetArrowsByPlayer ?? {};
      const players = state.players;
      for (const [playerId, list] of Object.entries(groups)) {
        const playerIndex = players.findIndex((player) => player.id === playerId);
        const owner: "self" | "opponent" = playerId === viewerId ? "self" : "opponent";
        const playerColorKey = playerColorKeyFor(playerIndex);
        for (const arrow of list as TargetArrow[]) {
          const start = cardAnchor(arrow.sourceCardId, arrow.sourceAnchor);
          const end = cardAnchor(arrow.targetCardId, arrow.targetAnchor);
          if (!start || !end) continue;
          next.push({ owner, playerId, playerColorKey, ...curve(start, end) });
        }
      }
      // 108.1.b / 355: chosen targets are public while the chain item stays on the chain. Never
      // draw to a hidden/facedown (or redacted placeholder) target.
      next.push(...collectChainTargetArrows(state, viewerId, anchorForId));
      setArrows((previous) => {
        if (previous.length !== next.length) return next;
        const equal = previous.every((item, index) => {
          const candidate = next[index]!;
          return (
            item.path === candidate.path &&
            item.playerId === candidate.playerId &&
            item.owner === candidate.owner &&
            item.playerColorKey === candidate.playerColorKey
          );
        });
        return equal ? previous : next;
      });
    };
    const loop = () => {
      measure();
      if (performance.now() < until || live) {
        frame = window.requestAnimationFrame(loop);
      }
    };
    const restart = () => {
      until = performance.now() + 450;
      if (!frame) frame = window.requestAnimationFrame(loop);
    };
    restart();
    window.addEventListener("resize", restart);
    window.addEventListener("scroll", restart, true);
    const board = document.querySelector(".gb-board");
    const observer = typeof ResizeObserver !== "undefined" && board ? new ResizeObserver(restart) : null;
    if (board && observer) observer.observe(board);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", restart);
      window.removeEventListener("scroll", restart, true);
      observer?.disconnect();
    };
  }, [state.targetArrowsByPlayer, state.players, state.rules?.chain, viewerId, live]);

  const aimStart = aim?.active ? anchorForId(aim.sourceId, aim.sourceAnchor) : null;
  const aimEnd = aimState ? (aimState.snap ?? { x: aimState.x, y: aimState.y }) : null;
  const aimCurve = aimStart && aimEnd ? curve(aimStart, aimEnd) : null;
  const pinnedArrows = (aim?.active ? (aim.pinned ?? []) : []).flatMap((entry) => {
    const start = anchorForId(aim!.sourceId, aim!.sourceAnchor);
    const end = anchorForId(entry.targetId, "board");
    return start && end ? [{ ...entry, start, end, curve: curve(start, end) }] : [];
  });

  if (arrows.length === 0 && !aimCurve && pinnedArrows.length === 0) return null;

  return (
    <svg
      className="rb-target-arrows pointer-events-none fixed inset-0 z-[2147483600] h-screen w-screen"
      data-arrow-motion={motion}
      aria-hidden="true"
    >
      {aimCurve && aimState ? (
        <g
          data-testid="strict-target-arrow"
          data-status={aimState.targetId ? "valid" : "invalid"}
          data-target-id={aimState.targetId ?? ""}
        >
          <ArrowGlyph
            uid={`${uid}-aim`}
            curve={aimCurve}
            palette={aimState.targetId ? ARROW_PALETTE.valid : ARROW_PALETTE.invalid}
            lock={aimState.targetId ? "valid" : "invalid"}
          />
        </g>
      ) : null}
      {pinnedArrows.map((entry) => (
        <g
          key={`pinned-${entry.targetId}`}
          data-pinned-target-id={entry.targetId}
          data-pinned-index={entry.index}
        >
          <ArrowGlyph uid={`${uid}-pin-${entry.index}`} curve={entry.curve} palette={ARROW_PALETTE.valid} lock="pinned" />
          <circle cx={entry.end.x} cy={entry.end.y} r={10} fill="rgba(6,6,7,0.96)" stroke="rgba(240,212,138,0.9)" strokeWidth={1.5} />
          <text x={entry.end.x} y={entry.end.y + 3.6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#f0d48a">
            {entry.index + 1}
          </text>
        </g>
      ))}
      {arrows.map((arrow, index) => {
        const palette: ArrowPalette = arrow.playerColorKey
          ? paletteFromSolid(playerColorFor(Number(arrow.playerColorKey.slice(1)) - 1).solid)
          : arrow.owner === "self"
            ? ARROW_PALETTE.valid
            : ARROW_PALETTE.opponent;
        return (
          <g key={`${arrow.playerId}-${index}-${arrow.path}`} data-target-arrow-player-id={arrow.playerId} data-player-color={arrow.playerColorKey}>
            <ArrowGlyph uid={`${uid}-a${index}`} curve={arrow} palette={palette} lock="none" />
          </g>
        );
      })}
    </svg>
  );
}

export interface ArrowPalette {
  /** Shaft gradient: dim at the source -> bright at the head. */
  from: string;
  mid: string;
  to: string;
  /** Energy flow / sheen colour. */
  flow: string;
  glow: string;
}

/** Black/gold theme: valid = warm gold, invalid = ember red, opponent = muted ember-gold. */
export const ARROW_PALETTE = {
  valid: { from: "#6e5a2e", mid: "#c8aa6e", to: "#f6dc9a", flow: "#fff4cf", glow: "rgba(240,212,138,0.5)" },
  invalid: { from: "#5a1d1d", mid: "#c24a4a", to: "#ff8a80", flow: "#ffd9d4", glow: "rgba(255,110,110,0.45)" },
  opponent: { from: "#5c3a22", mid: "#c98a56", to: "#f2c08a", flow: "#ffe6cc", glow: "rgba(226,160,100,0.45)" },
} satisfies Record<string, ArrowPalette>;

/** Per-player arrows keep their identity colour: dim -> solid -> lightened. */
export function paletteFromSolid(solid: string): ArrowPalette {
  return {
    from: `color-mix(in srgb, ${solid} 45%, #0a0a0b)`,
    mid: solid,
    to: `color-mix(in srgb, ${solid} 60%, #ffffff)`,
    flow: `color-mix(in srgb, ${solid} 25%, #ffffff)`,
    glow: `color-mix(in srgb, ${solid} 55%, transparent)`,
  };
}

type LockState = "none" | "valid" | "invalid" | "pinned";

interface GlyphCurve {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  ctrlX: number;
  ctrlY: number;
}

/** One arrow: outline, gradient shaft + head, flowing energy, source dot and lock-on/X marker. */
export function ArrowGlyph({
  uid,
  curve: c,
  palette,
  lock,
}: {
  uid: string;
  curve: GlyphCurve;
  palette: ArrowPalette;
  lock: LockState;
}) {
  const g = buildArrowGeometry(
    { x: c.startX, y: c.startY },
    { x: c.ctrlX, y: c.ctrlY },
    { x: c.endX, y: c.endY },
  );
  const gradId = `${uid}-grad`;
  return (
    <g className="rb-arrow" data-arrow-lock={lock}>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={c.startX} y1={c.startY} x2={c.endX} y2={c.endY}>
          <stop offset="0" stopColor={palette.from} />
          <stop offset="0.55" stopColor={palette.mid} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
      </defs>
      {/* soft glow, then dark outline so the arrow reads on any playmat */}
      <path d={g.body} fill={palette.glow} stroke={palette.glow} strokeWidth={9} strokeLinejoin="round" opacity={0.55} />
      <path d={g.head} fill={palette.glow} stroke={palette.glow} strokeWidth={9} strokeLinejoin="round" opacity={0.55} />
      <path d={g.body} fill="rgba(0,0,0,0.88)" stroke="rgba(0,0,0,0.88)" strokeWidth={4} strokeLinejoin="round" />
      <path d={g.head} fill="rgba(0,0,0,0.88)" stroke="rgba(0,0,0,0.88)" strokeWidth={4} strokeLinejoin="round" />
      <path data-arrow-body="true" d={g.body} fill={`url(#${gradId})`} />
      <path data-arrow-head="true" d={g.head} fill={`url(#${gradId})`} stroke={palette.to} strokeWidth={1} strokeLinejoin="round" />
      {/* centre sheen + animated energy flowing source -> target */}
      <path d={g.center} fill="none" stroke={palette.flow} strokeOpacity={0.35} strokeWidth={1.2} strokeLinecap="round" />
      <path
        className="rb-arrow-flow"
        d={g.center}
        fill="none"
        stroke={palette.flow}
        strokeOpacity={0.9}
        strokeWidth={Math.max(2, g.widthEnd * 0.28)}
        strokeLinecap="round"
        strokeDasharray="2 22"
      />
      <path
        className="rb-arrow-flow rb-arrow-flow-slow"
        d={g.center}
        fill="none"
        stroke={palette.flow}
        strokeOpacity={0.5}
        strokeWidth={Math.max(3, g.widthEnd * 0.5)}
        strokeLinecap="round"
        strokeDasharray="14 58"
      />
      <circle cx={c.startX} cy={c.startY} r={5.5} fill="rgba(0,0,0,0.88)" />
      <circle cx={c.startX} cy={c.startY} r={3.6} fill={palette.mid} stroke={palette.to} strokeWidth={1} />
      {lock === "valid" || lock === "pinned" ? (
        <g transform={`translate(${c.endX} ${c.endY})`} data-arrow-lockon="true">
          <g className="rb-arrow-lock">
            <circle r={30} fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth={4.5} />
            <circle r={30} fill="none" stroke={palette.to} strokeWidth={2} strokeDasharray="10 7" />
            <circle r={22} fill="none" stroke={palette.mid} strokeOpacity={0.55} strokeWidth={1} />
          </g>
        </g>
      ) : null}
      {lock === "invalid" ? (
        <g transform={`translate(${c.endX + g.dir.x * 22} ${c.endY + g.dir.y * 22})`} data-arrow-invalid-x="true">
          <g className="rb-arrow-shake">
            <circle r={11} fill="rgba(0,0,0,0.85)" stroke={palette.mid} strokeWidth={1.5} />
            <path d="M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5" stroke={palette.to} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        </g>
      ) : null}
    </g>
  );
}
