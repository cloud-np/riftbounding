"use client";

/**
 * React-rendered card ghosts for the FX stage. They render the same {@link CardVisual} the board
 * uses (token for cards in play, full for hand / showcase) into the FX portal, so sizes are exact
 * and no DOM clone of a transient element is needed.
 *
 * A "morph" ghost stacks a full-card layer and a token layer; effects crossfade/scale between
 * them (full at the hand rect -> token at the destination rect).
 */
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { CardInstance } from "@rift/protocol";

import { CardBack } from "../card/CardBack";
import { CardVisual } from "../card/CardVisual";
import { cx, cy, type Box } from "./dom";

export const CARD_ASPECT = 88 / 63;
const TOKEN_ASPECT = 1.14;

export interface CardGhost {
  /** Positioned (left/top) and moved with the `translate` property; sized to the token rect. */
  outer: HTMLElement;
  /** Scaled / rotated / filtered as a whole. */
  inner: HTMLElement;
  /** Layer holding the full card (opacity/scale animated); sized `fullW` x `fullH`. */
  fullLayer: HTMLElement | null;
  /** Layer holding the token (opacity/scale animated); sized to the token rect. */
  tokenLayer: HTMLElement | null;
  center: { x: number; y: number };
  /** Token size. */
  w: number;
  h: number;
  fullW: number;
  fullH: number;
  remove: () => void;
}

interface MountOptions {
  stage: HTMLElement;
  card: CardInstance;
  side: "self" | "opponent";
  /** Where the ghost ends up (token rect for plays; showcase rect for full-only ghosts). */
  at: Box;
  /** Include a token layer (width = at.width). */
  token?: boolean;
  /** Include a full layer of this width (px). */
  fullWidth?: number;
  angle?: number;
  /** Dim the token like an exhausted board token (rotation is the caller's job). */
  exhausted?: boolean;
}

function layerStyle(width: number): CSSProperties {
  // Full-size grid cell with the card centred in it: scaling the cell scales the card about the
  // ghost's centre (unsafe centring lets a larger card overflow equally on every side).
  return {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    transformOrigin: "50% 50%",
    ["--card-width" as string]: `${width}px`,
  };
}

/** Render ghost layers synchronously so the first paint already contains the card. */
export function createCardGhost(options: MountOptions): CardGhost {
  const { stage, card, side, at, token = false, fullWidth, angle = 0, exhausted = false } = options;
  const w = Math.max(1, at.width);
  const h = Math.max(1, at.height);
  const x = cx(at);
  const y = cy(at);
  const outer = document.createElement("div");
  outer.className = "fx-ghost";
  outer.dataset.fxGhost = "true";
  outer.style.left = `${x - w / 2}px`;
  outer.style.top = `${y - h / 2}px`;
  outer.style.width = `${w}px`;
  outer.style.height = `${h}px`;
  const inner = document.createElement("div");
  inner.className = "fx-ghost-inner";
  if (angle) inner.style.rotate = `${angle}deg`;
  outer.appendChild(inner);
  stage.appendChild(outer);

  const fullW = fullWidth && fullWidth > 0 ? fullWidth : 0;
  const root = createRoot(inner);
  flushSync(() => {
    root.render(
      <>
        {fullW > 0 ? (
          <div className="fx-ghost-layer" data-fx-layer="full" style={layerStyle(fullW)}>
            <CardVisual card={card} side={side} variant="full" />
          </div>
        ) : null}
        {token ? (
          <div className="fx-ghost-layer" data-fx-layer="token" style={layerStyle(w)}>
            <CardVisual card={card} side={side} variant="token" />
          </div>
        ) : null}
      </>,
    );
  });

  if (exhausted) inner.querySelector('[data-fx-layer="token"] .rtoken')?.setAttribute("data-exhausted", "true");

  let removed = false;
  return {
    outer,
    inner,
    fullLayer: inner.querySelector<HTMLElement>('[data-fx-layer="full"]'),
    tokenLayer: inner.querySelector<HTMLElement>('[data-fx-layer="token"]'),
    center: { x, y },
    w,
    h,
    fullW,
    fullH: fullW * CARD_ASPECT,
    remove: () => {
      if (removed) return;
      removed = true;
      outer.remove();
      // Unmount outside React's commit/flush phases.
      queueMicrotask(() => {
        try {
          root.unmount();
        } catch {
          /* already gone */
        }
      });
    },
  };
}

/** Full-card showcase ghost centred on `at` (width derived from its height). */
export function createShowcaseGhost(stage: HTMLElement, card: CardInstance, side: "self" | "opponent", at: Box): CardGhost {
  return createCardGhost({ stage, card, side, at, fullWidth: at.width });
}

export function tokenHeightFor(width: number): number {
  return width * TOKEN_ASPECT;
}

/** Card-back ghost (opponent draws): same sleeve the deck pile shows, sized to `at`. */
export function createBackGhost(stage: HTMLElement, side: "self" | "opponent", at: Box): CardGhost {
  const w = Math.max(1, at.width);
  const h = Math.max(1, at.height);
  const outer = document.createElement("div");
  outer.className = "fx-ghost";
  outer.dataset.fxGhost = "true";
  outer.style.left = `${cx(at) - w / 2}px`;
  outer.style.top = `${cy(at) - h / 2}px`;
  outer.style.width = `${w}px`;
  outer.style.height = `${h}px`;
  const inner = document.createElement("div");
  inner.className = "fx-ghost-inner";
  outer.appendChild(inner);
  stage.appendChild(outer);
  const root = createRoot(inner);
  flushSync(() => {
    root.render(
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "var(--card-radius-main, 0.3rem)" }}>
        <CardBack slot="deck" side={side} />
      </div>,
    );
  });
  let removed = false;
  return {
    outer,
    inner,
    fullLayer: null,
    tokenLayer: null,
    center: { x: cx(at), y: cy(at) },
    w,
    h,
    fullW: w,
    fullH: h,
    remove: () => {
      if (removed) return;
      removed = true;
      outer.remove();
      queueMicrotask(() => {
        try {
          root.unmount();
        } catch {
          /* gone */
        }
      });
    },
  };
}
