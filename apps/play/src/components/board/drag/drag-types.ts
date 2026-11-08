/**
 * Native HTML5 drag payloads — verbatim MIME strings from the original board
 * chunk (`0xawjzm3yjpr1.js:35263`).
 */
import type { CardInstance, Zone } from "@rift/protocol";

export const DRAG_MIME = {
  boardCard: "application/x-riftbound-card",
  chainEntry: "application/x-riftbound-chain-entry",
  deckPeekCard: "application/x-riftbound-deck-peek-card",
  mainDeckCard: "application/x-riftbound-main-deck-card",
  battlefieldMarker: "application/x-riftbound-battlefield-marker",
} as const;

export type DragKind = keyof typeof DRAG_MIME;

/** `data-drag-origin-persist-until` — keeps an origin hidden until a timestamp. */
export const DRAG_ORIGIN_PERSIST_ATTRIBUTE = "data-drag-origin-persist-until";

/** Battlefield drop roots (verbatim `uW`). */
export const BATTLEFIELD_DROP_SELECTOR =
  '[data-drop-zone-root="battlefieldA"], [data-drop-zone-root="battlefieldB"], [data-drop-zone-root="battlefieldC"], [data-drop-zone-root="battlefieldToken"]';

/** Zones the original treats as ordered for drop-preview purposes (`uq`). */
export const ORDERED_DROP_ZONES = [
  "hand",
  "base",
  "battlefieldA",
  "battlefieldToken",
  "battlefieldB",
  "battlefieldC",
  "trash",
  "banished",
  "champion",
  "legend",
  "runeArea",
] as const;

export interface BoardCardDragPayload {
  zone: Zone;
  cardId: string;
  exhausted: boolean;
  hidden: boolean;
  hiddenBattlefieldDropKind?: "spell" | "unit" | "gear";
}

export interface ChainEntryDragPayload {
  entryId: string;
  cardId?: string;
  zone?: string;
}

export interface DeckPeekCardDragPayload {
  cardId: string;
  zone?: "deck" | "runeDeck";
}

export interface MainDeckCardDragPayload {
  cardId: string;
  zone?: "deck" | "runeDeck";
}

export interface BattlefieldMarkerDragPayload {
  zone: Zone;
  cardId: string;
}

export type DragPayload =
  | BoardCardDragPayload
  | ChainEntryDragPayload
  | DeckPeekCardDragPayload
  | MainDeckCardDragPayload
  | BattlefieldMarkerDragPayload;

export interface DragSession {
  kind: DragKind;
  payload: DragPayload;
  /** Card snapshot for the custom ghost (null for markers/chain entries). */
  card: CardInstance | null;
  /** Owner side the drag started from. */
  owner: "self" | "opponent";
  /** Element hidden during the drag (origin pickup classes). */
  originElement: HTMLElement | null;
  /** Card size (px) measured at drag start, used by the fixed ghost. */
  cardWidthPx: number;
  cardHeightPx: number;
  /** Pointer position at drag start. */
  startX: number;
  startY: number;
  startTimestamp: number;
}

export function mimeFor(kind: DragKind): string {
  return DRAG_MIME[kind];
}

export function writeDragPayload(
  dataTransfer: DataTransfer,
  kind: DragKind,
  payload: DragPayload,
): void {
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setData(DRAG_MIME[kind], JSON.stringify(payload));
}

export function readDragPayload(
  dataTransfer: DataTransfer | null,
): { kind: DragKind; payload: DragPayload } | null {
  if (!dataTransfer) return null;
  for (const kind of Object.keys(DRAG_MIME) as DragKind[]) {
    const raw = dataTransfer.getData(DRAG_MIME[kind]);
    if (!raw) continue;
    try {
      return { kind, payload: JSON.parse(raw) as DragPayload };
    } catch {
      return null;
    }
  }
  return null;
}

/** Original `uN`: battlefield markers and legends copy, everything else moves. */
export function dragEffectFor(kind: DragKind, payload: DragPayload): "copy" | "move" {
  if (kind === "battlefieldMarker") return "copy";
  if (kind === "boardCard" && "zone" in payload && payload.zone === "legend") return "copy";
  return "move";
}
