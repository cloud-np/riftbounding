"use client";

import { useEffect, useState } from "react";

import type { Room, TargetArrow } from "@rift/protocol";

import { playerColorFor, playerColorKeyFor } from "./player-colors";

interface ResolvedArrow {
  owner: "self" | "opponent";
  playerId: string;
  playerColorKey?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
}

function cardAnchor(cardId: string, anchor: "board" | "chain"): { x: number; y: number } | null {
  if (typeof document === "undefined") return null;
  const selectors =
    anchor === "chain"
      ? [
          `[data-chain-entry-id="${CSS.escape(cardId)}"]`,
          `[data-chain-card-id="${CSS.escape(cardId)}"]`,
          `[data-card-id="${CSS.escape(cardId)}"]`,
        ]
      : [`[data-card-id="${CSS.escape(cardId)}"]`];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return null;
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
}

/**
 * `hj` target-arrow SVG (`0xawjzm3yjpr1.js:16116-16480`): quadratic curve,
 * 5.5px soft stroke under a 2.4px solid stroke, 3.1px start dot, arrow marker.
 */
export function TargetArrowOverlay({ state, viewerId, live = false }: TargetArrowOverlayProps) {
  const [arrows, setArrows] = useState<ResolvedArrow[]>([]);

  useEffect(() => {
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
  }, [state.targetArrowsByPlayer, state.players, viewerId, live]);

  if (arrows.length === 0) return null;

  return (
    <svg className="pointer-events-none fixed inset-0 z-[2147483600] h-screen w-screen" aria-hidden="true">
      <defs>
        <marker id="gb-target-arrow-head-self" markerWidth="10" markerHeight="10" refX="8.8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(135,231,255,0.98)" />
        </marker>
        <marker id="gb-target-arrow-head-opponent" markerWidth="10" markerHeight="10" refX="8.8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,200,132,0.98)" />
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
