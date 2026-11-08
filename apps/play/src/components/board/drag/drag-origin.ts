/**
 * Drag-origin pickup animation helpers — port of the original `uC` / `u_` /
 * `uj` functions (`0xawjzm3yjpr1.js:35273-35355`).
 */

import { DRAG_ORIGIN_PERSIST_ATTRIBUTE } from "./drag-types";

export const DRAG_ORIGIN_PICKUP_CLASS = "dragOriginPickup";
export const DRAG_ORIGIN_HIDDEN_CLASS = "dragOriginHidden";
export const DRAG_PICKUP_DELAY_MS = 90;

export interface DragOriginSession {
  origin: HTMLElement | null;
  hideFrame: number | null;
  revealFrame: number | null;
  hideTimer: number | null;
  token: number;
}

export function createDragOriginSession(): DragOriginSession {
  return { origin: null, hideFrame: null, revealFrame: null, hideTimer: null, token: 0 };
}

export function clearDragOriginClasses(element: HTMLElement): void {
  element.removeAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE);
  element.classList.remove(DRAG_ORIGIN_PICKUP_CLASS);
  element.classList.remove(DRAG_ORIGIN_HIDDEN_CLASS);
}

/** `u_` — sweep every origin and honour `data-drag-origin-persist-until`. */
export function sweepDragOrigins(root: ParentNode | null, now = Date.now()): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>(`.${DRAG_ORIGIN_HIDDEN_CLASS}, .${DRAG_ORIGIN_PICKUP_CLASS}`).forEach((element) => {
    element.classList.remove(DRAG_ORIGIN_PICKUP_CLASS);
    const raw = element.getAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE);
    const until = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isFinite(until) && until > now) {
      element.classList.add(DRAG_ORIGIN_HIDDEN_CLASS);
    } else {
      element.removeAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE);
      element.classList.remove(DRAG_ORIGIN_HIDDEN_CLASS);
    }
  });
}

/** `uj` — restore the origin (optionally after one more frame). */
export function restoreDragOrigin(
  session: DragOriginSession,
  options: { revealOriginOnNextFrame?: boolean; now?: () => number } = {},
): boolean {
  let changed = false;
  if (session.hideTimer !== null) {
    window.clearTimeout(session.hideTimer);
    session.hideTimer = null;
    changed = true;
  }
  if (session.hideFrame !== null) {
    window.cancelAnimationFrame(session.hideFrame);
    session.hideFrame = null;
    changed = true;
  }
  if (session.revealFrame !== null) {
    window.cancelAnimationFrame(session.revealFrame);
    session.revealFrame = null;
    changed = true;
  }
  const origin = session.origin;
  if (!origin) return changed;
  const now = options.now ?? Date.now;
  origin.blur();
  origin.classList.remove(DRAG_ORIGIN_PICKUP_CLASS);
  const finish = () => {
    clearDragOriginClasses(origin);
    session.revealFrame = null;
    if (session.origin === origin) session.origin = null;
  };
  if (options.revealOriginOnNextFrame) {
    origin.classList.add(DRAG_ORIGIN_HIDDEN_CLASS);
    origin.setAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE, String(now() + 64));
    session.revealFrame = window.requestAnimationFrame(finish);
  } else {
    finish();
  }
  return true;
}

/** Begin the `.dragOriginPickup` → `.dragOriginHidden` hand-off. */
export function beginDragOrigin(
  session: DragOriginSession,
  element: HTMLElement | null,
  pickupDelayMs = DRAG_PICKUP_DELAY_MS,
): void {
  if (!element) return;
  if (session.origin && session.origin !== element) clearDragOriginClasses(session.origin);
  if (session.revealFrame !== null) {
    window.cancelAnimationFrame(session.revealFrame);
    session.revealFrame = null;
  }
  if (session.hideTimer !== null) {
    window.clearTimeout(session.hideTimer);
    session.hideTimer = null;
  }
  if (session.hideFrame !== null) {
    window.cancelAnimationFrame(session.hideFrame);
    session.hideFrame = null;
  }
  session.origin = element;
  element.removeAttribute(DRAG_ORIGIN_PERSIST_ATTRIBUTE);
  element.classList.remove(DRAG_ORIGIN_HIDDEN_CLASS);
  element.classList.add(DRAG_ORIGIN_PICKUP_CLASS);
  const token = session.token;
  session.hideFrame = window.requestAnimationFrame(() => {
    session.hideFrame = null;
    if (session.origin !== element || session.token !== token) return;
    session.hideTimer = window.setTimeout(() => {
      session.hideTimer = null;
      if (session.origin !== element || session.token !== token) return;
      element.classList.remove(DRAG_ORIGIN_PICKUP_CLASS);
      element.classList.add(DRAG_ORIGIN_HIDDEN_CLASS);
    }, pickupDelayMs);
  });
}
