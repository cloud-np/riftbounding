"use client";

import { useEffect, useState } from "react";

import type { Room, TargetArrow } from "@rift/protocol";

import { playerColorFor, playerColorKeyFor } from "./player-colors";

export interface ResolvedArrow {
  owner: "self" | "opponent";
  playerId: string;
  playerColorKey?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
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
 * `hj` target-arrow SVG (`0xawjzm3yjpr1.js:16116-16480`): quadratic curve,
 * 5.5px soft stroke under a 2.4px solid stroke, 3.1px start dot, arrow marker.
 */
export function TargetArrowOverlay({ state, viewerId, live = false, aim = null }: TargetArrowOverlayProps) {
  const [arrows, setArrows] = useState<ResolvedArrow[]>([]);
  const [aimState, setAimState] = useState<AimState | null>(null);

  useEffect(() => {
    if (!aim?.active || typeof window === "undefined") {
      setAimState(null);
      return;
    }
    let frame = 0;
    let pending: PointerEvent | null = null;
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
    const onPointerMove = (event: PointerEvent) => {
      pending = event;
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerdown", onPointerMove, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerMove, true);
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
    return start && end ? [{ ...entry, start, end, path: curve(start, end).path }] : [];
  });

  if (arrows.length === 0 && !aimCurve && pinnedArrows.length === 0) return null;

  return (
    <svg className="pointer-events-none fixed inset-0 z-[2147483600] h-screen w-screen" aria-hidden="true">
      <defs>
        <marker id="gb-target-arrow-head-self" markerWidth="10" markerHeight="10" refX="8.8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(135,231,255,0.98)" />
        </marker>
        <marker id="gb-target-arrow-head-opponent" markerWidth="10" markerHeight="10" refX="8.8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,200,132,0.98)" />
        </marker>
        <marker id="gb-target-arrow-head-invalid" markerWidth="10" markerHeight="10" refX="8.8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,128,128,0.98)" />
        </marker>
        {(["p1", "p2", "p3", "p4"] as const).map((key) => (
          <marker
            key={key}
            id={`gb-target-arrow-head-${key}`}
            markerWidth="10"
            markerHeight="10"
            refX="8.8"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={playerColorFor(Number(key.slice(1)) - 1).solid} />
          </marker>
        ))}
      </defs>
      {aimCurve && aimState ? (
        <g
          data-testid="strict-target-arrow"
          data-status={aimState.targetId ? "valid" : "invalid"}
          data-target-id={aimState.targetId ?? ""}
        >
          <path
            d={aimCurve.path}
            fill="none"
            stroke={aimState.targetId ? "rgba(135,231,255,0.34)" : "rgba(255,120,120,0.28)"}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={aimCurve.path}
            fill="none"
            stroke={aimState.targetId ? "rgba(135,231,255,0.98)" : "rgba(255,128,128,0.96)"}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#gb-target-arrow-head-${aimState.targetId ? "self" : "invalid"})`}
          />
          <circle cx={aimCurve.startX} cy={aimCurve.startY} r={3.1} fill={aimState.targetId ? "rgba(135,231,255,0.98)" : "rgba(255,128,128,0.96)"} />
        </g>
      ) : null}
      {pinnedArrows.map((entry) => (
        <g
          key={`pinned-${entry.targetId}`}
          data-pinned-target-id={entry.targetId}
          data-pinned-index={entry.index}
        >
          <path d={entry.path} fill="none" stroke="rgba(95,201,230,0.3)" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
          <path
            d={entry.path}
            fill="none"
            stroke="rgba(135,231,255,0.9)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#gb-target-arrow-head-self)"
          />
          <circle cx={entry.end.x} cy={entry.end.y} r={9} fill="rgba(9,25,45,0.96)" stroke="rgba(139,222,189,0.86)" strokeWidth={1.4} />
          <text x={entry.end.x} y={entry.end.y + 3.4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#dffbef">
            {entry.index + 1}
          </text>
        </g>
      ))}
      {arrows.map((arrow, index) => {
        const colors: { solid: string; glow: string } = arrow.playerColorKey
          ? playerColorFor(Number(arrow.playerColorKey.slice(1)) - 1)
          : arrow.owner === "self"
            ? { solid: "rgba(135,231,255,0.96)", glow: "rgba(95,201,230,0.34)" }
            : { solid: "rgba(255,200,132,0.96)", glow: "rgba(255,170,90,0.34)" };
        const marker = arrow.playerColorKey
          ? `gb-target-arrow-head-${arrow.playerColorKey}`
          : `gb-target-arrow-head-${arrow.owner}`;
        return (
          <g key={`${arrow.playerId}-${index}-${arrow.path}`} data-target-arrow-player-id={arrow.playerId} data-player-color={arrow.playerColorKey}>
            <path d={arrow.path} fill="none" stroke={colors.glow} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={arrow.path}
              fill="none"
              stroke={colors.solid}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#${marker})`}
            />
            <circle cx={arrow.startX} cy={arrow.startY} r={3.1} fill={colors.solid} />
          </g>
        );
      })}
    </svg>
  );
}
