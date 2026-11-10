/**
 * DOM helpers for the FX layer: element/rect cache, ghost clones, zone lookups, banners, numbers.
 * Everything here is allowed to read layout; callers do it once per event, never per frame.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CardEntry {
  id: string;
  /** May be detached once the card left the board; still valid for cloning. */
  el: HTMLElement;
  rect: Box;
  side: "self" | "opponent";
  layoutW: number;
  layoutH: number;
  /** Degrees (exhausted cards are rotated). */
  angle: number;
}

export type CardGeneration = Map<string, CardEntry>;

export const cx = (box: Box) => box.left + box.width / 2;
export const cy = (box: Box) => box.top + box.height / 2;

export function boxOf(el: Element): Box | null {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function angleOf(el: HTMLElement): number {
  if (el.dataset.exhausted !== "true") return 0;
  try {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  } catch {
    return 0;
  }
}

/** Snapshot of every visible board card; replaced wholesale after each commit. */
export class CardCache {
  map: CardGeneration = new Map();

  refresh(): void {
    const next: CardGeneration = new Map();
    document
      .querySelectorAll<HTMLElement>('[data-board-card-visual="true"][data-card-id]')
      .forEach((el) => {
        const id = el.dataset.cardId;
        if (!id || el.closest("[data-fx-root]")) return;
        const rect = boxOf(el);
        if (!rect) return;
        next.set(id, {
          id,
          el,
          rect,
          side: el.dataset.visualOwner === "opponent" ? "opponent" : "self",
          layoutW: el.offsetWidth || rect.width,
          layoutH: el.offsetHeight || rect.height,
          angle: angleOf(el),
        });
      });
    this.map = next;
  }
}

export function liveCard(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-board-card-visual="true"][data-card-id="${CSS.escape(id)}"]`,
  );
}

export function liveEntry(id: string): CardEntry | null {
  const el = liveCard(id);
  if (!el) return null;
  const rect = boxOf(el);
  if (!rect) return null;
  return {
    id,
    el,
    rect,
    side: el.dataset.visualOwner === "opponent" ? "opponent" : "self",
    layoutW: el.offsetWidth || rect.width,
    layoutH: el.offsetHeight || rect.height,
    angle: angleOf(el),
  };
}

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  return { left, top, width: right - left, height: bottom - top };
}

export function queryBox(selector: string): Box | null {
  const el = document.querySelector(selector);
  return el ? boxOf(el) : null;
}

export function zoneBox(zone: string, owner: "self" | "opponent"): Box | null {
  return queryBox(`[data-drop-zone-root="${zone}"][data-zone-owner="${owner}"]`);
}

export function battlefieldBox(zone: string): Box | null {
  const boxes: Box[] = [];
  document
    .querySelectorAll(`[data-drop-zone-root="${zone}"]`)
    .forEach((el) => {
      const box = boxOf(el);
      if (box) boxes.push(box);
    });
  const marker = queryBox(`[data-battlefield-marker="${zone}"]`);
  if (marker) boxes.push(marker);
  return unionBox(boxes);
}

export function boardBox(): Box {
  return (
    queryBox("[data-game-board-shell]") ?? {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    }
  );
}

export function scoreBox(side: "self" | "opponent"): Box | null {
  return (
    queryBox(`[data-player-identity-rail][data-relation="${side}"]`) ??
    queryBox(`[data-board-player-scores][data-relation="${side}"]`) ??
    (side === "self" ? queryBox("[data-board-player-scores]") : null)
  );
}

/** Copy the board's CSS custom properties so cloned cards render identically outside `.gb-board`. */
export function syncBoardVars(target: HTMLElement): void {
  const board = document.querySelector<HTMLElement>(".gb-board");
  if (!board) return;
  const computed = getComputedStyle(board);
  const names = new Set<string>(["--card-width", "--card-height", "--card-radius-main", "--card-radius-tight", "--card-title-size", "--card-body-size", "--text-main", "--text-dim"]);
  for (let i = 0; i < board.style.length; i += 1) {
    const name = board.style.item(i);
    if (name.startsWith("--")) names.add(name);
  }
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed.item(i);
    if (name.startsWith("--")) names.add(name);
  }
  for (const name of names) {
    const value = computed.getPropertyValue(name);
    if (value) target.style.setProperty(name, value);
  }
}

export interface Ghost {
  /** Positioned (left/top) and moved with the `translate` property. */
  outer: HTMLElement;
  /** Scaled / rotated / filtered. */
  inner: HTMLElement;
  center: { x: number; y: number };
  w: number;
  h: number;
  remove: () => void;
}

function sanitizeClone(node: Element): void {
  node.removeAttribute("data-card-id");
  node.removeAttribute("data-board-card-visual");
  node.removeAttribute("data-drop-zone");
  node.removeAttribute("id");
  node.removeAttribute("draggable");
  for (const child of Array.from(node.children)) sanitizeClone(child);
}

/** Clone a board card element into `stage`, centred on `entry.rect`. */
export function createGhost(stage: HTMLElement, entry: CardEntry, at?: Box, scaleToRect = false): Ghost {
  const rect = at ?? entry.rect;
  const w = scaleToRect ? rect.width : entry.layoutW;
  const h = scaleToRect ? rect.height : entry.layoutH;
  const x = cx(rect);
  const y = cy(rect);
  const outer = document.createElement("div");
  outer.className = "fx-ghost";
  outer.dataset.fxGhost = "true";
  outer.style.left = `${x - w / 2}px`;
  outer.style.top = `${y - h / 2}px`;
  outer.style.width = `${w}px`;
  outer.style.height = `${h}px`;
  const inner = document.createElement("div");
  inner.className = "fx-ghost-inner";
  if (entry.angle) inner.style.rotate = `${entry.angle}deg`;
  const clone = entry.el.cloneNode(true) as HTMLElement;
  sanitizeClone(clone);
  clone.setAttribute("aria-hidden", "true");
  clone.classList.add("fx-ghost-card");
  inner.appendChild(clone);
  outer.appendChild(inner);
  stage.appendChild(outer);
  return {
    outer,
    inner,
    center: { x, y },
    w,
    h,
    remove: () => outer.remove(),
  };
}

/** Plain stand-in card when no DOM element exists (e.g. an opponent spell not rendered yet). */
export function createPlaceholderGhost(
  stage: HTMLElement,
  at: Box,
  title: string,
  rgb: string,
  dark: string,
): Ghost {
  const outer = document.createElement("div");
  outer.className = "fx-ghost";
  outer.dataset.fxGhost = "true";
  outer.style.left = `${at.left}px`;
  outer.style.top = `${at.top}px`;
  outer.style.width = `${at.width}px`;
  outer.style.height = `${at.height}px`;
  const inner = document.createElement("div");
  inner.className = "fx-ghost-inner";
  const card = document.createElement("div");
  card.className = "fx-placeholder-card";
  card.style.setProperty("--fx-rgb", rgb);
  card.style.setProperty("--fx-dark", dark);
  const name = document.createElement("span");
  name.textContent = title;
  card.appendChild(name);
  inner.appendChild(card);
  outer.appendChild(inner);
  stage.appendChild(outer);
  return { outer, inner, center: { x: cx(at), y: cy(at) }, w: at.width, h: at.height, remove: () => outer.remove() };
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}
